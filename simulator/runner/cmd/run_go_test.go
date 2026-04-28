package cmd

import (
	"devsforge-runner/testsutils"
	"devsforge-shared/kafka"
	"devsforge-shared/simulation"
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

func TestGoRunner(t *testing.T) {
	runnerGoID := "m1-go"
	kafkaTopic := "runner-test-go"
	simID := "test-go-sim"

	codeContent, err := os.ReadFile(filepath.Join("testdata", "m1.go"))
	if err != nil {
		t.Fatalf("Error while reading test code\n %v", err)
	}

	jsonContent := fmt.Sprintf(`{
		"models": [
			{
			"language": "go",
			"id": "%s",
			"name": "Generator Incremental",
			"code": %q
			}
		],
		"count": 1,
		"id": "test",
		"simulationID": "%s"
	}`, runnerGoID, string(codeContent), simID)

	client := testsutils.InitKafkaClient(kafkaTopic, KafkaAddr)
	currentTime := 0.0
	baseMessage := kafka.BaseKafkaMessage{
		SimulationRunID: simID,
		SenderID:        kafka.CoordinatorId,
		ReceiverID:      runnerGoID,
	}

	handler := func(msg any) error {
		switch m := msg.(type) {
		case *kafka.KafkaMessageNextInternalTimeReport:
			t.Log("send execute transition")
			currentTime = m.NextInternalTime
			execTranstionMsg := baseMessage.NewKafkaMessageExecuteTransition(kafka.KafkaMessageExecuteTransitionParams{
				EventTime: currentTime,
				Payload: kafka.KafkaMessageExecuteTransitionPayload{
					Inputs: make([]*kafka.KafkaMessagePortPayload, 0),
				},
			})
			return testsutils.SendMessage(client, execTranstionMsg)
		case *kafka.KafkaMessageTransitionComplete:
			t.Log("send request output")
			sendOutput := baseMessage.NewKafkaMessageRequestOutput(kafka.KafkaMessageRequestOutputParams{
				EventTime: currentTime,
			})
			return testsutils.SendMessage(client, sendOutput)
		case *kafka.KafkaMessageOutputReport:
			t.Log("send simulation terminate")
			simulationDoneMsg := baseMessage.NewKafkaMessageSimulationTerminate(kafka.KafkaMessageSimulationTerminateParams{
				EventTime: currentTime,
				Payload: &kafka.KafkaMessageSimulationTerminatePayload{
					Reason: "ok",
				},
			})
			if msgErr := testsutils.SendMessage(client, simulationDoneMsg); msgErr != nil {
				return msgErr
			} else {
				t.Log("sent simulation terminate, exiting receive loop")
				return simulation.ErrSimulationDone
			}
		default:
			return fmt.Errorf("unreconized message: %s", msg)
		}
	}

	testGenerator(jsonContent, kafkaTopic, baseMessage, currentTime, t, client, handler)
}
