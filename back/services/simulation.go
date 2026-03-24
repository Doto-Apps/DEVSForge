package services

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"devsforge/config"
	"devsforge/database"
	"devsforge/lib"
	"devsforge/model"
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
	models, err := GetModelRecursice(modelID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get models: %w", err)
	}

	// Create a temporary simulation ID
	simulation := model.Simulation{
		UserID:   userID,
		ModelID:  modelID,
		Status:   model.SimulationStatusPending,
		Manifest: "{}", // Temporary valid JSON, will be replaced with actual manifest
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
	manifestFile := filepath.Join(tmpDir, fmt.Sprintf("manifest_%s.json", simulationID))
	if err := os.WriteFile(manifestFile, []byte(simulation.Manifest), 0644); err != nil {
		s.markSimulationFailed(&simulation, fmt.Sprintf("failed to write manifest file: %v", err))
		return fmt.Errorf("failed to write manifest file: %w", err)
	}

	// Get Kafka address from config
	kafkaAddr := config.Config("KAFKA_ADDRESS")
	if kafkaAddr == "" {
		kafkaAddr = "localhost:9092"
	}

	// Get coordinator path
	coordinatorPath := config.Config("COORDINATOR_PATH")
	if coordinatorPath == "" {
		// Default to relative path from back
		coordinatorPath = "../simulator/coordinator"
	}

	// Generate Kafka topic name for this simulation
	kafkaTopic := GenerateTopicName(simulationID)

	// Start Kafka event consumer before launching coordinator
	if err := EventConsumers.StartConsumer(simulationID, kafkaTopic); err != nil {
		s.markSimulationFailed(&simulation, fmt.Sprintf("failed to start event consumer: %v", err))
		return fmt.Errorf("failed to start event consumer: %w", err)
	}

	// Launch coordinator in background
	go s.runCoordinator(simulationID, manifestFile, kafkaAddr, kafkaTopic, coordinatorPath)

	return nil
}

// runCoordinator executes the coordinator subprocess
func (s *SimulationService) runCoordinator(simulationID string, manifestFile string, kafkaAddr string, kafkaTopic string, coordinatorPath string) {
	db := database.DB

	// Ensure event consumer is stopped when coordinator finishes
	defer EventConsumers.StopConsumer(simulationID)

	var simulation model.Simulation
	if err := db.First(&simulation, "id = ?", simulationID).Error; err != nil {
		return
	}

	// Run the coordinator with the topic
	cmd := exec.Command("go", "run", ".", "--file", manifestFile, "--kafka", kafkaAddr, "--topic", kafkaTopic)
	cmd.Dir = coordinatorPath
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	err := cmd.Run()

	// Clean up manifest file
	os.Remove(manifestFile)

	// Update simulation status.
	// If the event consumer already marked the run as failed from an ErrorReport,
	// do not override it with "completed".
	now := time.Now()
	if err != nil {
		errMsg := err.Error()
		result := db.Model(&model.Simulation{}).
			Where("id = ?", simulationID).
			Updates(map[string]interface{}{
				"status":        model.SimulationStatusFailed,
				"error_message": errMsg,
				"completed_at":  now,
			})
		if result.Error != nil {
			fmt.Printf("[SimulationService] failed to mark simulation as failed: %v\n", result.Error)
		}
		return
	}

	result := db.Model(&model.Simulation{}).
		Where("id = ? AND status <> ?", simulationID, model.SimulationStatusFailed).
		Updates(map[string]interface{}{
			"status":       model.SimulationStatusCompleted,
			"completed_at": now,
		})
	if result.Error != nil {
		fmt.Printf("[SimulationService] failed to mark simulation as completed: %v\n", result.Error)
	}
}

// markSimulationFailed marks a simulation as failed
func (s *SimulationService) markSimulationFailed(simulation *model.Simulation, errorMsg string) {
	db := database.DB
	simulation.Status = model.SimulationStatusFailed
	simulation.ErrorMessage = &errorMsg
	db.Save(simulation)
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
