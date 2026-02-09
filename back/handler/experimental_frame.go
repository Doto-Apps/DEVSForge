package handler

import (
	"errors"

	"devsforge/database"
	"devsforge/enum"
	"devsforge/middleware"
	"devsforge/model"
	"devsforge/request"
	"devsforge/response"

	"github.com/gofiber/fiber/v2"
)

// SetupExperimentalFrameRoutes configures experimental-frame related routes
func SetupExperimentalFrameRoutes(app *fiber.App) {
	group := app.Group("/experimental-frame", middleware.Protected())

	group.Post("", createExperimentalFrame)
	group.Get("/:id", getExperimentalFrame)
	group.Delete("/:id", deleteExperimentalFrame)
	group.Get("/model/:modelId", getExperimentalFramesByModel)
}

// createExperimentalFrame creates a link between a target model and an experimental-frame model.
//
//	@Summary		Create an experimental frame
//	@Description	Create an experimental frame association (target model -> coupled frame model)
//	@Tags			experimental-frames
//	@Accept			json
//	@Produce		json
//	@Param			body	body		request.ExperimentalFrameRequest	true	"Experimental frame data"
//	@Success		201		{object}	response.ExperimentalFrameResponse
//	@Failure		400		{object}	map[string]interface{}
//	@Failure		404		{object}	map[string]interface{}
//	@Failure		500		{object}	map[string]interface{}
//	@Router			/experimental-frame [post]
func createExperimentalFrame(c *fiber.Ctx) error {
	db := database.DB
	userID := c.Locals("user_id").(string)

	req := new(request.ExperimentalFrameRequest)
	if err := c.BodyParser(req); err != nil {
		return SendRequestError(c, fiber.StatusBadRequest, err)
	}

	if req.TargetModelID == "" || req.FrameModelID == "" {
		return SendRequestError(c, fiber.StatusBadRequest, errors.New("targetModelId and frameModelId are required"))
	}

	if req.TargetModelID == req.FrameModelID {
		return SendRequestError(c, fiber.StatusBadRequest, errors.New("targetModelId and frameModelId must be different"))
	}

	var targetModel model.Model
	if err := db.First(&targetModel, "user_id = ? AND id = ?", userID, req.TargetModelID).Error; err != nil {
		return SendRequestError(c, fiber.StatusNotFound, errors.New("target model not found"))
	}

	var frameModel model.Model
	if err := db.First(&frameModel, "user_id = ? AND id = ?", userID, req.FrameModelID).Error; err != nil {
		return SendRequestError(c, fiber.StatusNotFound, errors.New("frame model not found"))
	}

	if frameModel.Type != enum.Coupled {
		return SendRequestError(c, fiber.StatusBadRequest, errors.New("frame model must be of type coupled"))
	}

	ef := req.ToModel(userID)
	if err := db.Create(&ef).Error; err != nil {
		return SendRequestError(c, fiber.StatusBadRequest, err)
	}

	return c.Status(fiber.StatusCreated).JSON(response.CreateExperimentalFrameResponse(ef))
}

// getExperimentalFramesByModel retrieves all experimental frames linked to a target model.
//
//	@Summary		Get experimental frames by model
//	@Description	Retrieve all experimental frames linked to a target model
//	@Tags			experimental-frames
//	@Produce		json
//	@Param			modelId	path		string	true	"Target model ID"
//	@Success		200		{object}	[]response.ExperimentalFrameResponse
//	@Failure		404		{object}	map[string]interface{}
//	@Failure		500		{object}	map[string]interface{}
//	@Router			/experimental-frame/model/{modelId} [get]
func getExperimentalFramesByModel(c *fiber.Ctx) error {
	db := database.DB
	modelID := c.Params("modelId")
	userID := c.Locals("user_id").(string)

	var targetModel model.Model
	if err := db.First(&targetModel, "user_id = ? AND id = ?", userID, modelID).Error; err != nil {
		return SendRequestError(c, fiber.StatusNotFound, errors.New("target model not found"))
	}

	var frames []model.ExperimentalFrame
	if err := db.Find(&frames, "user_id = ? AND target_model_id = ?", userID, modelID).Error; err != nil {
		return SendRequestError(c, fiber.StatusInternalServerError, err)
	}

	res := make([]response.ExperimentalFrameResponse, 0, len(frames))
	for _, frame := range frames {
		res = append(res, response.CreateExperimentalFrameResponse(frame))
	}

	return c.JSON(res)
}

// getExperimentalFrame retrieves a single experimental frame by ID.
//
//	@Summary		Get an experimental frame
//	@Description	Retrieve a single experimental frame by its ID
//	@Tags			experimental-frames
//	@Produce		json
//	@Param			id	path		string	true	"Experimental frame ID"
//	@Success		200	{object}	response.ExperimentalFrameResponse
//	@Failure		404	{object}	map[string]interface{}
//	@Router			/experimental-frame/{id} [get]
func getExperimentalFrame(c *fiber.Ctx) error {
	db := database.DB
	id := c.Params("id")
	userID := c.Locals("user_id").(string)

	var frame model.ExperimentalFrame
	if err := db.First(&frame, "user_id = ? AND id = ?", userID, id).Error; err != nil {
		return SendRequestError(c, fiber.StatusNotFound, errors.New("experimental frame not found"))
	}

	return c.JSON(response.CreateExperimentalFrameResponse(frame))
}

// deleteExperimentalFrame deletes an experimental frame by ID.
//
//	@Summary		Delete an experimental frame
//	@Description	Delete an experimental frame by its ID
//	@Tags			experimental-frames
//	@Param			id	path		string	true	"Experimental frame ID"
//	@Success		204	{object}	map[string]interface{}
//	@Failure		404	{object}	map[string]interface{}
//	@Router			/experimental-frame/{id} [delete]
func deleteExperimentalFrame(c *fiber.Ctx) error {
	db := database.DB
	id := c.Params("id")
	userID := c.Locals("user_id").(string)

	var frame model.ExperimentalFrame
	if err := db.First(&frame, "user_id = ? AND id = ?", userID, id).Error; err != nil {
		return SendRequestError(c, fiber.StatusNotFound, errors.New("experimental frame not found"))
	}

	if err := db.Delete(&frame).Error; err != nil {
		return SendRequestError(c, fiber.StatusInternalServerError, err)
	}

	return c.Status(fiber.StatusNoContent).JSON(fiber.Map{"status": "success", "message": "Experimental frame successfully deleted", "data": nil})
}
