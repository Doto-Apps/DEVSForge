package cmd

import (
	"devsforge-runner/testsutils"
	shared "devsforge-shared"
	"devsforge-shared/enum"
	"devsforge-shared/kafka"
	"devsforge-shared/simulation"
	"encoding/json"
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

	runnableManifest := shared.RunnableManifest{
		Models: []*shared.RunnableModel{
			{
				ID:       runnerGoID,
				Name:     "go-sender",
				Code:     string(codeContent),
				Language: shared.CodeLanguage(shared.Go),
				Ports: []shared.RunnableModelPort{
					{
						ID:   "out",
						Name: "out",
						Type: enum.ModelPortDirectionOut,
					},
				},
				Parameters:  make([]shared.RunnableModelParameter, 0),
				Connections: make([]shared.RunnableModelConnection, 0),
			},
		},
		Count:        1,
		SimulationID: simID,
		MaxTime:      100,
	}

	jsonContent, err := json.Marshal(&runnableManifest)
	if err != nil {
		t.Fatalf("cannot parse manifest: %v", err)
	}

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
			if m.GetSenderID() != runnerGoID || m.GetReceiverID() != kafka.CoordinatorId || m.NextInternalTime != 0 {
				t.Fatalf("invalid message received: %v", m)
			}
			currentTime = m.NextInternalTime
			execTranstionMsg := baseMessage.NewKafkaMessageExecuteTransition(kafka.KafkaMessageExecuteTransitionParams{
				EventTime: currentTime,
				Payload: kafka.KafkaMessageExecuteTransitionPayload{
					Inputs: make([]*kafka.KafkaMessagePortPayload, 0),
				},
			})
			return testsutils.SendMessage(client, execTranstionMsg)
		case *kafka.KafkaMessageTransitionComplete:
			if m.GetReceiverID() != kafka.CoordinatorId {
				t.Fatalf("bad receiver id for transition complete: wanted %s - got %s", kafka.CoordinatorId, m.GetReceiverID())
			}
			t.Log("send request output")
			requestOutputMsg := baseMessage.NewKafkaMessageRequestOutput(kafka.KafkaMessageRequestOutputParams{
				EventTime: currentTime,
			})
			return testsutils.SendMessage(client, requestOutputMsg)
		case *kafka.KafkaMessageOutputReport:
			if len(m.Payload.Outputs) == 0 {
				t.Fatalf("Bad output array should have length greater than 0")
			}
			if m.Payload.Outputs[0].PortName != "out" {
				t.Fatalf("Bad port name wanted out go %s", m.Payload.Outputs[0].PortName)
			}
			if value, ok := m.Payload.Outputs[0].Value.(float64); !ok {
				t.Fatalf("Bad value wanted a float64, got %s", m.Payload.Outputs[0].Value)
			} else {
				t.Logf("Value is %f", value)
			}
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

	testGenerator(string(jsonContent), kafkaTopic, baseMessage, currentTime, t, client, handler)
}
