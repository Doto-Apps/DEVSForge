package types

type CleanResponse struct {
	Success bool `json:"success"`
	Deleted int  `json:"deleted,omitempty"`
}
