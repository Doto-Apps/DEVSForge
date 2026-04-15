// Package simulation handle simulation launch and database updates
package simulation

import (
	"devsforge/config"
	"devsforge/database"
	"devsforge/lib"
	"devsforge/model"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"
)

// SimulationService handles simulation business logic
type SimulationService struct{}

// NewSimulationService creates a new SimulationService
func NewSimulationService() *SimulationService {
	return &SimulationService{}
}

// CreateSimulation creates a new simulation entry in the database
func (s *SimulationService) CreateSimulation(
	userID string,
	modelID string,
	maxTime float64,
	runtimeOverrides []lib.RuntimeInstanceOverride,
) (*model.Simulation, error) {
	db := database.DB

	// Get models recursively
	models, err := getModelRecursice(modelID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get models: %w", err)
	}

	// Create a temporary simulation ID
	simulation := model.Simulation{
		UserID:   userID,
		ModelID:  modelID,
		Status:   model.SimulationStatusPending,
		Manifest: "{}",
	}

	// Create simulation entry first to get the ID
	if err := db.Create(&simulation).Error; err != nil {
		return nil, fmt.Errorf("failed to create simulation: %w", err)
	}

	// Generate manifest with the simulation ID
	manifest, err := lib.ModelToManifest(
		models,
		modelID,
		simulation.ID,
		maxTime,
		runtimeOverrides,
	)
	if err != nil {
		simulation.Status = model.SimulationStatusFailed
		errMsg := err.Error()
		simulation.ErrorMessage = &errMsg
		db.Save(&simulation)
		return nil, fmt.Errorf("failed to generate manifest: %w", err)
	}

	// Store manifest as JSON
	manifestJSON, err := json.Marshal(manifest)
	if err != nil {
		simulation.Status = model.SimulationStatusFailed
		errMsg := err.Error()
		simulation.ErrorMessage = &errMsg
		db.Save(&simulation)
		return nil, fmt.Errorf("failed to serialize manifest: %w", err)
	}

	simulation.Manifest = string(manifestJSON)
	if err := db.Save(&simulation).Error; err != nil {
		return nil, fmt.Errorf("failed to update simulation: %w", err)
	}

	return &simulation, nil
}

// StartSimulation starts a simulation by launching the coordinator
func (s *SimulationService) StartSimulation(simulationID string) error {
	db := database.DB

	var simulation model.Simulation
	if err := db.First(&simulation, "id = ?", simulationID).Error; err != nil {
		return fmt.Errorf("simulation not found: %w", err)
	}

	if simulation.Status != model.SimulationStatusPending {
		return fmt.Errorf("simulation is not in pending state")
	}

	// Update status to running
	now := time.Now()
	simulation.Status = model.SimulationStatusRunning
	simulation.StartedAt = &now
	if err := db.Save(&simulation).Error; err != nil {
		return fmt.Errorf("failed to update simulation status: %w", err)
	}

	// Write manifest to temp file
	tmpDir := os.TempDir()
	manifestFile := fmt.Sprintf("%s/manifest_%s.json", tmpDir, simulationID)
	if err := os.WriteFile(manifestFile, []byte(simulation.Manifest), 0644); err != nil {
		s.markSimulationFailed(&simulation, fmt.Sprintf("failed to write manifest file: %v", err))
		return fmt.Errorf("failed to write manifest file: %w", err)
	}

	// Launch coordinator in background
	go s.runCoordinator(simulationID, manifestFile)

	return nil
}

// runCoordinator Launch simulator sync or async
func (s *SimulationService) runCoordinator(
	simulationID string,
	manifestFile string,
) {
	simulatorMode := config.Get().Simulator.Mode
	simulatorAddr := config.Get().Simulator.Addr

	slog.Info("Simulation address and mode", "simulatorAddr", simulatorAddr, "simulatorMode", simulatorMode)
	if simulatorMode == "async" {
		s.runRemoteCoordinatorAsync(simulationID, manifestFile)
	} else {
		s.runRemoteCoordinatorSync(simulationID, manifestFile)
	}
}

// markSimulationFailed marks a simulation as failed
func (s *SimulationService) markSimulationFailed(simulation *model.Simulation, errorMsg string) {
	db := database.DB
	simulation.Status = model.SimulationStatusFailed
	simulation.ErrorMessage = &errorMsg
	db.Save(simulation)
}

// markSimulationFailedByID marks a simulation as failed by ID only
func (s *SimulationService) markSimulationFailedByID(simulationID string, errorMsg string) {
	db := database.DB
	now := time.Now()

	result := db.Model(&model.Simulation{}).
		Where("id = ?", simulationID).
		Updates(map[string]any{
			"status":        model.SimulationStatusFailed,
			"error_message": errorMsg,
			"completed_at":  now,
		})
	if result.Error != nil {
		slog.Error("failed to mark simulation as failed", "simulationId", simulationID, "error", result.Error)
	}
}

// GetSimulation retrieves a simulation by ID
func (s *SimulationService) GetSimulation(simulationID string, userID string) (*model.Simulation, error) {
	db := database.DB

	var simulation model.Simulation
	if err := db.First(&simulation, "id = ? AND user_id = ?", simulationID, userID).Error; err != nil {
		return nil, fmt.Errorf("simulation not found: %w", err)
	}

	return &simulation, nil
}

// GetSimulationsByModel retrieves all simulations for a model
func (s *SimulationService) GetSimulationsByModel(modelID string, userID string) ([]model.Simulation, error) {
	db := database.DB

	var simulations []model.Simulation
	if err := db.Find(&simulations, "model_id = ? AND user_id = ?", modelID, userID).Error; err != nil {
		return nil, fmt.Errorf("failed to get simulations: %w", err)
	}

	return simulations, nil
}

// GetUserSimulations retrieves all simulations for a user
func (s *SimulationService) GetUserSimulations(userID string) ([]model.Simulation, error) {
	db := database.DB

	var simulations []model.Simulation
	if err := db.Where("user_id = ?", userID).Order("created_at DESC").Find(&simulations).Error; err != nil {
		return nil, fmt.Errorf("failed to get simulations: %w", err)
	}

	return simulations, nil
}

// generateTopicName generates a Kafka topic name for a simulation
func generateTopicName(simulationID string) string {
	// Use first 8 chars of simulation ID for shorter topic name
	shortID := simulationID
	if len(shortID) > 8 {
		shortID = shortID[:8]
	}
	return "sim-" + strings.ReplaceAll(shortID, "-", "")
}

// getModelRecursice retrieves models recursively
func getModelRecursice(id string, userID string) (models []model.Model, err error) {
	db := database.DB

	modelIds := make([]string, 0)
	modelIds = append(modelIds, id)
	models = make([]model.Model, 0)

	for len(modelIds) > 0 {
		var model model.Model

		flag := false

		for _, v := range models {
			if v.ID == modelIds[0] {
				flag = true
			}
		}
		if !flag {
			db.Find(&model, "user_id = ? AND id = ?", userID, modelIds[0])
			if model.Name == "" {
				return nil, fmt.Errorf("MODEL_NOT_FOUND")
			} else {
				models = append(models, model)
				for _, v := range model.Components {
					modelIds = append(modelIds, v.ModelID)
				}
			}
		}
		modelIds = modelIds[1:]
	}

	return models, nil
}
