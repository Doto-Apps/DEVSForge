package request

type UpdateUserAISettingsRequest struct {
	APIURL   *string `json:"apiUrl,omitempty" example:"https://api.openai.com/v1"`
	APIKey   *string `json:"apiKey,omitempty" example:"sk-..."`
	APIModel *string `json:"apiModel,omitempty" example:"gpt-4.1-mini"`
}
