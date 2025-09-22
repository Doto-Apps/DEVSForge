package response

type RegisterResponse struct {
	AccessToken  string       `json:"accessToken" validate:"required"`
	RefreshToken string       `json:"refreshToken" validate:"required"`
	User         UserResponse `json:"user" validate:"required"`
}

type LoginResponse struct {
	AccessToken  string `json:"accessToken" validate:"required"`
	RefreshToken string `json:"refreshToken" validate:"required"`
	Username     string `json:"username" validate:"required"`
	Email        string `json:"email" validate:"required"`
}

type RefreshResponse struct {
	AccessToken string `json:"accessToken" validate:"required"`
}
