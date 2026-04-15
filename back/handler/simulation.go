package handler

import (
	"devsforge/database"
	"devsforge/lib"
	"devsforge/middleware"
	"devsforge/model"
	"devsforge/request"
	"devsforge/response"
	"devsforge/services/simulation"
	"strconv"

	"github.com/gofiber/fiber/v2"
)

var simulationService = simulation.NewSimulationService()

// SetupSimulationRoutes configures simulation-related routes
func SetupSimulationRoutes(app *fiber.App) {
	// Protected routes
	group := app.Group("/simulation", middleware.Protected())

	group.Post("/:modelId", createSimulation)
	group.Post("/:simId/start", startSimulation)
	group.Get("/:simId", getSimulation)
	group.Get("/:simId/events", getSimulationEvents)
	group.Get("/model/:modelId", getSimulationsByModel)
	group.Get("", getUserSimulations)
}

// createSimulation creates a new simulation entry without starting it
//
//	@Summary		Create a simulation
//	@Description	Create a new simulation for the specified model (does not start it)
//	@Tags			simulations
//	@Accept			json
//	@Produce		json
//	@Param			modelId	path		string							true	"Model ID"
//	@Param			body	body		request.SimulationStartRequest	false	"Simulation parameters"
//	@Success		200		{object}	response.SimulationResponse
//	@Failure		400		{object}	map[string]any
//	@Failure		500		{object}	map[string]any
//	@Router			/simulation/{modelId} [post]
func createSimulation(c *fiber.Ctx) error {
	modelID := c.Params("modelId")
	userID := c.Locals("user_id").(string)

	if modelID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Model ID is required",
		})
	}

	// Parse optional request body
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

	// Create simulation entry (status: pending)
	simulation, err := simulationService.CreateSimulation(
		userID,
		modelID,
		req.MaxTime,
		runtimeOverrides,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(response.CreateSimulationResponse(*simulation))
}

// startSimulation starts an existing simulation
//
//	@Summary		Start a simulation
//	@Description	Start an existing simulation (call after WebSocket is connected)
//	@Tags			simulations
//	@Produce		json
//	@Param			simId	path		string	true	"Simulation ID"
//	@Success		200		{object}	response.SimulationResponse
//	@Failure		400		{object}	map[string]any
//	@Failure		404		{object}	map[string]any
//	@Failure		500		{object}	map[string]any
//	@Router			/simulation/{simId}/start [post]
func startSimulation(c *fiber.Ctx) error {
	simID := c.Params("simId")
	userID := c.Locals("user_id").(string)

	if simID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Simulation ID is required",
		})
	}

	// Verify simulation exists and belongs to user
	simulation, err := simulationService.GetSimulation(simID, userID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Simulation not found",
		})
	}

	// Check if simulation is in pending state
	if simulation.Status != model.SimulationStatusPending {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Simulation is not in pending state",
		})
	}

	// Start simulation
	if err := simulationService.StartSimulation(simulation.ID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(response.CreateSimulationResponse(*simulation))
}

// getSimulation retrieves a simulation by ID
//
//	@Summary		Get a simulation
//	@Description	Retrieve a simulation by its ID
//	@Tags			simulations
//	@Produce		json
//	@Param			simId	path		string	true	"Simulation ID"
//	@Success		200		{object}	response.SimulationResponse
//	@Failure		404		{object}	map[string]any
//	@Router			/simulation/{simId} [get]
func getSimulation(c *fiber.Ctx) error {
	simID := c.Params("simId")
	userID := c.Locals("user_id").(string)

	simulation, err := simulationService.GetSimulation(simID, userID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Simulation not found",
		})
	}

	return c.JSON(response.CreateSimulationResponse(*simulation))
}

// getSimulationsByModel retrieves all simulations for a model
//
//	@Summary		Get simulations by model
//	@Description	Retrieve all simulations for a specific model
//	@Tags			simulations
//	@Produce		json
//	@Param			modelId	path		string	true	"Model ID"
//	@Success		200		{object}	[]response.SimulationResponse
//	@Failure		500		{object}	map[string]any
//	@Router			/simulation/model/{modelId} [get]
func getSimulationsByModel(c *fiber.Ctx) error {
	modelID := c.Params("modelId")
	userID := c.Locals("user_id").(string)

	simulations, err := simulationService.GetSimulationsByModel(modelID, userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	result := make([]response.SimulationResponse, 0, len(simulations))
	for _, sim := range simulations {
		result = append(result, response.CreateSimulationResponse(sim))
	}

	return c.JSON(result)
}

// getUserSimulations retrieves all simulations for the current user
//
//	@Summary		Get user simulations
//	@Description	Retrieve all simulations for the authenticated user
//	@Tags			simulations
//	@Produce		json
//	@Success		200	{object}	[]response.SimulationResponse
//	@Failure		500	{object}	map[string]any
//	@Router			/simulation [get]
func getUserSimulations(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)

	simulations, err := simulationService.GetUserSimulations(userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	result := make([]response.SimulationResponse, 0, len(simulations))
	for _, sim := range simulations {
		result = append(result, response.CreateSimulationResponse(sim))
	}

	return c.JSON(result)
}

// getSimulationEvents retrieves all DEVS events for a simulation
//
//	@Summary		Get simulation events
//	@Description	Retrieve all DEVS messages that transited during a simulation (includes simulation status for polling)
//	@Tags			simulations
//	@Produce		json
//	@Param			simId	path		string	true	"Simulation ID"
//	@Param			limit	query		int		false	"Maximum number of events (default: 1000)"
//	@Param			offset	query		int		false	"Offset for pagination (default: 0)"
//	@Success		200		{object}	response.SimulationEventsResponse
//	@Failure		404		{object}	map[string]any
//	@Router			/simulation/{simId}/events [get]
func getSimulationEvents(c *fiber.Ctx) error {
	simID := c.Params("simId")
	userID := c.Locals("user_id").(string)

	// Verify user owns this simulation and get it for status
	simulation, err := simulationService.GetSimulation(simID, userID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Simulation not found",
		})
	}

	// Parse pagination params
	limit, _ := strconv.Atoi(c.Query("limit", "1000"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))

	// Fetch events
	var events []model.SimulationEvent
	var total int64

	db := database.DB
	db.Model(&model.SimulationEvent{}).Where("simulation_id = ?", simID).Count(&total)
	db.Where("simulation_id = ?", simID).
		Order("simulation_time ASC, created_at ASC").
		Limit(limit).
		Offset(offset).
		Find(&events)

	return c.JSON(response.CreateSimulationEventsResponse(events, total, limit, offset, *simulation))
}
