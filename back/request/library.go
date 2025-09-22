package request

// LibraryRequest struct
type LibraryRequest struct {
	Title       string `json:"title" validate:"required"`
	Description string `json:"description" validate:"required"`
}
