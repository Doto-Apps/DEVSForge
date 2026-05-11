package request

// LibraryRequest struct
type LibraryRequest struct {
	Title       string `json:"title" validate:"required"`
	Description string `json:"description" validate:"required"`
}

// LibraryPatchRequest struct
type LibraryPatchRequest struct {
	Title       *string `json:"title,omitempty"`
	Description *string `json:"description,omitempty"`
}
