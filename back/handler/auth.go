package handler

import (
	"errors"
	"net/mail"
	"time"

	"devsforge/back/config"
	"devsforge/back/database"
	"devsforge/back/middleware"
	"devsforge/back/model"
	"devsforge/back/request"
	"devsforge/back/response"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var jwtSecret = []byte(config.Config("JWT_SECRET"))
var refreshSecret = []byte(config.Config("REFRESH_TOKEN_SECRET"))

// SetupAuthRoutes defines the authentication routes.
func SetupAuthRoutes(app *fiber.App) {
	group := app.Group("/auth")
	group.Post("/login", login)
	group.Post("/refresh", refreshToken)
	group.Post("/logout", logout)
	group.Post("/register", register)
	group.Get("/me", middleware.Protected(), getCurrentUser)
}

// @Summary Register a new user
// @Description Registers a new user with the provided username, email, and password.
// @Tags Auth
// @Accept json
// @Produce json
// @Param input body request.RegisterRequest true "Register Request"
// @Success 200 {object} response.RegisterResponse
// @Failure 400 {object} map[string]interface{}
// @Failure 409 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /auth/register [post]
func register(c *fiber.Ctx) error {
	input := new(request.RegisterRequest)
	if err := c.BodyParser(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Invalid request", "errors": err.Error()})
	}

	validate := validator.New()
	if err := validate.Struct(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid request body", "errors": err.Error()})
	}

	db := database.DB
	var existingUser model.User

	// Check if the email or username already exists
	if err := db.Where("email = ? OR username = ?", input.Email, input.Username).First(&existingUser).Error; err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"status": "error", "message": "Username or Email already taken"})
	}

	// Hash the password
	hash, err := hashPassword(input.Password)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "Couldn't hash password", "errors": err.Error()})
	}

	// Create the user
	user := model.User{
		Username: input.Username,
		Email:    input.Email,
		Password: hash,
	}

	// Generate the tokens
	accessToken, err := generateToken(user.ID, jwtSecret, time.Minute*15)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "Failed to generate access token"})
	}

	refreshToken, err := generateToken(user.ID, refreshSecret, time.Hour*24*7)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "Failed to generate refresh token"})
	}

	// Store the refresh token
	user.RefreshToken = refreshToken
	if err := db.Create(&user).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "Couldn't create user", "errors": err.Error()})
	}

	// Return the tokens directly
	return c.JSON(response.RegisterResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User: response.UserResponse{
			Username: user.Username,
			Email:    user.Email,
		},
	})
}

// HashPassword hashes the password using bcrypt.
func hashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 14)
	return string(bytes), err
}

// CheckPasswordHash verifies the password hash.
func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

func getUserByEmail(e string) (*model.User, error) {
	db := database.DB
	var user model.User
	if err := db.Where(&model.User{Email: e}).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

func getUserByUsername(u string) (*model.User, error) {
	db := database.DB
	var user model.User
	if err := db.Where(&model.User{Username: u}).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

func valid(email string) bool {
	_, err := mail.ParseAddress(email)
	return err == nil
}

// GenerateToken generates a JWT token.
func generateToken(userID string, secret []byte, duration time.Duration) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(duration).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(secret)
}

// @Summary Log in a user
// @Description Logs in a user with the provided identity (email or username) and password.
// @Tags Auth
// @Accept json
// @Produce json
// @Param input body request.LoginRequest true "Login Request"
// @Success 200 {object} response.LoginResponse
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /auth/login [post]
func login(c *fiber.Ctx) error {
	input := new(request.LoginRequest)
	if err := c.BodyParser(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Invalid request", "errors": err.Error()})
	}

	identity := input.Identity
	pass := input.Password
	var userModel *model.User
	var err error

	if valid(identity) {
		userModel, err = getUserByEmail(identity)
	} else {
		userModel, err = getUserByUsername(identity)
	}

	if err != nil || userModel == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"status": "error", "message": "Invalid identity or password"})
	}

	if !CheckPasswordHash(pass, userModel.Password) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"status": "error", "message": "Invalid identity or password"})
	}

	// Generate tokens
	accessToken, err := generateToken(userModel.ID, jwtSecret, time.Minute*15)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "Failed to generate access token"})
	}

	refreshToken, err := generateToken(userModel.ID, refreshSecret, time.Hour*24*7)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "Failed to generate refresh token"})
	}

	// Store the refresh token in the database
	db := database.DB
	userModel.RefreshToken = refreshToken
	db.Save(userModel)

	return c.JSON(response.LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		Username:     userModel.Username,
		Email:        userModel.Email,
	})
}

// @Summary Refresh access token
// @Description Refreshes the access token using a valid refresh token.
// @Tags Auth
// @Accept json
// @Produce json
// @Param input body request.RefreshRequest true "Refresh Request"
// @Success 200 {object} response.RefreshResponse
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /auth/refresh [post]
func refreshToken(c *fiber.Ctx) error {
	var input request.RefreshRequest
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Invalid request"})
	}

	db := database.DB
	var user model.User

	// Check if the refresh token is valid in the database
	if err := db.Where("refresh_token = ?", input.RefreshToken).First(&user).Error; err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"status": "error", "message": "Invalid refresh token"})
	}

	// Verify the validity of the token
	token, err := jwt.Parse(input.RefreshToken, func(token *jwt.Token) (interface{}, error) {
		return refreshSecret, nil
	})

	if err != nil || !token.Valid {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"status": "error", "message": "Invalid refresh token"})
	}

	// Generate a new access token
	newAccessToken, err := generateToken(user.ID, jwtSecret, time.Minute*15)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "Failed to generate new access token"})
	}

	return c.JSON(response.RefreshResponse{
		AccessToken: newAccessToken,
	})
}

// @Summary Log out a user
// @Description Logs out a user by invalidating the refresh token.
// @Tags Auth
// @Accept json
// @Produce json
// @Param input body request.LogoutRequest true "Logout Request"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Router /auth/logout [post]
func logout(c *fiber.Ctx) error {
	var input request.LogoutRequest
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Invalid request"})
	}

	db := database.DB
	var user model.User

	// Check if the refresh token is valid in the database
	if err := db.Where("refresh_token = ?", input.RefreshToken).First(&user).Error; err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"status": "error", "message": "Invalid refresh token"})
	}

	// Remove the refresh token
	user.RefreshToken = ""
	db.Save(&user)

	return c.JSON(fiber.Map{"status": "success", "message": "User logged out"})
}

// @Summary Get current user
// @Description Returns the authenticated user's information based on the access token.
// @Tags Auth
// @Accept json
// @Produce json
// @Success 200 {object} response.UserResponse
// @Failure 401 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /auth/me [get]
func getCurrentUser(c *fiber.Ctx) error {
	db := database.DB

	user_id := c.Locals("user_id").(string)

	// Récupérer l'utilisateur en base de données
	var user model.User
	if err := db.First(&user, "id = ?", user_id).Error; err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"status": "error", "message": "User not found"})
	}

	// Retourner les infos utilisateur sans le mot de passe
	return c.JSON(response.UserResponse{
		Username: user.Username,
		Email:    user.Email,
	})
}
