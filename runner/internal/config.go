package internal

import (
	"devsforge/shared"
	"log"
	"time"
)

func InitConfig(model shared.RunnableModel) {
	log.SetPrefix(model.ID)
	log.Printf("ID: %s\n", model.ID)
	log.Printf("Name: %s\n", model.Name)
	log.Printf("Language: %s\n", "Todo")
	log.Printf("Ports:\n%+v\n", model.Ports)
	log.Printf("Connections:\n%+v\n", model.Connections)

	log.Println("Kafka provider")
	log.Println("Waiting for init message")
	time.Sleep(2 * time.Second)
	log.Println("Init using message")
	time.Sleep(2 * time.Second)
	log.Println("Running")
	time.Sleep(2 * time.Second)
	log.Println("Got message")
	time.Sleep(2 * time.Second)
	log.Println("Waiting next time")
	time.Sleep(2 * time.Second)
	log.Println("Next time is current time end of run")
}
