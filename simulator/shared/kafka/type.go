// Package kafka contains generic message types shared between runner / coord / wrappers.
package kafka

import (
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
)

const CoordinatorId = "Coordinator"

var GenerateMessageId = uuid.NewString

// Based on https://fr.overleaf.com/project/6957bee69b41867ab28cc3a1
// See assets/ISO-21175-2.md
type MessageType string

const (
	MessageTypeSimulationInit         MessageType = "SimulationInit"
	MessageTypeNextInternalTimeReport MessageType = "NextInternalTimeReport"
	MessageTypeExecuteTransition      MessageType = "ExecuteTransition"
	MessageTypeTransitionComplete     MessageType = "TransitionComplete"
	MessageTypeRequestOutput          MessageType = "RequestOutput"
	MessageTypeOutputReport           MessageType = "OutputReport"
	MessageTypeSimulationTerminate    MessageType = "SimulationTerminate"
	MessageTypeModelTerminated        MessageType = "ModelTerminated"
	MessageTypeMonitoringMessage      MessageType = "MonitoringMessage"
	MessageTypeErrorReport            MessageType = "ErrorReport"
)

type KafkaMessageMonitoringMessagePayloadCategory string

const (
	KafkaMessageMonitoringMessagePayloadCategoryStateSnapshot KafkaMessageMonitoringMessagePayloadCategory = "stateSnapshot"
	KafkaMessageMonitoringMessagePayloadCategoryMetric        KafkaMessageMonitoringMessagePayloadCategory = "metric"
	KafkaMessageMonitoringMessagePayloadCategoryTrace         KafkaMessageMonitoringMessagePayloadCategory = "trace"
	KafkaMessageMonitoringMessagePayloadCategoryDebug         KafkaMessageMonitoringMessagePayloadCategory = "debug"
)

type KafkaMessageErrorReportPayloadOriginRole string

const (
	KafkaMessageErrorReportPayloadOriginRoleCoordinator KafkaMessageErrorReportPayloadOriginRole = "Coordinator"
	KafkaMessageErrorReportPayloadOriginRoleRunner      KafkaMessageErrorReportPayloadOriginRole = "Runner"
	KafkaMessageErrorReportPayloadOriginRoleOther       KafkaMessageErrorReportPayloadOriginRole = "Other"
)

type KafkaMessageErrorReportPayloadSeverity string

const (
	KafkaMessageErrorReportPayloadSeverityInfo    KafkaMessageErrorReportPayloadSeverity = "info"
	KafkaMessageErrorReportPayloadSeverityWarning KafkaMessageErrorReportPayloadSeverity = "warning"
	KafkaMessageErrorReportPayloadSeverityError   KafkaMessageErrorReportPayloadSeverity = "error"
	KafkaMessageErrorReportPayloadSeverityFatal   KafkaMessageErrorReportPayloadSeverity = "fatal"
)

type CommonKafkaMessage struct {
	MessageType     MessageType `json:"messageType"`
	MessageID       string      `json:"messageId,omitempty"`
	SimulationRunID string      `json:"simulationRunId,omitempty"`
	SenderID        string      `json:"senderId,omitempty"`
	ReceiverID      string      `json:"receiverId,omitempty"`
}

func (c CommonKafkaMessage) GetMessageType() MessageType { return c.MessageType }
func (c CommonKafkaMessage) GetSimulationRunID() string  { return c.SimulationRunID }
func (c CommonKafkaMessage) GetSenderID() string         { return c.SenderID }
func (c CommonKafkaMessage) GetReceiverID() string       { return c.ReceiverID }

type BaseKafkaMessage struct {
	SimulationRunID string `json:"simulationRunId,omitempty"`
	SenderID        string `json:"senderId,omitempty"`
	ReceiverID      string `json:"receiverId,omitempty"`
}

func (b *BaseKafkaMessage) newCommonKafkaMessage(messageType MessageType) CommonKafkaMessage {
	return CommonKafkaMessage{
		MessageID:       GenerateMessageId(),
		MessageType:     messageType,
		SimulationRunID: b.SimulationRunID,
		SenderID:        b.SenderID,
		ReceiverID:      b.ReceiverID,
	}
}

