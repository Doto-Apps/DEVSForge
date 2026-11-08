package request

type UpdateUserAISettingsRequest struct {
	APIURL                *string `json:"apiUrl,omitempty" example:"https://api.openai.com/v1"`
	APIKey                *string `json:"apiKey,omitempty" example:"sk-..."`
	APIModel              *string `json:"apiModel,omitempty" example:"gpt-4.1-mini"`
	TranscriptionAPIURL   *string `json:"transcriptionApiUrl,omitempty"`
	TranscriptionAPIKey   *string `json:"transcriptionApiKey,omitempty"`
	TranscriptionAPIModel *string `json:"transcriptionApiModel,omitempty"`
}

// ListAIModelsRequest can discover models with unsaved connection details.
// Omitting apiKey reuses the saved key only when the URL has not changed.
type ListAIModelsRequest struct {
	Purpose string  `json:"purpose" enums:"generation,transcription"`
	APIURL  *string `json:"apiUrl,omitempty"`
	APIKey  *string `json:"apiKey,omitempty"`
}
