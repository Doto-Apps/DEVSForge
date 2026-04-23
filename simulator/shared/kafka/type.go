// Package shared contient les types génériques partagés entre runner / coord / wrappers.
package kafka

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
)

// MsgType représente le type logique du message DEVS-SF transporté sur Kafka.
// On s'aligne sur les valeurs texte vues dans l'exemple simlytics.
type MsgType string

const (
	MsgTypeSimulationInit         MsgType = "SimulationInit"
	MsgTypeNextInternalTimeReport MsgType = "NextInternalTimeReport"
	MsgTypeExecuteTransition      MsgType = "ExecuteTransition"
	MsgTypeTransitionComplete     MsgType = "TransitionComplete"
	MsgTypeRequestOutput          MsgType = "RequestOutput"
	MsgTypeOutputReport           MsgType = "OutputReport"
	MsgTypeSimulationTerminate    MsgType = "SimulationTerminate"
	MsgTypeModelTerminated        MsgType = "ModelTerminated"
	MsgTypeMonitoringMessage      MsgType = "MonitoringMessage"
	MsgTypeErrorReport            MsgType = "ErrorReport"
)

type DevsSimTimeType string

const (
	DevsLongSimTime   DevsSimTimeType = "devs.msg.time.LongSimTime"
	DevsDoubleSimTime DevsSimTimeType = "devs.msg.time.DoubleSimTime"
)

func (t DevsSimTimeType) String() string {
	return string(t)
}

// SimTime représente le champ "time" (ou "nextInternalTime") dans l'exemple.
// Pour l'instant on simplifie : on garde le double t, timeType est optionnel.
type SimTime struct {
	TimeType string  `json:"timeType,omitempty"`
	T        float64 `json:"t"`
}

// PortValue représente un élément de "portValueList" dans les messages ExecuteTransition / ModelOutputMessage.
type PortValue struct {
	PortIdentifier string      `json:"portIdentifier"`
	PortType       string      `json:"portType,omitempty"`
	Value          interface{} `json:"value,omitempty"`
}

// ModelInputsOption correspond à "modelInputsOption" { "portValueList": [...] }.
type ModelInputsOption struct {
	PortValueList []PortValue `json:"portValueList,omitempty"`
}

// ModelOutput correspond à "modelOutput" { "portValueList": [...] }.
type ModelOutput struct {
	PortValueList []PortValue `json:"portValueList,omitempty"`
}

// BaseKafkaMessage est la structure simplifiée qui colle aux exemples DEVS-SF.
// DO NOT USE DIRECTLY : Use strongly typed messages
type BaseKafkaMessage struct {
	MsgType           MsgType            `json:"msgType"`
	SimulationRunID   string             `json:"simulationRunId,omitempty"`
	MessageID         string             `json:"messageId,omitempty"`
	EventTime         *SimTime           `json:"eventTime,omitempty"`
	NextInternalTime  *SimTime           `json:"nextInternalTime,omitempty"`
	SenderID          string             `json:"senderId,omitempty"`
	ReceiverID        string             `json:"receiverId,omitempty"`
	ModelInputsOption *ModelInputsOption `json:"modelInputsOption,omitempty"`
	ModelOutput       *ModelOutput       `json:"modelOutput,omitempty"`
	Payload           map[string]any     `json:"payload,omitempty"`
}

type KafkaMessageInitSim struct {
	MsgType    MsgType  `json:"msgType"`
	EventTime  *SimTime `json:"evenTime,omitempty"`
	ReceiverID string   `json:"ReceiverId,omitempty"`
	SenderID   string   `json:"senderId"`
}

type KafkaMessageNextInternalTime struct {
	MsgType          MsgType  `json:"msgType"`
	EventTime        *SimTime `json:"evenTime,omitempty"`
	NextInternalTime SimTime  `json:"nextInternalTime,omitempty"`
	SenderID         string   `json:"senderId"`
}

type KafkaMessageExecuteTransition struct {
	MsgType           MsgType           `json:"msgType"`
	EventTime         SimTime           `json:"eventTime"`
	ReceiverID        string            `json:"receiverId,omitempty"`
	SenderID          string            `json:"senderId"`
	ModelInputsOption ModelInputsOption `json:"modelInputsOption"`
}

type KafkaMessageTransitionDone struct {
	MsgType          MsgType `json:"msgType"`
	EventTime        SimTime `json:"evenTime"`
	NextInternalTime SimTime `json:"nextInternalTime"`
	SenderID         string  `json:"senderId"`
}

type KafkaMessageSendOutput struct {
	MsgType    MsgType  `json:"msgType"`
	EventTime  *SimTime `json:"evenTime,omitempty"`
	ReceiverID string   `json:"receiverId"`
	SenderID   string   `json:"senderId"`
}

type KafkaMessageSimulationDone struct {
	MsgType    MsgType `json:"msgType"`
	ReceiverID string  `json:"receiverId"`
	SenderID   string  `json:"senderId,omitempty"`
}

type KafkaMessageModelOutput struct {
	MsgType     MsgType     `json:"msgType"`
	EventTime   SimTime     `json:"evenTime"`
	SenderID    string      `json:"senderId"`
	ModelOutput ModelOutput `json:"modelOutput"`
}

type ErrorReportPayload struct {
	OriginRole string         `json:"originRole"`
	OriginID   string         `json:"originId"`
	Severity   string         `json:"severity"`
	ErrorCode  any            `json:"errorCode"`
	Message    string         `json:"message"`
	Details    map[string]any `json:"details,omitempty"`
}

type KafkaMessageErrorReport struct {
	BaseKafkaMessage
	Payload ErrorReportPayload `json:"payload"`
}

type KafkaMessageI interface {
	Marshal() ([]byte, error)
}

func (m *BaseKafkaMessage) Marshal() ([]byte, error) {
	return json.Marshal(m)
}

func (m *KafkaMessageInitSim) Marshal() ([]byte, error) {
	return json.Marshal(m)
}

func (m *KafkaMessageNextInternalTime) Marshal() ([]byte, error) {
	return json.Marshal(m)
}

func (m *KafkaMessageExecuteTransition) Marshal() ([]byte, error) {
	return json.Marshal(m)
}

func (m *KafkaMessageTransitionDone) Marshal() ([]byte, error) {
	return json.Marshal(m)
}
func (m *KafkaMessageSendOutput) Marshal() ([]byte, error) {
	return json.Marshal(m)
}
func (m *KafkaMessageModelOutput) Marshal() ([]byte, error) {
	return json.Marshal(m)
}
func (m *KafkaMessageSimulationDone) Marshal() ([]byte, error) {
	return json.Marshal(m)
}

func (m *KafkaMessageErrorReport) Marshal() ([]byte, error) {
	return json.Marshal(m)
}

func NewMessageID() string {
	raw := make([]byte, 16)
	if _, err := rand.Read(raw); err != nil {
		return "msg-" + hex.EncodeToString([]byte("fallback"))
	}
	return "msg-" + hex.EncodeToString(raw)
}
