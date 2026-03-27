package handler

import (
	"errors"
	"fmt"
	"sort"
	"strings"

	"devsforge/database"
	"devsforge/enum"
	"devsforge/json"
	"devsforge/middleware"
	"devsforge/model"
	"devsforge/request"
	"devsforge/response"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
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

	if req.TargetModelID == "" {
		return SendRequestError(c, fiber.StatusBadRequest, errors.New("targetModelId is required"))
	}

	if req.IsAssistedSave() {
		return createAssistedExperimentalFrame(c, db, userID, req)
	}

	if req.FrameModelID == "" {
		return SendRequestError(c, fiber.StatusBadRequest, errors.New("frameModelId is required for manual creation"))
	}

	return createExperimentalFrameLink(c, db, userID, req.TargetModelID, req.FrameModelID)
}

func createExperimentalFrameLink(
	c *fiber.Ctx,
	db *gorm.DB,
	userID string,
	targetModelID string,
	frameModelID string,
) error {
	if targetModelID == frameModelID {
		return SendRequestError(c, fiber.StatusBadRequest, errors.New("targetModelId and frameModelId must be different"))
	}

	var targetModel model.Model
	if err := db.First(&targetModel, "user_id = ? AND id = ?", userID, targetModelID).Error; err != nil {
		return SendRequestError(c, fiber.StatusNotFound, errors.New("target model not found"))
	}

	var frameModel model.Model
	if err := db.First(&frameModel, "user_id = ? AND id = ?", userID, frameModelID).Error; err != nil {
		return SendRequestError(c, fiber.StatusNotFound, errors.New("frame model not found"))
	}

	if frameModel.Type != enum.Coupled {
		return SendRequestError(c, fiber.StatusBadRequest, errors.New("frame model must be of type coupled"))
	}

	ef := model.ExperimentalFrame{
		UserID:        userID,
		TargetModelID: targetModelID,
		FrameModelID:  frameModelID,
	}
	if err := db.Create(&ef).Error; err != nil {
		return SendRequestError(c, fiber.StatusBadRequest, err)
	}

	return c.Status(fiber.StatusCreated).JSON(response.CreateExperimentalFrameResponse(ef))
}

