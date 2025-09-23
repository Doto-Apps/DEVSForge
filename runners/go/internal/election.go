package internal

import (
	"devsforge/runners/go/types"
	"fmt"
	"log"
	"time"
)

func TimeElection(model types.AbstractRunnableModelInterface) {
	WaitForElectionRequired(30 * time.Second)
	SendMessage("election_required")
	log.Println("Election started")
	// W8 for others messages
	SendMessage(fmt.Sprintf("next_time: %d", model.GetNextTime()))
}
