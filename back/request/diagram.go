package request

// DiagramRequest struct
type DiagramRequest struct {
	Name        string `json:"name" validate:"required"`
	Description string `json:"description" validate:"required"`
	WorkspaceID string `json:"workspaceId" validate:"required"`
}