type KafkaMessagePortPayload struct {
	PortName string `json:"portName"`
	Value    any    `json:"value"`
}

// -----------------------------------------------------------------------------
// SimulationInit
// -----------------------------------------------------------------------------

type KafkaMessageSimulationInit struct {
	CommonKafkaMessage
	EventTime float64 `json:"eventTime"`
}

type KafkaMessageSimulationInitParams struct {
	EventTime float64 `json:"eventTime"`
}

func (b *BaseKafkaMessage) NewKafkaMessageSimulationInit(params KafkaMessageSimulationInitParams) KafkaMessageSimulationInit {
	return KafkaMessageSimulationInit{
		CommonKafkaMessage: b.newCommonKafkaMessage(MessageTypeSimulationInit),
		EventTime:          params.EventTime,
	}
}

// -----------------------------------------------------------------------------
// SimulationTerminate
// -----------------------------------------------------------------------------

type KafkaMessageSimulationTerminatePayload struct {
	Reason string `json:"reason"`
}

type KafkaMessageSimulationTerminate struct {
	CommonKafkaMessage
	EventTime float64                                 `json:"eventTime"`
	Payload   *KafkaMessageSimulationTerminatePayload `json:"payload,omitempty"`
}

type KafkaMessageSimulationTerminateParams struct {
	EventTime float64                                 `json:"eventTime"`
	Payload   *KafkaMessageSimulationTerminatePayload `json:"payload,omitempty"`
}

func (b *BaseKafkaMessage) NewKafkaMessageSimulationTerminate(params KafkaMessageSimulationTerminateParams) KafkaMessageSimulationTerminate {
	return KafkaMessageSimulationTerminate{
		CommonKafkaMessage: b.newCommonKafkaMessage(MessageTypeSimulationTerminate),
		EventTime:          params.EventTime,
		Payload:            params.Payload,
	}
}

// -----------------------------------------------------------------------------
// ModelTerminated
// -----------------------------------------------------------------------------

type KafkaMessageModelTerminated struct {
	CommonKafkaMessage
}

func (b *BaseKafkaMessage) NewKafkaMessageModelTerminated() KafkaMessageModelTerminated {
	return KafkaMessageModelTerminated{
		CommonKafkaMessage: b.newCommonKafkaMessage(MessageTypeModelTerminated),
	}
}

// -----------------------------------------------------------------------------
// NextInternalTimeReport
// -----------------------------------------------------------------------------

type KafkaMessageNextInternalTimeReport struct {
	CommonKafkaMessage
	EventTime        float64 `json:"eventTime"`
	NextInternalTime float64 `json:"nextInternalTime"`
}

type KafkaMessageNextInternalTimeReportParams struct {
	EventTime        float64 `json:"eventTime"`
	NextInternalTime float64 `json:"nextInternalTime"`
}

func (b *BaseKafkaMessage) NewKafkaMessageNextInternalTimeReport(params KafkaMessageNextInternalTimeReportParams) KafkaMessageNextInternalTimeReport {
	return KafkaMessageNextInternalTimeReport{
		CommonKafkaMessage: b.newCommonKafkaMessage(MessageTypeNextInternalTimeReport),
		EventTime:          params.EventTime,
		NextInternalTime:   params.NextInternalTime,
	}
}

// -----------------------------------------------------------------------------
// RequestOutput
// -----------------------------------------------------------------------------

type KafkaMessageRequestOutput struct {
	CommonKafkaMessage
	EventTime float64 `json:"eventTime"`
}

type KafkaMessageRequestOutputParams struct {
	EventTime float64 `json:"eventTime"`
}

func (b *BaseKafkaMessage) NewKafkaMessageRequestOutput(params KafkaMessageRequestOutputParams) KafkaMessageRequestOutput {
	return KafkaMessageRequestOutput{
		CommonKafkaMessage: b.newCommonKafkaMessage(MessageTypeRequestOutput),
		EventTime:          params.EventTime,
	}
}

// -----------------------------------------------------------------------------
// OutputReport
// -----------------------------------------------------------------------------

