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

func TestRunPythonModel(t *testing.T) {
	runnerPythonID := "m1-python"
	kafkaTopic := "runner-test-python"
	simID := "test-python-sim"
	codeContent, err := os.ReadFile(filepath.Join("testdata", "m1.py"))
	if err != nil {
		t.Fatalf("Error while reading test code\n %v", err)
	}
	client := testsutils.InitKafkaClient(kafkaTopic, KafkaAddr)
	currentTime := 0.0
	baseMessage := kafka.BaseKafkaMessage{
		SimulationRunID: simID,
		SenderID:        kafka.CoordinatorId,
		ReceiverID:      runnerPythonID,
	}

	jsonContent := fmt.Sprintf(`{
        "models": [
        {
        "language": "python",
        "id": "%s",
        "name": "Generator Incremental",
        "code": %q
        }
        ],
        "count": 1,
        "id": "test",
        "simulationID": "%s"
        }`, runnerPythonID, string(codeContent), simID)

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
			}
			return simulation.ErrSimulationDone
		default:
			return fmt.Errorf("unreconized message: %s", msg)
		}
	}
	testGenerator(jsonContent, kafkaTopic, baseMessage, currentTime, t, client, handler)
}
