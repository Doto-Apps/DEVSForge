package json

// ImportSource preserves the external identity and evidence independently of runtime profiles.
type ImportSource struct {
	Language  string         `json:"language"`
	Framework string         `json:"framework"`
	Reason    string         `json:"reason"`
	Document  map[string]any `json:"document"`
	Assets    map[string]any `json:"assets"`
}
