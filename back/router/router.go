package router

import (
	"devsforge/back/handler"

	"github.com/gofiber/fiber/v2"
)

// SetupRoutes setup router api
func SetupRoutes(app *fiber.App) {

	// Health
	handler.SetupHealthRoutes(app)

	// Auth
	handler.SetupAuthRoutes(app)

	// User
	handler.SetupUserRoutes(app)

	// Library
	handler.SetupLibraryRoutes(app)

	// Diagram
	handler.SetupDiagramRoutes(app)

	// Model
	handler.SetupModelRoutes(app)

	// Workspace
	handler.SetupWorkspaceRoutes(app)

	// AI
	handler.SetupAiRoutes(app)
}
