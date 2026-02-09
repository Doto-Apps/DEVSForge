package router

import (
	"devsforge/handler"

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

	// Simulation
	handler.SetupSimulationRoutes(app)

	// Experimental Frame
	handler.SetupExperimentalFrameRoutes(app)

	// Languages
	handler.SetupLanguageRoutes(app)

	// AI
	handler.SetupAiRoutes(app)
}