func createAssistedExperimentalFrame(
	c *fiber.Ctx,
	db *gorm.DB,
	userID string,
	req *request.ExperimentalFrameRequest,
) error {
	var targetModel model.Model
	if err := db.First(&targetModel, "user_id = ? AND id = ?", userID, req.TargetModelID).Error; err != nil {
		return SendRequestError(c, fiber.StatusNotFound, errors.New("target model not found"))
	}

	libraryID := req.LibraryID
	if libraryID == nil {
		libraryID = targetModel.LibID
	}
	if libraryID == nil {
		return SendRequestError(c, fiber.StatusBadRequest, errors.New("libraryId is required for assisted EF save"))
	}

	if _, err := validateAssistedExperimentalFrameRequest(req, targetModel); err != nil {
		return SendRequestError(c, fiber.StatusBadRequest, err)
	}

	logicalToDatabaseID := map[string]string{
		req.TargetModelID: targetModel.ID,
	}

	var createdEF model.ExperimentalFrame

	if err := db.Transaction(func(tx *gorm.DB) error {
		atomicToCreate := make([]request.AssistedExperimentalFrameModel, 0)
		coupledToCreate := make([]request.AssistedExperimentalFrameModel, 0)

		for _, spec := range req.Models {
			if spec.ID == req.TargetModelID {
				continue
			}
			if spec.Type == enum.Atomic {
				atomicToCreate = append(atomicToCreate, spec)
			} else {
				coupledToCreate = append(coupledToCreate, spec)
			}
		}

		sort.Slice(atomicToCreate, func(i, j int) bool {
			return atomicToCreate[i].ID < atomicToCreate[j].ID
		})
		sort.Slice(coupledToCreate, func(i, j int) bool {
			return coupledToCreate[i].ID < coupledToCreate[j].ID
		})

		for _, spec := range atomicToCreate {
			createdModel, createErr := createAssistedModelFromSpec(
				tx,
				userID,
				libraryID,
				req,
				spec,
				nil,
				nil,
			)
			if createErr != nil {
				return createErr
			}
			logicalToDatabaseID[spec.ID] = createdModel.ID
		}

		remainingCoupled := make(map[string]request.AssistedExperimentalFrameModel, len(coupledToCreate))
		for _, spec := range coupledToCreate {
			remainingCoupled[spec.ID] = spec
		}

		for len(remainingCoupled) > 0 {
			progressed := false

			coupledIDs := make([]string, 0, len(remainingCoupled))
			for coupledID := range remainingCoupled {
				coupledIDs = append(coupledIDs, coupledID)
			}
			sort.Strings(coupledIDs)

			for _, coupledID := range coupledIDs {
				spec := remainingCoupled[coupledID]
				ready := true
				for _, componentID := range spec.Components {
					if _, exists := logicalToDatabaseID[componentID]; !exists {
						ready = false
						break
					}
				}
				if !ready {
					continue
				}

				components, instanceByModelID, componentsErr := buildCoupledComponents(spec, logicalToDatabaseID)
				if componentsErr != nil {
					return componentsErr
				}

				connections := buildCoupledConnections(spec, instanceByModelID, req.Connections)

				createdModel, createErr := createAssistedModelFromSpec(
					tx,
					userID,
					libraryID,
					req,
					spec,
					components,
					connections,
				)
				if createErr != nil {
					return createErr
				}

				logicalToDatabaseID[spec.ID] = createdModel.ID
				delete(remainingCoupled, spec.ID)
				progressed = true
			}

			if !progressed {
				return fmt.Errorf("unable to resolve coupled dependencies for assisted EF models")
			}
		}

		rootDatabaseID, exists := logicalToDatabaseID[req.RootModelID]
		if !exists {
			return fmt.Errorf("root model could not be created")
		}

		createdEF = model.ExperimentalFrame{
			UserID:        userID,
			TargetModelID: req.TargetModelID,
			FrameModelID:  rootDatabaseID,
		}

		if createErr := tx.Create(&createdEF).Error; createErr != nil {
			return createErr
		}

		return nil
	}); err != nil {
		return SendRequestError(c, fiber.StatusBadRequest, err)
	}

	return c.Status(fiber.StatusCreated).JSON(response.CreateExperimentalFrameResponse(createdEF))
}

