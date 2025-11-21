package internal

import (
	"fmt"
	"log"

	"google.golang.org/protobuf/types/known/emptypb"
)

func (r *Runner) RunSimulationDone() error {
	if _, err := r.ModelClient.Finalize(r.Context, &emptypb.Empty{}); err != nil {
		return fmt.Errorf("finalize error: %w", err)
	}
	log.Println("SimulationDone received, model finalized.")
	return nil
}
