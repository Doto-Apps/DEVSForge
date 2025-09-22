package response

type UserResponse struct {
	Username string `json:"username" validate:"required"`
	Email    string `json:"email" validate:"required"`
}