func validateAssistedExperimentalFrameRequest(
	req *request.ExperimentalFrameRequest,
	targetModel model.Model,
) (map[string]request.AssistedExperimentalFrameModel, error) {
	if len(req.Models) == 0 {
		return nil, errors.New("models are required for assisted EF save")
	}
	if strings.TrimSpace(req.RootModelID) == "" {
		return nil, errors.New("rootModelId is required for assisted EF save")
	}

	modelUnderTestID := req.ModelUnderTestID
	if modelUnderTestID == "" {
		modelUnderTestID = req.TargetModelID
	}
	if modelUnderTestID != req.TargetModelID {
		return nil, errors.New("modelUnderTestId must match targetModelId")
	}

	modelByID := make(map[string]request.AssistedExperimentalFrameModel, len(req.Models))
	portDirectionByModelID := make(map[string]map[string]enum.ModelPortDirection, len(req.Models))

	for _, spec := range req.Models {
		if strings.TrimSpace(spec.ID) == "" {
			return nil, errors.New("model id cannot be empty")
		}
		if strings.TrimSpace(spec.Name) == "" {
			return nil, fmt.Errorf("model %s has empty name", spec.ID)
		}
		if _, exists := modelByID[spec.ID]; exists {
			return nil, fmt.Errorf("duplicate model id: %s", spec.ID)
		}

		modelByID[spec.ID] = spec

		if spec.Type == enum.Atomic && len(spec.Components) > 0 {
			return nil, fmt.Errorf("atomic model %s cannot have components", spec.ID)
		}

		componentSet := make(map[string]struct{}, len(spec.Components))
		for _, componentID := range spec.Components {
			if _, duplicated := componentSet[componentID]; duplicated {
				return nil, fmt.Errorf("model %s contains duplicate component id %s", spec.ID, componentID)
			}
			componentSet[componentID] = struct{}{}
		}

		portDirections := make(map[string]enum.ModelPortDirection, len(spec.Ports))
		for _, port := range spec.Ports {
			portName := strings.TrimSpace(port.Name)
			if portName == "" {
				return nil, fmt.Errorf("model %s has an empty port name", spec.ID)
			}
			if port.Type != enum.ModelPortDirectionIn && port.Type != enum.ModelPortDirectionOut {
				return nil, fmt.Errorf("model %s has invalid port direction for %s", spec.ID, port.Name)
			}
			if _, exists := portDirections[portName]; exists {
				return nil, fmt.Errorf("model %s has duplicate port name %s", spec.ID, portName)
			}
			portDirections[portName] = port.Type
		}
		portDirectionByModelID[spec.ID] = portDirections
	}

	rootModel, exists := modelByID[req.RootModelID]
	if !exists {
		return nil, errors.New("rootModelId must reference a known model")
	}
	if rootModel.Type != enum.Coupled {
		return nil, errors.New("root model must be coupled")
	}

	mutModel, exists := modelByID[modelUnderTestID]
	if !exists {
		return nil, errors.New("modelUnderTestId must reference a known model")
	}
	if mutModel.Type != targetModel.Type {
		return nil, fmt.Errorf("model-under-test type (%s) must match target type (%s)", mutModel.Type, targetModel.Type)
	}

	if !containsString(rootModel.Components, modelUnderTestID) {
		return nil, errors.New("root model must include model-under-test as component")
	}

	for modelID, spec := range modelByID {
		if spec.Type == enum.Atomic {
			continue
		}
		for _, componentID := range spec.Components {
			if _, componentExists := modelByID[componentID]; !componentExists {
				return nil, fmt.Errorf("model %s references unknown component %s", modelID, componentID)
			}
		}
	}

	expectedTargetPorts := make(map[string]enum.ModelPortDirection, len(targetModel.Ports))
	for _, port := range targetModel.Ports {
		key := canonicalPortName(port.Name, port.ID)
		if key == "" {
			return nil, errors.New("target model has a port with empty name and id")
		}
		expectedTargetPorts[key] = port.Type
	}
	if len(mutModel.Ports) != len(expectedTargetPorts) {
		return nil, errors.New("model-under-test ports must match target model interface")
	}
	for _, port := range mutModel.Ports {
		key := canonicalPortName(port.Name, "")
		expectedDirection, knownPort := expectedTargetPorts[key]
		if !knownPort {
			return nil, fmt.Errorf("model-under-test contains unexpected port %s", key)
		}
		if expectedDirection != port.Type {
			return nil, fmt.Errorf("model-under-test port %s has wrong direction", key)
		}
	}

	for idx, conn := range req.Connections {
		sourceModelID := strings.TrimSpace(conn.From.Model)
		targetModelID := strings.TrimSpace(conn.To.Model)
		sourcePort := strings.TrimSpace(conn.From.Port)
		targetPort := strings.TrimSpace(conn.To.Port)
		connectionLabel := fmt.Sprintf("connection #%d", idx+1)

		sourcePorts, sourceExists := portDirectionByModelID[sourceModelID]
		if !sourceExists {
			return nil, fmt.Errorf("%s references unknown source model %s", connectionLabel, sourceModelID)
		}
		targetPorts, targetExists := portDirectionByModelID[targetModelID]
		if !targetExists {
			return nil, fmt.Errorf("%s references unknown target model %s", connectionLabel, targetModelID)
		}

		sourceDirection, sourcePortExists := sourcePorts[sourcePort]
		if !sourcePortExists || sourceDirection != enum.ModelPortDirectionOut {
			return nil, fmt.Errorf("%s has invalid source port %s on model %s", connectionLabel, sourcePort, sourceModelID)
		}
		targetDirection, targetPortExists := targetPorts[targetPort]
		if !targetPortExists || targetDirection != enum.ModelPortDirectionIn {
			return nil, fmt.Errorf("%s has invalid target port %s on model %s", connectionLabel, targetPort, targetModelID)
		}
	}

	return modelByID, nil
}

