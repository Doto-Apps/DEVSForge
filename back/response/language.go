package response

// LanguageInfo represents a programming language available for DEVS models
type LanguageInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Extension   string `json:"extension"`
	Description string `json:"description"`
}

// LanguageListResponse is the response for GET /languages
type LanguageListResponse struct {
	Languages []LanguageInfo `json:"languages"`
}

// LanguageTemplateResponse is the response for GET /languages/:lang/template
type LanguageTemplateResponse struct {
	Language string `json:"language"`
	Code     string `json:"code"`
}
