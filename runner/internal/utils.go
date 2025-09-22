package internal

import (
	"encoding/json"
	"fmt"
	"log"
)

func HandleMessage(message string) error {
	var parsedMessage Message
	err := json.Unmarshal([]byte(message), &parsedMessage)
	if err != nil {
		return fmt.Errorf("error when parsing message: %w", err)
	}

	if parsedMessage.Data.Type == "init" {
		log.Println("Init message received...")
	}

	return nil
}
