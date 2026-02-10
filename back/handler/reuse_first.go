package handler

import (
	"context"
	"devsforge/model"
	"devsforge/prompt"
	"devsforge/response"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"regexp"
	"sort"
	"strings"

	"github.com/openai/openai-go"
	"gorm.io/gorm"
)

const (
	reuseTopK         = 4
	reuseLowThreshold = 0.05
)

var keywordWhitespaceRegex = regexp.MustCompile(`\s+`)

type keywordExtractionResponse struct {
	Keywords []string `json:"keywords" jsonschema:"required"`
}

type modelReuseCandidate struct {
	ModelID      string
	Name         string
	Description  string
	Keywords     []string
	Score        float64
	UpdatedAt    int64
	Code         string
	MatchedCount int
}

func extractPromptKeywords(client *openai.Client, userPrompt string) ([]string, error) {
	fallback := fallbackKeywordsFromPrompt(userPrompt)
	if client == nil {
		return fallback, nil
	}

	chat, err := client.Chat.Completions.New(context.Background(), openai.ChatCompletionNewParams{
		Messages: openai.F([]openai.ChatCompletionMessageParamUnion{
			openai.SystemMessage(prompt.KeywordExtractionPrompt),
			openai.UserMessage(userPrompt),
		}),
		MaxCompletionTokens: openai.Int(200),
		TopP:                openai.Float(0.5),
		Temperature:         openai.Float(0.2),
		ResponseFormat: openai.F[openai.ChatCompletionNewParamsResponseFormatUnion](
			openai.ResponseFormatJSONSchemaParam{
				Type: openai.F(openai.ResponseFormatJSONSchemaTypeJSONSchema),
				JSONSchema: openai.F(openai.ResponseFormatJSONSchemaJSONSchemaParam{
					Name:        openai.F("PromptKeywords"),
					Description: openai.F("A concise keyword list extracted from a user request"),
					Schema:      openai.F(GenerateSchema[keywordExtractionResponse]()),
					Strict:      openai.Bool(true),
				}),
			},
		),
		Model: openai.F(os.Getenv("AI_MODEL")),
	})
	if err != nil || chat == nil || len(chat.Choices) == 0 {
		if len(fallback) == 0 && err != nil {
			return nil, err
		}
		return fallback, nil
	}

	var parsed keywordExtractionResponse
	if err := json.Unmarshal([]byte(chat.Choices[0].Message.Content), &parsed); err != nil {
		if len(fallback) == 0 {
			return nil, err
		}
		return fallback, nil
	}

	keywords := normalizeKeywords(parsed.Keywords)
	keywords = mergeKeywords(keywords, fallback)
	if len(keywords) == 0 {
		return fallback, nil
	}
	if len(keywords) > 12 {
		keywords = keywords[:12]
	}
	return keywords, nil
}

func getReuseCandidates(
	db *gorm.DB,
	userID string,
	language string,
	promptKeywords []string,
	topK int,
	threshold float64,
) ([]modelReuseCandidate, error) {
	if topK <= 0 {
		topK = reuseTopK
	}
	if threshold < 0 {
		threshold = 0
	}
	expandedPromptKeywords := expandKeywordsForMatching(promptKeywords)
	if len(expandedPromptKeywords) == 0 {
		expandedPromptKeywords = promptKeywords
	}

	var models []model.Model
	if err := db.
		Where("user_id = ? AND language = ? AND deleted_at IS NULL", userID, language).
		Find(&models).Error; err != nil {
		return nil, err
	}

	candidates := make([]modelReuseCandidate, 0, len(models))
	for _, m := range models {
		modelKeywords := normalizeKeywords(m.Metadata.Keyword)
		if len(modelKeywords) == 0 {
			continue
		}
		expandedModelKeywords := expandKeywordsForMatching(modelKeywords)
		if len(expandedModelKeywords) == 0 {
			expandedModelKeywords = modelKeywords
		}
		score, matched := jaccardScore(expandedPromptKeywords, expandedModelKeywords)
		if score < threshold {
			continue
		}
		if strings.TrimSpace(m.Code) == "" {
			continue
		}
		candidates = append(candidates, modelReuseCandidate{
			ModelID:      m.ID,
			Name:         m.Name,
			Description:  m.Description,
			Keywords:     modelKeywords,
			Score:        score,
			UpdatedAt:    m.UpdatedAt.Unix(),
			Code:         m.Code,
			MatchedCount: matched,
		})
	}

	sort.Slice(candidates, func(i, j int) bool {
		if math.Abs(candidates[i].Score-candidates[j].Score) > 1e-9 {
			return candidates[i].Score > candidates[j].Score
		}
		if candidates[i].MatchedCount != candidates[j].MatchedCount {
			return candidates[i].MatchedCount > candidates[j].MatchedCount
		}
		return candidates[i].UpdatedAt > candidates[j].UpdatedAt
	})

	if len(candidates) > topK {
		candidates = candidates[:topK]
	}
	return candidates, nil
}

