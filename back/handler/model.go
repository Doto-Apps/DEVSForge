package handler

import (
	"fmt"

	"devsforge/database"
	"devsforge/lib"
	"devsforge/middleware"
	"devsforge/model"
	"devsforge/request"
	"devsforge/response"
	"devsforge/services"

	"github.com/gofiber/fiber/v2"
)

// SetupModelRoutes configures model-related routes
func SetupModelRoutes(app *fiber.App) {
	group := app.Group("/model", middleware.Protected())

	group.Get("", getAllModels)
	group.Get("/:id", getModel)
	group.Post("", createModel)
	group.Delete("/:id", deleteModel)
	group.Patch("/:id", patchModel)
	group.Get("/:id/recursive", getModelRecursive)
	group.Get("/:id/simulate", generateSimulationFile)
	group.Get("/:id/manifest", getModelManifest)
}

// getAllModels retrieves a list of all models
//
//	@Summary		Get all models
//	@Description	Retrieve a list of all models
//	@Tags			models
//	@Produce		json
//	@Success		200	{object}	[]response.ModelResponse
//	@Failure		500	{object}	map[string]any
//	@Router			/model [get]
func getAllModels(c *fiber.Ctx) error {
	db := database.DB
	var models []model.Model
	db.Find(&models, "user_id = ?", c.Locals("user_id").(string))

	res := []response.ModelResponse{}

	for _, model := range models {
		res = append(res, response.CreateModelResponse(model))
	}
	return c.JSON(res)
}

// getModel retrieves a single model by ID
//
//	@Summary		Get a model by ID
//	@Description	Retrieve a single model by its ID
//	@Tags			models
//	@Produce		json
//	@Param			id	path		string	true	"Model ID"
//	@Success		200	{object}	response.ModelResponse
//	@Failure		404	{object}	map[string]any
//	@Router			/model/{id} [get]
func getModel(c *fiber.Ctx) error {
	id := c.Params("id")
	db := database.DB
	var model model.Model
	db.Find(&model, "user_id = ? AND id = ?", c.Locals("user_id").(string), id)
	if model.Name == "" {
		return SendRequestError(c, fiber.StatusNotFound, nil)
	}

	res := response.CreateModelResponse(model)

	return c.JSON(res)
}

// getModel retrieves a single model by ID
//
//	@Summary		Get a model by ID
//	@Description	Retrieve a single model by its ID
//	@Tags			models
//	@Produce		json
//	@Param			id	path		string	true	"Model ID"
//	@Success		200	{object}	[]response.ModelResponse
//	@Failure		404	{object}	map[string]any
//	@Router			/model/{id}/recursive [get]
func getModelRecursive(c *fiber.Ctx) error {
	res := make([]response.ModelResponse, 0)
	models, err := services.GetModelRecursice(c.Params("id"), c.Locals("user_id").(string))
	if err != nil {
		return SendRequestError(c, fiber.StatusInternalServerError, err)
	}
	for _, model := range models {
		res = append(res, response.CreateModelResponse(model))
	}
	return c.JSON(res)
}

// createModel creates a new model
//
//	@Summary		Create a model
//	@Description	Create a new model entry
//	@Tags			models
//	@Accept			json
//	@Produce		json
//	@Param			model	body		request.ModelRequest	true	"Model data"
//	@Success		201		{object}	response.ModelResponse
//	@Failure		400		{object}	map[string]any
//	@Failure		500		{object}	map[string]any
//	@Router			/model [post]
func createModel(c *fiber.Ctx) error {
	db := database.DB
	req := new(request.ModelRequest)
	if err := c.BodyParser(req); err != nil {
		return SendRequestError(c, fiber.StatusBadRequest, err)
	}

	model := req.ToModel(c.Locals("user_id").(string))

	db.Create(&model)

	res := response.CreateModelResponse(model)

	return c.JSON(res)
}

// deleteModel deletes a model by its ID
//
//	@Summary		Delete a model
//	@Description	Delete a model by its ID
//	@Tags			models
//	@Param			id	path		string	true	"Model ID"
//	@Success		204	{object}	map[string]any
//	@Failure		404	{object}	map[string]any
//	@Router			/model/{id} [delete]
func deleteModel(c *fiber.Ctx) error {
	id := c.Params("id")
	db := database.DB

	var model model.Model
	db.First(&model, "user_id = ? AND id = ?", c.Locals("user_id").(string), id)
	if model.Name == "" {
		return SendRequestError(c, fiber.StatusNotFound, nil)
	}
	db.Delete(&model)
	return c.Status(fiber.StatusNoContent).JSON(fiber.Map{"status": "success", "message": "Model successfully deleted", "data": nil})
}

