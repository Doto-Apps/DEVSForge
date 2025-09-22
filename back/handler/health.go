package handler

import (
	"github.com/gofiber/fiber/v2"
)

// SetupHealthRoutes configures the health check route
func SetupHealthRoutes(router fiber.Router) {
	group := router.Group("/health")
	group.Get("/", health)
}

// Health Check
// @Summary API health check
// @Description Returns the status of the API to confirm it is running
// @Tags Health
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "API is running"
// @Router /health [get]
func health(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"status": "success", "message": "ok", "data": nil})
}