func pickReuseCandidate(
	candidates []modelReuseCandidate,
	forcedModelID *string,
	forceScratch bool,
) *modelReuseCandidate {
	if forceScratch {
		return nil
	}
	if len(candidates) == 0 {
		return nil
	}
	if forcedModelID != nil && strings.TrimSpace(*forcedModelID) != "" {
		for i := range candidates {
			if candidates[i].ModelID == *forcedModelID {
				candidate := candidates[i]
				return &candidate
			}
		}
		return nil
	}
	return nil
}

func buildReuseContext(
	promptKeywords []string,
	candidates []modelReuseCandidate,
	selected *modelReuseCandidate,
) string {
	var b strings.Builder
	b.WriteString("Reuse-first analysis:\n")
	if len(promptKeywords) == 0 {
		b.WriteString("- Prompt keywords: none\n")
	} else {
		b.WriteString(fmt.Sprintf("- Prompt keywords: %s\n", strings.Join(promptKeywords, ", ")))
	}

	if len(candidates) == 0 {
		b.WriteString("- Candidates: none\n")
		return b.String()
	}

	b.WriteString("- Ranked candidates (Jaccard):\n")
	for _, c := range candidates {
		b.WriteString(
			fmt.Sprintf(
				"  - %s (%s): score=%.3f, keywords=[%s]\n",
				c.Name,
				c.ModelID,
				c.Score,
				strings.Join(c.Keywords, ", "),
			),
		)
	}

	if selected != nil {
		b.WriteString(
			fmt.Sprintf(
				"- Selected candidate: %s (%s), score=%.3f\n",
				selected.Name,
				selected.ModelID,
				selected.Score,
			),
		)
	}
	return b.String()
}

func buildPreviousCodeWithReuse(previous string, selected *modelReuseCandidate) string {
	if selected == nil {
		return previous
	}
	var b strings.Builder
	b.WriteString("# === Reuse candidate (reuse-first) ===\n")
	b.WriteString(fmt.Sprintf("# model: %s (%s)\n", selected.Name, selected.ModelID))
	b.WriteString(fmt.Sprintf("# score: %.3f\n", selected.Score))
	if len(selected.Keywords) > 0 {
		b.WriteString(fmt.Sprintf("# keywords: %s\n", strings.Join(selected.Keywords, ", ")))
	}
	b.WriteString(selected.Code)
	b.WriteString("\n\n# === Existing referenced models ===\n")
	b.WriteString(previous)
	return b.String()
}

func toReuseCandidateResponse(candidate modelReuseCandidate) response.ReuseCandidateResponse {
	return response.ReuseCandidateResponse{
		ModelID:     candidate.ModelID,
		Name:        candidate.Name,
		Score:       roundScore(candidate.Score),
		Keywords:    candidate.Keywords,
		Description: candidate.Description,
	}
}

func toReuseCandidatesResponse(candidates []modelReuseCandidate) []response.ReuseCandidateResponse {
	out := make([]response.ReuseCandidateResponse, 0, len(candidates))
	for _, c := range candidates {
		out = append(out, toReuseCandidateResponse(c))
	}
	return out
}

