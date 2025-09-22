package handler

import (
	"devsforge/back/database"
	"devsforge/back/json"
	"devsforge/back/middleware"
	"devsforge/back/model"
	"devsforge/back/request"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// SetupDiagramRoutes configures diagram-related routes
func SetupDiagramRoutes(app *fiber.App) {
	group := app.Group("/diagram", middleware.Protected())

	group.Get("", getAllDiagrams)
	group.Get("/:id", getDiagram)
	group.Post("", createDiagram)
	group.Patch("/:id", patchDiagram)
	group.Delete("/:id", deleteDiagram)
}

// getAllDiagrams retrieves all diagrams
// @Summary Get all diagrams
// @Description Retrieve a list of all diagrams
// @Tags diagrams
// @Produce json
// @Success 200 {array} model.Diagram
// @Failure 500 {object} map[string]interface{}
// @Router /diagram [get]
func getAllDiagrams(c *fiber.Ctx) error {
	db := database.DB
	var Diagrams []model.Diagram
	db.Find(&Diagrams, "user_id = ?", c.Locals("user_id").(string))
	return c.JSON(Diagrams)
}

// getDiagram retrieves a diagram by ID
// @Summary Get a diagram by ID
// @Description Retrieve a single diagram by its ID
// @Tags diagrams
// @Produce json
// @Param id path string true "Diagram ID"
// @Success 200 {object} model.Diagram
// @Failure 404 {object} map[string]interface{}
// @Router /diagram/{id} [get]
func getDiagram(c *fiber.Ctx) error {
	id := c.Params("id")
	db := database.DB
	var diagram model.Diagram
	db.Find(&diagram, "user_id = ? AND id = ?", c.Locals("user_id").(string), id)
	if diagram.Name == "" {
		return c.Status(404).JSON(fiber.Map{"status": "error", "message": "No diagram found with ID", "data": nil})
	}
	return c.JSON(diagram)
}

// createDiagram creates a new diagram
// @Summary Create a diagram
// @Description Create a new diagram entry
// @Tags diagrams
// @Accept json
// @Produce json
// @Param diagram body request.DiagramRequest true "Diagram data"
// @Success 201 {object} model.Diagram
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /diagram [post]
func createDiagram(c *fiber.Ctx) error {
	db := database.DB
	req := new(request.DiagramRequest)
	if err := c.BodyParser(req); err != nil {
		return c.Status(400).JSON(fiber.Map{"status": "error", "message": "Invalid request body", "data": err.Error()})
	}

	userID := c.Locals("user_id").(string)

	var diagram model.Diagram

	err := db.Transaction(func(tx *gorm.DB) error {
		devsModel := model.Model{
			LibID:       nil,
			Name:        req.Name,
			Description: req.Description,
			Type:        "coupled",
			Code:        "",
			UserID:      userID,
			Ports:       []json.ModelPort{},
			Components:  []json.ModelComponent{},
		}

		if err := tx.Create(&devsModel).Error; err != nil {
			return err
		}

		diagram = model.Diagram{
			Name:        req.Name,
			Description: req.Description,
			UserID:      userID,
			ModelID:     devsModel.ID,
			WorkspaceID: req.WorkspaceID,
		}

		if err := tx.Create(&diagram).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"status": "error", "message": "Failed to create diagram and model", "data": err.Error()})
	}

	return c.Status(201).JSON(diagram)
}

// patchDiagram updates an existing diagram by ID
// @Summary Update a diagram
// @Description Update an existing diagram with partial data
// @Tags diagrams
// @Accept json
// @Produce json
// @Param id path string true "Diagram ID"
// @Param updateData body request.DiagramRequest true "Fields to update"
// @Success 200 {object} model.Diagram
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Router /diagram/{id} [patch]
func patchDiagram(c *fiber.Ctx) error {
	db := database.DB
	id := c.Params("id")

	var diagram model.Diagram
	if err := db.First(&diagram, "user_id = ? AND id = ?", c.Locals("user_id").(string), id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"status": "error", "message": "Diagram not found"})
	}

	req := new(request.DiagramRequest)
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"status": "error", "message": "Invalid input", "data": err.Error()})
	}

	db.Model(&diagram).Updates(req)

	return c.JSON(diagram)
}

// deleteDiagram deletes a diagram by ID
// @Summary Delete a diagram
// @Description Delete a diagram by its ID
// @Tags diagrams
// @Param id path string true "Diagram ID"
// @Success 204 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Router /diagram/{id} [delete]
func deleteDiagram(c *fiber.Ctx) error {
	id := c.Params("id")
	db := database.DB

	var diagram model.Diagram
	db.First(&diagram, "user_id = ? AND id = ?", c.Locals("user_id").(string), id)
	if diagram.Name == "" {
		return c.Status(404).JSON(fiber.Map{"status": "error", "message": "No diagram found with ID", "data": nil})
	}
	db.Delete(&diagram)
	return c.Status(201).JSON(nil)
}
