package response

import shared "devsforge-shared"

type ManifestResponse struct {
	Manifest *shared.RunnableManifest `json:"manifest"`
}

func CreateManifestResponse(m *shared.RunnableManifest) ManifestResponse {
	return ManifestResponse{
		Manifest: m,
	}
}
