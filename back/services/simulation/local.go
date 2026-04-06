package simulation

import (
	"devsforge/config"
	"devsforge/database"
	"devsforge/model"
	"fmt"
	"log"
	"os"
	"os/exec"
	"time"
)

// runLocalCoordinator executes the coordinator subprocess
func (s *SimulationService) runLocalCoordinator(simulationID string, manifestFile string, kafkaAddr string, kafkaTopic string) {
	db := database.DB

	// Ensure event consumer is stopped when coordinator finishes
	defer eventConsumers.StopConsumer(simulationID)

	var simulation model.Simulation
	if err := db.First(&simulation, "id = ?", simulationID).Error; err != nil {
		return
	}

	// Run the coordinator with the topic
	simulatorCmd := os.Getenv("SIM_CMD")
	var err error
	var cmd *exec.Cmd
	if simulatorCmd != "" {
		cmd = exec.Command(simulatorCmd, "--file", manifestFile, "--kafka", kafkaAddr, "--topic", kafkaTopic)
	} else {
		// Get coordinator path
		coordinatorPath := config.Config("COORDINATOR_PATH")
		if coordinatorPath == "" {
			// Default to relative path from back
			coordinatorPath = "../simulator/coordinator"
		}
		cmd = exec.Command("go", "run", ".", "--file", manifestFile, "--kafka", kafkaAddr, "--topic", kafkaTopic)
		cmd.Dir = coordinatorPath
	}
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err = cmd.Run()

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

	// Clean up manifest file
	if err = os.Remove(manifestFile); err != nil {
		log.Println("cannot remove manifestFile: ", err)
	}

	result := db.Model(&model.Simulation{}).
		Where("id = ? AND status <> ?", simulationID, model.SimulationStatusCompleted).
		Updates(map[string]interface{}{
			"status":       model.SimulationStatusCompleted,
			"completed_at": now,
		})
	if result.Error != nil {
		fmt.Printf("[SimulationService] failed to mark simulation as completed: %v\n", result.Error)
	}
}
