package handler

import (
	"devsforge/back/database"
	"devsforge/back/middleware"
	"devsforge/back/model"
	"devsforge/back/request"

	"github.com/gofiber/fiber/v2"
)

// SetupWorkspaceRoutes configures workspace-related routes
func SetupWorkspaceRoutes(app *fiber.App) {
	group := app.Group("/workspace", middleware.Protected())

	group.Get("", getAllWorkspaces)
	group.Get("/:id", getWorkspace)
	group.Post("", createWorkspace)
	group.Delete("/:id", deleteWorkspace)
	group.Patch("/:id", patchWorkspace)
}

// getAllWorkspaces retrieves a list of all workspace
// @Summary Get all workspace
// @Description Retrieve a list of all workspace
// @Tags workspace
// @Produce json
// @Success 200 {array} model.Workspace
// @Router /workspace [get]
func getAllWorkspaces(c *fiber.Ctx) error {
	db := database.DB
	var Workspaces []model.Workspace
	db.Find(&Workspaces, "user_id = ?", c.Locals("user_id").(string))
	return c.JSON(Workspaces)
}

// getWorkspace retrieves a single workspace by its ID
// @Summary Get a workspace by ID
// @Description Retrieve a single workspace by its ID
// @Tags workspace
// @Produce json
// @Param id path string true "Workspace ID"
// @Success 200 {object} model.Workspace
// @Failure 404 {object} map[string]interface{}
// @Router /workspace/{id} [get]
func getWorkspace(c *fiber.Ctx) error {
	id := c.Params("id")
	db := database.DB
	var workspace model.Workspace
	db.Find(&workspace, "user_id = ? AND id = ?", c.Locals("user_id").(string), id)
	if workspace.Title == "" {
		return c.Status(404).JSON(fiber.Map{"status": "error", "message": "No workspace found with ID", "data": nil})
	}
	return c.JSON(workspace)
}

// createWorkspace creates a new workspace
// @Summary Create a new workspace
// @Description Create a new workspace and store it in the database
// @Tags workspace
// @Accept json
// @Produce json
// @Param workspace body request.WorkspaceRequest true "Workspace object"
// @Success 201 {object} model.Workspace
// @Failure 500 {object} map[string]interface{}
// @Router /workspace [post]
func createWorkspace(c *fiber.Ctx) error {
	db := database.DB
	req := new(request.WorkspaceRequest)
	if err := c.BodyParser(req); err != nil {
		return c.Status(500).JSON(fiber.Map{"status": "error", "message": "Couldn't create workspace", "data": err})
	}

	workspace := model.Workspace{
		Title:       req.Title,
		Description: req.Description,
		UserID:      c.Locals("user_id").(string),
	}

	db.Create(&workspace)
	return c.JSON(workspace)
}

// deleteWorkspace deletes a workspace by its ID
// @Summary Delete a workspace by ID
// @Description Delete an existing workspace by its ID
// @Tags workspace
// @Param id path string true "Workspace ID"
// @Success 204 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Router /workspace/{id} [delete]
func deleteWorkspace(c *fiber.Ctx) error {
	id := c.Params("id")
	db := database.DB

	var workspace model.Workspace
	db.First(&workspace, "user_id = ? AND id = ?", c.Locals("user_id").(string), id)
	if workspace.Title == "" {
		return c.Status(404).JSON(fiber.Map{"status": "error", "message": "No workspace found with ID", "data": nil})
	}
	db.Delete(&workspace)
	return c.Status(fiber.StatusNoContent).JSON(fiber.Map{"status": "success", "message": "Workspace successfully deleted", "data": nil})
}

// patchWorkspace updates an existing workspace by its ID
// @Summary Update a workspace
// @Description Update an existing workspace with partial data
// @Tags workspace
// @Accept json
// @Produce json
// @Param id path string true "Workspace ID"
// @Param workspace body request.WorkspaceRequest true "Partial workspace update"
// @Success 200 {object} model.Workspace
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Router /workspace/{id} [patch]
func patchWorkspace(c *fiber.Ctx) error {
	db := database.DB
	id := c.Params("id")

	var workspace model.Workspace
	if err := db.First(&workspace, "user_id = ? AND id = ?", c.Locals("user_id").(string), id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"status": "error", "message": "Workspace not found"})
	}

	req := new(request.WorkspaceRequest)
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"status": "error", "message": "Invalid input", "data": err.Error()})
	}

	db.Model(&workspace).Updates(req)

	return c.JSON(workspace)
}
