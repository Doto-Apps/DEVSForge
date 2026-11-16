package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"slices"
	"strings"
	"time"

	"devsforge-shared/integrations"
	"devsforge/database"
	"devsforge/enum"
	"devsforge/exchange"
	modeljson "devsforge/json"
	"devsforge/middleware"
	"devsforge/model"
	"devsforge/services"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ImportFile struct {
	Name   string `json:"name"`
	Base64 string `json:"base64"`
}
type ImportRequest struct {
	Mode          string       `json:"mode"`
	Files         []ImportFile `json:"files"`
	Instructions  string       `json:"instructions"`
	TargetID      string       `json:"targetIntegrationId"`
	TargetVersion string       `json:"targetIntegrationVersion"`
}
type ImportJob struct {
	ID           string               `json:"id"`
	State        string               `json:"state"`
	Progress     string               `json:"progress"`
	Error        string               `json:"error,omitempty"`
	Strategy     string               `json:"strategy,omitempty"`
	Warnings     []string             `json:"warnings"`
	Package      *exchange.Package    `json:"package,omitempty"`
	Messages     []ImportMessage      `json:"messages"`
	Attempts     []ImportVerification `json:"attempts"`
	Verification *ImportVerification  `json:"verification,omitempty"`
	Revision     int                  `json:"revision"`
	Phase        string               `json:"phase"`
	Changes      []string             `json:"changes"`
}
type ImportMessage struct {
	ID      string `json:"id"`
	Role    string `json:"role"`
	Content string `json:"content"`
}
type ImportVerification struct {
	Status       string  `json:"status"`
	Error        string  `json:"error,omitempty"`
	Logs         string  `json:"logs,omitempty"`
	SimulationID string  `json:"simulationId,omitempty"`
	RootID       string  `json:"rootId"`
	MaxTime      float64 `json:"maxTime"`
	Revision     int     `json:"revision"`
	DurationMs   int64   `json:"durationMs"`
	Digest       string  `json:"digest"`
}
type CommitImportRequest struct {
	LibraryID string `json:"libraryId"`
	Reviewed  bool   `json:"reviewed"`
	Revision  int    `json:"revision"`
}
type ImportResult struct {
	RootIDs  []string `json:"rootIds"`
	ModelIDs []string `json:"modelIds"`
}
type ModelCapabilities struct {
	Simulation bool   `json:"simulation"`
	Reason     string `json:"reason"`
}

func SetupImportRoutes(app *fiber.App) {
	g := app.Group("/imports", middleware.Protected())
	g.Post("", startImport)
	g.Get("", listImports)
	g.Get("/:id", getImport)
	g.Delete("/:id", cancelImport)
	g.Post("/:id/commit", commitImport)
	g.Post("/:id/turns", continueImport)
	app.Post("/internal/imports/verify", verifyImportDraft)
	app.Get("/model/:id/capabilities", middleware.Protected(), modelCapabilities)
}

type ImportDraft struct {
	ID                 string  `json:"id"`
	Title              string  `json:"title"`
	State              string  `json:"state"`
	Updated            float64 `json:"updated"`
	ModelCount         int     `json:"modelCount"`
	VerificationStatus string  `json:"verificationStatus"`
}

// @Summary List resumable import drafts for the current user
// @Tags Imports
// @Produce json
// @Success 200 {array} ImportDraft
// @Router /imports [get]
func listImports(c *fiber.Ctx) error {
	status, data, err := workerRequest(c, "GET", "/jobs", nil)
	if err != nil {
		return SendRequestError(c, 503, err)
	}
	if status != 200 {
		return c.Status(status).Type("json").Send(data)
	}
	var drafts []ImportDraft
	if err := json.Unmarshal(data, &drafts); err != nil {
		return SendRequestError(c, 503, err)
	}
	ids := make([]string, 0, len(drafts))
	for _, d := range drafts {
		ids = append(ids, d.ID)
	}
	var committed []string
	if len(ids) > 0 {
		if err := database.DB.Table("model_imports").Where("user_id=? AND job_id IN ?", c.Locals("user_id").(string), ids).Pluck("job_id", &committed).Error; err != nil {
			return SendRequestError(c, 500, err)
		}
	}
	result := make([]ImportDraft, 0, len(drafts))
	for _, d := range drafts {
		if !slices.Contains(committed, d.ID) {
			result = append(result, d)
		}
	}
	c.Set("Cache-Control", "no-store")
	return c.JSON(result)
}