func createAssistedModelFromSpec(
	tx *gorm.DB,
	userID string,
	libraryID *string,
	req *request.ExperimentalFrameRequest,
	spec request.AssistedExperimentalFrameModel,
	components []json.ModelComponent,
	connections []json.ModelConnection,
) (model.Model, error) {
	role := strings.TrimSpace(spec.Role)
	if role == "" {
		switch spec.ID {
		case req.RootModelID:
			role = "experimental-frame"
		case req.TargetModelID:
			role = "model-under-test"
		default:
			role = string(spec.Type)
		}
	}

	modelPorts := make([]json.ModelPort, 0, len(spec.Ports))
	for _, port := range spec.Ports {
		portName := strings.TrimSpace(port.Name)
		modelPorts = append(modelPorts, json.ModelPort{
			ID:   portName,
			Name: portName,
			Type: port.Type,
		})
	}

	width := 200.0
	height := 200.0
	if spec.Type == enum.Coupled {
		width = 400.0
		height = 400.0
	}

	description := fmt.Sprintf("Generated %s model for assisted experimental frame", string(spec.Type))
	if spec.ID == req.RootModelID {
		description = fmt.Sprintf("Generated experimental frame root for %s", req.TargetModelID)
	}

	code := spec.Code
	if spec.Type == enum.Coupled {
		code = ""
	}

	modelRole := role
	modelToCreate := model.Model{
		UserID:      userID,
		LibID:       libraryID,
		Name:        spec.Name,
		Type:        spec.Type,
		Language:    enum.ModelLanguagePython,
		Description: description,
		Code:        code,
		Ports:       modelPorts,
		Components:  components,
		Connections: connections,
		Metadata: json.ModelMetadata{
			Position:  json.ModelPosition{X: 0, Y: 0},
			Style:     json.ModelStyle{Width: width, Height: height},
			Keyword:   []string{role},
			ModelRole: &modelRole,
		},
	}

	if err := tx.Create(&modelToCreate).Error; err != nil {
		return model.Model{}, err
	}

	return modelToCreate, nil
}

func buildCoupledComponents(
	spec request.AssistedExperimentalFrameModel,
	logicalToDatabaseID map[string]string,
) ([]json.ModelComponent, map[string]string, error) {
	instanceByModelID := make(map[string]string, len(spec.Components))
	components := make([]json.ModelComponent, 0, len(spec.Components))

	for _, componentID := range spec.Components {
		componentDatabaseID, exists := logicalToDatabaseID[componentID]
		if !exists {
			return nil, nil, fmt.Errorf("unable to resolve component %s for model %s", componentID, spec.ID)
		}

		instanceID := componentID
		instanceByModelID[componentID] = instanceID

		components = append(components, json.ModelComponent{
			InstanceID: instanceID,
			ModelID:    componentDatabaseID,
		})
	}

	return components, instanceByModelID, nil
}

func buildCoupledConnections(
	spec request.AssistedExperimentalFrameModel,
	instanceByModelID map[string]string,
	connections []request.AssistedExperimentalFrameConnection,
) []json.ModelConnection {
	scope := make(map[string]struct{}, len(spec.Components)+1)
	scope[spec.ID] = struct{}{}
	for _, componentID := range spec.Components {
		scope[componentID] = struct{}{}
	}

	result := make([]json.ModelConnection, 0)
	for _, conn := range connections {
		if _, inScope := scope[conn.From.Model]; !inScope {
			continue
		}
		if _, inScope := scope[conn.To.Model]; !inScope {
			continue
		}

		fromInstanceID := "root"
		if conn.From.Model != spec.ID {
			fromInstanceID = instanceByModelID[conn.From.Model]
		}

		toInstanceID := "root"
		if conn.To.Model != spec.ID {
			toInstanceID = instanceByModelID[conn.To.Model]
		}

		result = append(result, json.ModelConnection{
			From: json.ModelLink{
				InstanceID: fromInstanceID,
				Port:       conn.From.Port,
			},
			To: json.ModelLink{
				InstanceID: toInstanceID,
				Port:       conn.To.Port,
			},
		})
	}

	return result
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
