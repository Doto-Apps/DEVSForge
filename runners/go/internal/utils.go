package internal

import (
	"log"
	"time"
)

type Message struct {
	ID      string `json:"id"`
	Level   string `json:"level"`
	Message string `json:"message"`
}

var messageCh = make(chan string, 1)

func HandleMessage(message string) error {
	log.Println("Got a msg")
	// var parsedMessage Message
	// err := json.Unmarshal([]byte(message), &parsedMessage)
	// if err != nil {
	// 	return fmt.Errorf("error when parsing message: %w", err)
	// }
	//
	// //Message that need to be considered : info level and id different of the current config
	// if parsedMessage.Level == "info" && parsedMessage.ID != config.ID {
	// 	if parsedMessage.Message == "init_done" || parsedMessage.Message == "election_required" {
	// 		log.Println("Got a message here")
	// 		messageCh <- parsedMessage.Message
	// 	}
	// 	log.Printf("Got a message that I dont handle: %v\n", parsedMessage)
	// }
	if message == "init_done" || message == "election_required" {
		log.Printf("Got a message %s\n", message)
		messageCh <- message
	}
	log.Printf("Got a message that I dont handle: %v\n", message)

	return nil
}

func SendMessage(msg string) {
	// Logic to implement from config to choose the right place to send message/multiplex message
	// config.Logger.Info().Msg(msg)
	config.Producer.SendMessage(msg)
	log.Println("Message sent ", msg)
}

func WaitForElectionRequired(timeout time.Duration) {
	count := 0
	n := config.PeerCount
	for {
		msg := <-messageCh
		if msg == "election_required" {
			count++
			if count >= n {
				return
			}
		}
	}
}

func WaitForAllReady(timeout time.Duration) {
	count := 0
	n := config.PeerCount
	for {
		msg := <-messageCh
		if msg == "init_done" {
			count++
			if count >= n {
				return
			}
		}
	}
}