type KafkaMessageOutputReportPayload struct {
	Outputs          []*KafkaMessagePortPayload `json:"outputs"`
	AdditionalFields *map[string]any            `json:"additionalFields,omitempty"`
}

type KafkaMessageOutputReport struct {
	CommonKafkaMessage
	EventTime        float64                         `json:"eventTime"`
	NextInternalTime float64                         `json:"nextInternalTime"`
	Payload          KafkaMessageOutputReportPayload `json:"payload"`
}

type KafkaMessageOutputReportParams struct {
	EventTime        float64                         `json:"eventTime"`
	NextInternalTime float64                         `json:"nextInternalTime"`
	Payload          KafkaMessageOutputReportPayload `json:"payload"`
}

func (b *BaseKafkaMessage) NewKafkaMessageOutputReport(params KafkaMessageOutputReportParams) KafkaMessageOutputReport {
	return KafkaMessageOutputReport{
		CommonKafkaMessage: b.newCommonKafkaMessage(MessageTypeOutputReport),
		EventTime:          params.EventTime,
		NextInternalTime:   params.NextInternalTime,
		Payload:            params.Payload,
	}
}

// -----------------------------------------------------------------------------
// ExecuteTransition
// -----------------------------------------------------------------------------

type KafkaMessageExecuteTransitionPayload struct {
	Inputs []*KafkaMessagePortPayload `json:"inputs"`
}

type KafkaMessageExecuteTransition struct {
	CommonKafkaMessage
	EventTime float64                              `json:"eventTime"`
	Payload   KafkaMessageExecuteTransitionPayload `json:"payload"`
}

type KafkaMessageExecuteTransitionParams struct {
	EventTime float64                              `json:"eventTime"`
	Payload   KafkaMessageExecuteTransitionPayload `json:"payload"`
}

func (b *BaseKafkaMessage) NewKafkaMessageExecuteTransition(params KafkaMessageExecuteTransitionParams) KafkaMessageExecuteTransition {
	return KafkaMessageExecuteTransition{
		CommonKafkaMessage: b.newCommonKafkaMessage(MessageTypeExecuteTransition),
		EventTime:          params.EventTime,
		Payload:            params.Payload,
	}
}

// -----------------------------------------------------------------------------
// TransitionComplete
// -----------------------------------------------------------------------------

type KafkaMessageTransitionComplete struct {
	CommonKafkaMessage
	EventTime        float64 `json:"eventTime"`
	NextInternalTime float64 `json:"nextInternalTime"`
}

type KafkaMessageTransitionCompleteParams struct {
	EventTime        float64 `json:"eventTime"`
	NextInternalTime float64 `json:"nextInternalTime"`
}

func (b *BaseKafkaMessage) NewKafkaMessageTransitionComplete(params KafkaMessageTransitionCompleteParams) KafkaMessageTransitionComplete {
	return KafkaMessageTransitionComplete{
		CommonKafkaMessage: b.newCommonKafkaMessage(MessageTypeTransitionComplete),
		EventTime:          params.EventTime,
		NextInternalTime:   params.NextInternalTime,
	}
}

// -----------------------------------------------------------------------------
// MonitoringMessage
// -----------------------------------------------------------------------------

type KafkaMessageMonitoringMessagePayload struct {
	Category   KafkaMessageMonitoringMessagePayloadCategory `json:"category"`
	Values     map[string]any                               `json:"values"`
	SourceRole *string                                      `json:"sourceRole,omitempty"`
}

type KafkaMessageMonitoringMessage struct {
	CommonKafkaMessage
	EventTime float64                              `json:"eventTime"`
	Payload   KafkaMessageMonitoringMessagePayload `json:"payload"`
}

type KafkaMessageMonitoringMessageParams struct {
	EventTime float64                              `json:"eventTime"`
	Payload   KafkaMessageMonitoringMessagePayload `json:"payload"`
}

func (b *BaseKafkaMessage) NewKafkaMessageMonitoringMessage(params KafkaMessageMonitoringMessageParams) KafkaMessageMonitoringMessage {
	return KafkaMessageMonitoringMessage{
		CommonKafkaMessage: b.newCommonKafkaMessage(MessageTypeMonitoringMessage),
		EventTime:          params.EventTime,
		Payload:            params.Payload,
	}
}