// patchModel updates an existing model by its ID
//
//	@Summary		Update a model
//	@Description	Update an existing model with partial data
//	@Tags			models
//	@Accept			json
//	@Produce		json
//	@Param			id			path		string					true	"Model ID"
//	@Param			updateData	body		request.ModelRequest	true	"Fields to update"
//	@Success		200			{object}	response.ModelResponse
//	@Failure		400			{object}	map[string]any
//	@Failure		404			{object}	map[string]any
//	@Router			/model/{id} [patch]
func patchModel(c *fiber.Ctx) error {
	db := database.DB
	id := c.Params("id")

	var model model.Model
	if err := db.First(&model, "user_id = ? AND id = ?", c.Locals("user_id").(string), id).Error; err != nil {
		return SendRequestError(c, fiber.StatusNotFound, err)
	}

	req := new(request.ModelRequest)
	if err := c.BodyParser(&req); err != nil {
		return SendRequestError(c, fiber.StatusBadRequest, err)
	}

	// Debug log
	fmt.Printf("DEBUG - Received metadata.ModelRole: %v\n", req.Metadata.ModelRole)
	fmt.Printf("DEBUG - Received metadata.Keyword: %v\n", req.Metadata.Keyword)

	modelUpdate := req.ToModel(model.UserID)

	db.Omit("LibID", "ID", "UserID").Model(&model).UpdateColumns(modelUpdate)

	if err := db.First(&model, "user_id = ? AND id = ?", c.Locals("user_id").(string), id).Error; err != nil {
		return SendRequestError(c, fiber.StatusInternalServerError, err)
	}

	res := response.CreateModelResponse(model)

	return c.JSON(res)
}

// generateSimulationFile generate a zip that will contain all infromations for simulation
//
//	@Summary		Generate simulations files
//	@Description	generateSimulationFile generate a zip that will contain all infromations for simulation
//	@Tags			models
//	@Produce		json
//	@Param			id	path		string	true	"Model ID"
//	@Success		200	{object}	map[string]any
//	@Failure		400	{object}	map[string]any
//	@Failure		404	{object}	map[string]any
//	@Router			/model/{id}/simulate [get]
func generateSimulationFile(c *fiber.Ctx) error {
	models, err := services.GetModelRecursice(c.Params("id"), c.Locals("user_id").(string))
	if err != nil && err.Error() == "MODEL_NOT_FOUND" {
		return SendRequestError(c, fiber.StatusNotFound, err)
	}
	res, err := lib.GetDevsSympyJSON(models, c.Params("id"))
	if err != nil {
		return SendRequestError(c, fiber.StatusInternalServerError, err)
	}

	return c.JSON(res)
}

// getModelManifest generates and returns the DEVS manifest for a model
//
//	@Summary		Generate model manifest
//	@Description	Generate and retrieve the DEVS manifest for a model (without creating a simulation)
//	@Tags			models
//	@Produce		json
//	@Param			id		path		string							true	"Model ID"
//	@Param			body	body		request.SimulationStartRequest	false	"Optional: maxTime and runtime overrides"
//	@Success		200		{object}	response.ManifestResponse
//	@Failure		400		{object}	map[string]any
//	@Failure		404		{object}	map[string]any
//	@Failure		500		{object}	map[string]any
//	@Router			/model/{id}/manifest [get]
func getModelManifest(c *fiber.Ctx) error {
	modelID := c.Params("id")
	userID := c.Locals("user_id").(string)

	if modelID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Model ID is required",
		})
	}

	// Parse optional request body for runtime overrides
	var req request.SimulationStartRequest
	_ = c.BodyParser(&req) // Ignore error if body is empty

	runtimeOverrides := make([]lib.RuntimeInstanceOverride, 0, len(req.Overrides))
	for _, override := range req.Overrides {
		params := make([]lib.RuntimeParameterOverride, 0, len(override.OverrideParams))
		for _, param := range override.OverrideParams {
			params = append(params, lib.RuntimeParameterOverride{
				Name:  param.Name,
				Value: param.Value,
			})
		}
		runtimeOverrides = append(runtimeOverrides, lib.RuntimeInstanceOverride{
			InstanceModelID: override.InstanceModelID,
			OverrideParams:  params,
		})
	}

	// Get models recursively
	models, err := services.GetModelRecursice(modelID, userID)
	if err != nil {
		return SendRequestError(c, fiber.StatusInternalServerError, err)
	}

	// Generate manifest (use a temporary simulation ID)
	manifest, err := lib.ModelToManifest(models, modelID, "temp", req.MaxTime, runtimeOverrides)
	if err != nil {
		return SendRequestError(c, fiber.StatusInternalServerError, err)
	}

	return c.JSON(response.CreateManifestResponse(manifest))
}