func databaseImportCommitted(c *fiber.Ctx, count *int64) error {
	return database.DB.Table("model_imports").Where("user_id=? AND job_id=?", c.Locals("user_id").(string), c.Params("id")).Count(count).Error
}

var importJobID = regexp.MustCompile(`^[a-f0-9]{48}$`)

func workerRequest(c *fiber.Ctx, method, path string, body any) (int, []byte, error) {
	base := os.Getenv("IMPORT_ADDR")
	if base == "" {
		base = "http://importer:8091"
	}
	token := os.Getenv("IMPORT_INTERNAL_TOKEN")
	if token == "" {
		return 0, nil, fmt.Errorf("import service token is missing; run task importer:setup")
	}
	var data []byte
	var err error
	if body != nil {
		data, err = json.Marshal(body)
		if err != nil {
			return 0, nil, err
		}
	}
	req, err := http.NewRequestWithContext(c.UserContext(), method, strings.TrimRight(base, "/")+path, bytes.NewReader(data))
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-Import-User", c.Locals("user_id").(string))
	req.Header.Set("Content-Type", "application/json")
	res, err := (&http.Client{Timeout: 20 * time.Second}).Do(req)
	if err != nil {
		return 0, nil, fmt.Errorf("import service unavailable")
	}
	defer func() { _ = res.Body.Close() }()
	data, err = io.ReadAll(io.LimitReader(res.Body, 40<<20))
	return res.StatusCode, data, err
}

// startImport starts a user-scoped conversion without writing any model.
// @Summary Analyze an import
// @Tags Imports
// @Accept json
// @Produce json
// @Param body body ImportRequest true "Files and import mode"
// @Success 202 {object} ImportJob
// @Router /imports [post]
func startImport(c *fiber.Ctx) error {
	var input ImportRequest
	if err := c.BodyParser(&input); err != nil {
		return SendRequestError(c, 400, err)
	}
	if input.Mode != "iso" && input.Mode != "ai" {
		return SendRequestError(c, 400, fmt.Errorf("select ISO or AI"))
	}
	if len(input.Files) == 0 || len(input.Files) > 500 {
		return SendRequestError(c, 400, fmt.Errorf("select 1–500 files"))
	}
	defs, err := integrations.List()
	if err != nil {
		return SendRequestError(c, 500, err)
	}
	body := map[string]any{"mode": input.Mode, "files": input.Files, "instructions": input.Instructions, "integrations": defs}
	if input.Mode == "ai" {
		_, settings, err := getOpenAIClientForUser(c.Locals("user_id").(string))
		if err != nil {
			return SendRequestError(c, 400, err)
		}
		body["llm"] = map[string]string{"url": settings.APIURL, "key": settings.APIKey, "model": settings.APIModel}
		// Recognition needs each integration's native API contract, not just its
		// display name (e.g. DEVSimPy's integration accepts native PyPDEVS).
		contexts := make([]map[string]string, 0, len(defs))
		for _, d := range defs {
			if !d.Capabilities.AI {
				continue
			}
			contract, err := d.ModelPrompt()
			if err != nil {
				return SendRequestError(c, 500, err)
			}
			text := []rune(contract)
			if len(text) > 16000 {
				text = text[:16000]
			}
			contexts = append(contexts, map[string]string{"id": d.ID, "version": d.Version, "framework": d.Framework, "language": d.Language, "contract": string(text)})
		}
		body["integrationContexts"] = contexts
		if input.TargetID != "" {
			d, err := integrations.Resolve(input.TargetID, input.TargetVersion, "")
			if err != nil {
				return SendRequestError(c, 400, err)
			}
			context, err := d.ModelPrompt()
			if err != nil {
				return SendRequestError(c, 500, err)
			}
			body["target"] = map[string]any{"id": d.ID, "version": d.Version, "language": d.Language, "framework": d.Framework, "instructions": context}
		}
	} else if input.TargetID != "" {
		return SendRequestError(c, 400, fmt.Errorf("framework conversion requires AI mode"))
	}
	status, data, err := workerRequest(c, "POST", "/jobs", body)
	if err != nil {
		return SendRequestError(c, 503, err)
	}
	return c.Status(status).Type("json").Send(data)
}