func roundScore(v float64) float64 {
	return math.Round(v*1000) / 1000
}

func normalizeKeywords(raw []string) []string {
	seen := make(map[string]struct{}, len(raw))
	out := make([]string, 0, len(raw))
	for _, kw := range raw {
		n := strings.TrimSpace(strings.ToLower(kw))
		n = strings.Trim(n, " \t\n\r,.;:!?()[]{}\"'")
		n = strings.ReplaceAll(n, "_", "-")
		n = keywordWhitespaceRegex.ReplaceAllString(n, "-")
		if n == "" {
			continue
		}
		if _, ok := seen[n]; ok {
			continue
		}
		seen[n] = struct{}{}
		out = append(out, n)
	}
	return out
}

func jaccardScore(a []string, b []string) (float64, int) {
	if len(a) == 0 && len(b) == 0 {
		return 0, 0
	}
	setA := make(map[string]struct{}, len(a))
	setB := make(map[string]struct{}, len(b))
	for _, v := range a {
		setA[v] = struct{}{}
	}
	for _, v := range b {
		setB[v] = struct{}{}
	}

	union := make(map[string]struct{}, len(setA)+len(setB))
	for k := range setA {
		union[k] = struct{}{}
	}
	matched := 0
	for k := range setB {
		if _, ok := setA[k]; ok {
			matched++
		}
		union[k] = struct{}{}
	}
	if len(union) == 0 {
		return 0, matched
	}
	return float64(matched) / float64(len(union)), matched
}

func fallbackKeywordsFromPrompt(input string) []string {
	normalized := strings.ToLower(input)
	tokenizer := regexp.MustCompile(`[a-z0-9][a-z0-9_-]{2,}`)
	tokens := tokenizer.FindAllString(normalized, -1)
	if len(tokens) == 0 {
		return nil
	}

	stop := map[string]struct{}{
		"the": {}, "and": {}, "for": {}, "with": {}, "that": {}, "this": {}, "from": {}, "into": {},
		"have": {}, "has": {}, "are": {}, "was": {}, "were": {}, "your": {}, "user": {}, "model": {},
		"models": {}, "code": {}, "need": {}, "want": {}, "using": {}, "use": {}, "based": {}, "make": {},
		"dans": {}, "avec": {}, "pour": {}, "les": {}, "des": {}, "une": {}, "par": {}, "sur": {}, "est": {},
		"sont": {}, "que": {}, "qui": {}, "quoi": {}, "comme": {}, "plus": {}, "moins": {}, "sans": {},
	}

	seen := make(map[string]struct{}, len(tokens))
	out := make([]string, 0, 12)
	for _, t := range tokens {
		if _, skip := stop[t]; skip {
			continue
		}
		if _, ok := seen[t]; ok {
			continue
		}
		seen[t] = struct{}{}
		out = append(out, t)
		if len(out) >= 12 {
			break
		}
	}
	return out
}

func mergeKeywords(primary []string, secondary []string) []string {
	out := make([]string, 0, len(primary)+len(secondary))
	seen := make(map[string]struct{}, len(primary)+len(secondary))

	appendUnique := func(values []string) {
		for _, value := range values {
			n := strings.TrimSpace(strings.ToLower(value))
			if n == "" {
				continue
			}
			if _, ok := seen[n]; ok {
				continue
			}
			seen[n] = struct{}{}
			out = append(out, n)
		}
	}

	appendUnique(primary)
	appendUnique(secondary)

	return normalizeKeywords(out)
}

func expandKeywordsForMatching(keywords []string) []string {
	expanded := make([]string, 0, len(keywords)*2)
	seen := make(map[string]struct{}, len(keywords)*2)

	add := func(value string) {
		v := strings.TrimSpace(strings.ToLower(value))
		if len(v) < 3 {
			return
		}
		if _, ok := seen[v]; ok {
			return
		}
		seen[v] = struct{}{}
		expanded = append(expanded, v)
	}

	for _, keyword := range keywords {
		add(keyword)
		parts := strings.Split(keyword, "-")
		for _, part := range parts {
			add(part)
		}
	}

	return expanded
}
