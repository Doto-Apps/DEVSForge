package prompt

import "devsforge-shared/integrations"

func GetTemplateContent(language string) (string, error) {
	d, err := integrations.Resolve("", "", language)
	if err != nil {
		return "", err
	}
	return d.RenderTemplate("MyModel")
}
func BuildModelPromptWithContext(language string) (string, error) {
	d, err := integrations.Resolve("", "", language)
	if err != nil {
		return "", err
	}
	return d.ModelPrompt()
}
