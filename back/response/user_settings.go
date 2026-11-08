package response

type UserAISettingsResponse struct {
	APIURL                    string `json:"apiUrl"`
	APIModel                  string `json:"apiModel"`
	HasAPIKey                 bool   `json:"hasApiKey"`
	APIKeyMasked              string `json:"apiKeyMasked,omitempty"`
	TranscriptionAPIURL       string `json:"transcriptionApiUrl"`
	TranscriptionAPIModel     string `json:"transcriptionApiModel"`
	HasTranscriptionAPIKey    bool   `json:"hasTranscriptionApiKey"`
	TranscriptionAPIKeyMasked string `json:"transcriptionApiKeyMasked,omitempty"`
}

type AIProviderModelResponse struct {
	ID string `json:"id"`
}
type AIProviderModelsResponse struct {
	Models []AIProviderModelResponse `json:"models"`
}
type TranscriptionResponse struct {
	Text string `json:"text"`
}
