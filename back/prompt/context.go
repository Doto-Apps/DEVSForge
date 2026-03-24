package prompt

import (
	"devsforge/templates"
	"fmt"
)

// GetTemplateContent returns the template content for the given language
func GetTemplateContent(language string) (string, error) {
	var templatePath string
	switch language {
	case "go":
		templatePath = "go/atomic.tmpl"
	case "python":
		templatePath = "python/atomic.tmpl"
	default:
		return "", fmt.Errorf("unsupported language: %s", language)
	}

	content, err := templates.FS.ReadFile(templatePath)
	if err != nil {
		return "", fmt.Errorf("failed to read template: %w", err)
	}

	return string(content), nil
}

// BuildModelPromptWithContext returns the complete prompt with template context
func BuildModelPromptWithContext(language string) (string, error) {
	templateContent, err := GetTemplateContent(language)
	if err != nil {
		return "", err
	}
	return GetModelPrompt(language, templateContent), nil
}