func loadImport(c *fiber.Ctx) (ImportJob, error) {
	var job ImportJob
	if !importJobID.MatchString(c.Params("id")) {
		return job, fmt.Errorf("invalid import id")
	}
	status, data, err := workerRequest(c, "GET", "/jobs/"+c.Params("id"), nil)
	if err != nil {
		return job, err
	}
	if status != 200 {
		return job, fmt.Errorf("import not found, expired or unavailable")
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	if err = decoder.Decode(&job); err != nil {
		return job, err
	}
	if job.Package != nil {
		if err = job.Package.Validate(); err != nil {
			return job, err
		}
		resolveImportedProfiles(job.Package)
	}
	return job, nil
}

func resolveImportedProfiles(p *exchange.Package) {
	defs, _ := integrations.List()
	for i := range p.Models {
		m := &p.Models[i]
		if m.Type != "atomic" {
			continue
		}
		var match *integrations.Definition
		for j := range defs {
			d := &defs[j]
			explicit := m.IntegrationID == d.ID && m.IntegrationVersion == d.Version
			runner := m.RunnerID == d.ID+"@"+d.Version
			family := strings.EqualFold(m.Framework, d.Framework) || slices.ContainsFunc(d.FrameworkAliases, func(alias string) bool { return strings.EqualFold(m.Framework, alias) })
			framework := m.IntegrationID == "" && m.RunnerID == "" && family && m.Language == d.Language
			matched := explicit
			if m.IntegrationID == "" {
				matched = runner || framework
			}
			if matched && (m.Language == "" || m.Language == d.Language) {
				if match != nil {
					match = nil
					break
				}
				match = d
			}
		}
		if match == nil {
			if m.Original == nil {
				m.Original = map[string]any{"integrationId": m.IntegrationID, "integrationVersion": m.IntegrationVersion, "runnerId": m.RunnerID, "framework": m.Framework, "language": m.Language}
			}
			m.IntegrationID = ""
			m.IntegrationVersion = ""
			m.BlockedReason = "This framework is not installed. The model can be stored and edited, but cannot be simulated or used in an experimental frame."
		} else {
			m.IntegrationID = match.ID
			m.IntegrationVersion = match.Version
			m.Language = match.Language
			m.Dependencies = slices.DeleteFunc(m.Dependencies, func(dependency string) bool {
				return slices.Contains(match.ProvidedLibraries, dependency)
			})
		}
		if strings.TrimSpace(m.Code) == "" {
			m.BlockedReason = "No executable source code was supplied."
		}
		for _, source := range m.Files {
			if source != m.Code {
				m.BlockedReason = "Auxiliary source files are preserved; multifile execution is not yet supported."
			}
		}
		if len(m.Dependencies) > 0 {
			m.BlockedReason = "External dependencies require execution environment support: " + strings.Join(m.Dependencies, "; ")
		}
		if len(m.Missing) > 0 {
			m.BlockedReason = "Import requires additional information: " + strings.Join(m.Missing, "; ")
		}
		if reason := services.ImportedSourceIssue(m.IntegrationID, m.Code); reason != "" {
			m.BlockedReason = reason
		}
	}
}

// @Summary Get import progress and preview
// @Tags Imports
// @Produce json
// @Param id path string true "Import id"
// @Success 200 {object} ImportJob
// @Router /imports/{id} [get]
func getImport(c *fiber.Ctx) error {
	job, err := loadImport(c)
	if err != nil {
		return SendRequestError(c, 400, err)
	}
	c.Set("Cache-Control", "no-store")
	return c.JSON(job)
}

// @Summary Cancel and discard an import
// @Tags Imports
// @Param id path string true "Import id"
// @Success 200 {object} map[string]string
// @Router /imports/{id} [delete]
func cancelImport(c *fiber.Ctx) error {
	if !importJobID.MatchString(c.Params("id")) {
		return SendRequestError(c, 400, fmt.Errorf("invalid import id"))
	}
	status, data, err := workerRequest(c, "DELETE", "/jobs/"+c.Params("id"), nil)
	if err != nil {
		return SendRequestError(c, 503, err)
	}
	return c.Status(status).Type("json").Send(data)
}

// @Summary Save reviewed models as new copies in a library
// @Tags Imports
// @Accept json
// @Produce json
// @Param id path string true "Import id"
// @Param body body CommitImportRequest true "Destination and review confirmation"
// @Success 200 {object} ImportResult
// @Router /imports/{id}/commit [post]
func commitImport(c *fiber.Ctx) error {
	var input CommitImportRequest
	if err := c.BodyParser(&input); err != nil {
		return SendRequestError(c, 400, err)
	}
	if !input.Reviewed {
		return SendRequestError(c, 400, fmt.Errorf("review the preview and confirm before importing"))
	}
	user := c.Locals("user_id").(string)
	var library model.Library
	if err := database.DB.First(&library, "id=? AND user_id=?", input.LibraryID, user).Error; err != nil {
		return SendRequestError(c, 404, fmt.Errorf("destination library not found"))
	}
	// Receipts outlive worker drafts, including after expiry or cache eviction.
	var receipt struct{ Result string }
	if err := database.DB.Raw("SELECT result::text FROM model_imports WHERE user_id=? AND job_id=?", user, c.Params("id")).Scan(&receipt).Error; err != nil {
		return SendRequestError(c, 500, err)
	}
	if receipt.Result != "" {
		var result ImportResult
		if err := json.Unmarshal([]byte(receipt.Result), &result); err != nil {
			return SendRequestError(c, 500, err)
		}
		return c.JSON(result)
	}
	job, err := loadImport(c)
	if err != nil {
		return SendRequestError(c, 400, err)
	}
	if job.State != "ready" || job.Package == nil {
		return SendRequestError(c, 409, fmt.Errorf("import is not ready"))
	}
	if input.Revision != 0 && input.Revision != job.Revision {
		return SendRequestError(c, 409, fmt.Errorf("the draft changed; review the latest revision before saving"))
	}
	if job.Revision > 0 {
		status, _, err := workerRequest(c, "POST", "/jobs/"+job.ID+"/seal", map[string]int{"revision": job.Revision})
		if err != nil || status != 200 {
			return SendRequestError(c, 409, fmt.Errorf("could not lock this draft revision for saving; refresh and retry"))
		}
	}
	result := ImportResult{RootIDs: []string{}, ModelIDs: []string{}}
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", user+job.ID).Error; err != nil {
			return err
		}
		var previous struct{ Result string }
		if err := tx.Raw("SELECT result::text FROM model_imports WHERE user_id=? AND job_id=?", user, job.ID).Scan(&previous).Error; err != nil {
			return err
		}
		if previous.Result != "" {
			return json.Unmarshal([]byte(previous.Result), &result)
		}
		ids := map[string]string{}
		for _, spec := range job.Package.Models {
			document := map[string]any{}
			data, _ := json.Marshal(spec)
			decoder := json.NewDecoder(bytes.NewReader(data))
			decoder.UseNumber()
			_ = decoder.Decode(&document)
			m := model.Model{UserID: user, LibID: &input.LibraryID, Name: spec.Name, Type: enum.ModelType(spec.Type), Code: spec.Code, Description: spec.Description, Ports: append([]modeljson.ModelPort{}, spec.Ports...), Components: []modeljson.ModelComponent{}, Connections: []modeljson.ModelConnection{}, Metadata: defaultImportedMetadata(), ImportSource: &modeljson.ImportSource{Language: spec.Language, Framework: spec.Framework, Reason: spec.BlockedReason, Document: document}}
			m.Metadata.Parameters = spec.Parameters
			// Coupled definitions are platform assemblies. Their source framework
			// remains in provenance; execution profiles belong to atomic leaves only.
			// SkipHooks bypasses Model.BeforeCreate, so enforce this here too.
			if spec.Type == "atomic" && spec.IntegrationID != "" {
				id, version := spec.IntegrationID, spec.IntegrationVersion
				m.IntegrationID = &id
				m.IntegrationVersion = &version
			}
			if len(job.Package.Roots) > 0 && spec.ID == job.Package.Roots[0] {
				m.ImportSource.Assets = job.Package.Assets
				m.ImportSource.Document["importReview"] = map[string]any{"messages": job.Messages, "attempts": job.Attempts, "changes": job.Changes, "revision": job.Revision, "verification": job.Verification}
			}
			for j := range m.Ports {
				m.Ports[j].ID = m.Ports[j].Name
			}
			// Profiles were validated once for this package; keep the database constraints
			// and serializers, without rehashing the whole integration catalogue per row.
			if err := tx.Session(&gorm.Session{SkipHooks: true}).Create(&m).Error; err != nil {
				return err
			}
			ids[spec.ID] = m.ID
			result.ModelIDs = append(result.ModelIDs, m.ID)
		}
		for _, spec := range job.Package.Models {
			components := []modeljson.ModelComponent{}
			occurrences := map[string]string{"root": "root"}
			for _, component := range spec.Components {
				occurrences[component.InstanceID] = uuid.NewString()
			}
			for index, c := range spec.Components {
				meta := defaultImportedMetadata()
				meta.Position = modeljson.ModelPosition{X: float64(index%4)*260 + 40, Y: float64(index/4)*260 + 60}
				if len(c.ParameterOverrides) > 0 {
					for _, child := range job.Package.Models {
						if child.ID == c.ModelID {
							for _, p := range child.Parameters {
								if v, ok := c.ParameterOverrides[p.Name]; ok {
									p.Value = v
								}
								meta.Parameters = append(meta.Parameters, p)
							}
						}
					}
				}
				components = append(components, modeljson.ModelComponent{InstanceID: occurrences[c.InstanceID], ModelID: ids[c.ModelID], InstanceMetadata: &meta})
			}
			connections := append([]modeljson.ModelConnection{}, spec.Connections...)
			for i := range connections {
				connections[i].From.InstanceID = occurrences[connections[i].From.InstanceID]
				connections[i].To.InstanceID = occurrences[connections[i].To.InstanceID]
			}
			if err := tx.Model(&model.Model{}).Where("id=? AND user_id=?", ids[spec.ID], user).Updates(map[string]any{"components": mustJSON(components), "connections": mustJSON(connections)}).Error; err != nil {
				return err
			}
		}
		for _, id := range job.Package.Roots {
			result.RootIDs = append(result.RootIDs, ids[id])
		}
		return tx.Exec("INSERT INTO model_imports(user_id,job_id,result) VALUES(?,?,?::jsonb)", user, job.ID, mustJSON(result)).Error
	})
	if err != nil {
		return SendRequestError(c, 500, err)
	}
	return c.JSON(result)
}
func mustJSON(v any) string { data, _ := json.Marshal(v); return string(data) }
func defaultImportedMetadata() modeljson.ModelMetadata {
	return modeljson.ModelMetadata{Keyword: []string{}, Position: modeljson.ModelPosition{}, Style: modeljson.ModelStyle{Width: 220, Height: 220}}
}

// @Summary Get model execution availability including nested components
// @Tags models
// @Produce json
// @Param id path string true "Model id"
// @Success 200 {object} ModelCapabilities
// @Router /model/{id}/capabilities [get]
func modelCapabilities(c *fiber.Ctx) error {
	// Implemented through the same server-side guard used by execution endpoints.
	err := checkImportedModel(c.Params("id"), c.Locals("user_id").(string))
	if err != nil {
		return c.JSON(ModelCapabilities{Simulation: false, Reason: err.Error()})
	}
	return c.JSON(ModelCapabilities{Simulation: true, Reason: ""})
}

func checkImportedModel(id, user string) error { return services.CheckModelSimulation(id, user) }
