package response

type UserAISettingsResponse struct {
	APIURL       string `json:"apiUrl"`
	APIModel     string `json:"apiModel"`
	HasAPIKey    bool   `json:"hasApiKey"`
	APIKeyMasked string `json:"apiKeyMasked,omitempty"`
}
