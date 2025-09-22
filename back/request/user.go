package request

type UpdateUserRequest struct {
	Names string `json:"names" validate:"required"`
}

type PasswordRequest struct {
	Password string `json:"password" validate:"required"`
}
