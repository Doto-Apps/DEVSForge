package middleware

import (
	"devsforge/back/config"

	jwtware "github.com/gofiber/contrib/jwt"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

func onSuccessProtected(c *fiber.Ctx) error {
	jwt_user := c.Locals("user").(*jwt.Token)
	claims := jwt_user.Claims.(jwt.MapClaims)
	user_id := claims["user_id"].(string)

	c.Locals("user_id", user_id)

	return c.Next()
}

// Protected protect routes
func Protected() fiber.Handler {
	return jwtware.New(jwtware.Config{
		SigningKey:     jwtware.SigningKey{Key: []byte(config.Config("JWT_SECRET"))},
		ErrorHandler:   jwtError,
		SuccessHandler: onSuccessProtected,
	})
}

func jwtError(c *fiber.Ctx, err error) error {
	if err.Error() == "Missing or malformed JWT" {
		return c.Status(fiber.StatusBadRequest).
			JSON(fiber.Map{"status": "error", "message": "Missing or malformed JWT", "data": nil})
	}
	return c.Status(fiber.StatusUnauthorized).
		JSON(fiber.Map{"status": "error", "message": "Invalid or expired JWT", "data": nil})
}