// -----------------------------------------------------------------------------
// ErrorReport
// -----------------------------------------------------------------------------

type KafkaMessageErrorReportPayload struct {
	OriginRole       KafkaMessageErrorReportPayloadOriginRole `json:"originRole"`
	OriginID         string                                   `json:"originId"`
	Severity         KafkaMessageErrorReportPayloadSeverity   `json:"severity"`
	ErrorCode        int64                                    `json:"errorCode"`
	Message          string                                   `json:"message"`
	AdditionalFields *map[string]any                          `json:"additionalFields,omitempty"`
}

type KafkaMessageErrorReport struct {
	CommonKafkaMessage
	EventTime float64                        `json:"eventTime"`
	Payload   KafkaMessageErrorReportPayload `json:"payload"`
}

type KafkaMessageErrorReportParams struct {
	EventTime float64                        `json:"eventTime"`
	Payload   KafkaMessageErrorReportPayload `json:"payload"`
}

func (b *BaseKafkaMessage) NewKafkaMessageErrorReport(params KafkaMessageErrorReportParams) KafkaMessageErrorReport {
	return KafkaMessageErrorReport{
		CommonKafkaMessage: b.newCommonKafkaMessage(MessageTypeErrorReport),
		EventTime:          params.EventTime,
		Payload:            params.Payload,
	}
}

type KafkaMessageInterface interface {
	GetMessageType() MessageType
	GetSenderID() string
	GetReceiverID() string
}

func MarshalKafkaMessage(msg KafkaMessageInterface) ([]byte, error) {
	return json.Marshal(msg)
}

// Usage example:
// msg, err := kafkaShared.UnmarshalKafkaMessage(record.Value)
// if err != nil { /* handle error */ }
//
// switch m := msg.(type) {
// case *kafka.KafkaMessageOutputReport:
//
//	fmt.Println(m.Payload.Outputs)
//	fmt.Println(m.EventTime)
//
// case *kafka.KafkaMessageSimulationInit:
//
//	fmt.Println(m.EventTime)
//
// case *kafka.KafkaMessageErrorReport:
//
//	    fmt.Println(m.Payload.Severity)
//	}
func UnmarshalKafkaMessage(data []byte) (any, error) {
	var common struct {
		MessageType MessageType `json:"messageType"`
	}
	if err := json.Unmarshal(data, &common); err != nil {
		return nil, err
	}

	switch common.MessageType {
	case MessageTypeSimulationInit:
		var msg KafkaMessageSimulationInit
		err := json.Unmarshal(data, &msg)
		return &msg, err

	case MessageTypeSimulationTerminate:
		var msg KafkaMessageSimulationTerminate
		err := json.Unmarshal(data, &msg)
		return &msg, err

	case MessageTypeModelTerminated:
		var msg KafkaMessageModelTerminated
		err := json.Unmarshal(data, &msg)
		return &msg, err

	case MessageTypeNextInternalTimeReport:
		var msg KafkaMessageNextInternalTimeReport
		err := json.Unmarshal(data, &msg)
		return &msg, err

	case MessageTypeRequestOutput:
		var msg KafkaMessageRequestOutput
		err := json.Unmarshal(data, &msg)
		return &msg, err

	case MessageTypeOutputReport:
		var msg KafkaMessageOutputReport
		err := json.Unmarshal(data, &msg)
		return &msg, err

	case MessageTypeExecuteTransition:
		var msg KafkaMessageExecuteTransition
		err := json.Unmarshal(data, &msg)
		return &msg, err

	case MessageTypeTransitionComplete:
		var msg KafkaMessageTransitionComplete
		err := json.Unmarshal(data, &msg)
		return &msg, err

	case MessageTypeMonitoringMessage:
		var msg KafkaMessageMonitoringMessage
		err := json.Unmarshal(data, &msg)
		return &msg, err

	case MessageTypeErrorReport:
		var msg KafkaMessageErrorReport
		err := json.Unmarshal(data, &msg)
		return &msg, err

	default:
		return nil, fmt.Errorf("unknown message type: %s", common.MessageType)
	}
}
