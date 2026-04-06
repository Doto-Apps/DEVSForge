// Package shared contient les types génériques partagés entre runner / coord / wrappers.
package kafka

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
)

// DevsType représente le type logique du message DEVS-SF transporté sur Kafka.
// On s'aligne sur les valeurs texte vues dans l'exemple simlytics.
type DevsType string

const (
	DevsTypeInitSim           DevsType = "devs.msg.InitSim"
	DevsTypeNextTime          DevsType = "devs.msg.NextTime"
	DevsTypeExecuteTransition DevsType = "devs.msg.ExecuteTransition"
	DevsTypeTransitionDone    DevsType = "devs.msg.TransitionDone"
	DevsTypeSendOutput        DevsType = "devs.msg.SendOutput"
	DevsTypeModelOutput       DevsType = "devs.msg.ModelOutputMessage"
	DevsTypeSimulationDone    DevsType = "devs.msg.SimulationDone"
)

type MessageType string

const (
	MessageTypeMonitoringMessage MessageType = "MonitoringMessage"
	MessageTypeErrorReport       MessageType = "ErrorReport"
)

func (mt MessageType) String() string {
	return string(mt)
}

func (dt DevsType) String() string {
	return string(dt)
}

type DevsSimTimeType string

const (
	DevsLongSimTime   DevsSimTimeType = "devs.msg.time.LongSimTime"
	DevsDoubleSimTime DevsSimTimeType = "devs.msg.time.DoubleSimTime"
)

func (t DevsSimTimeType) String() string {
	return string(t)
}

// SimTime représente le champ "time" (ou "nextTime") dans l'exemple.
// Pour l'instant on simplifie : on garde le double t, timeType est optionnel.
type SimTime struct {
	TimeType string  `json:"timeType,omitempty"` // ex: "devs.msg.time.DoubleSimTime"
	T        float64 `json:"t"`
}

// PortValue représente un élément de "portValueList" dans les messages ExecuteTransition / ModelOutputMessage.
type PortValue struct {
	PortIdentifier string      `json:"portIdentifier"`     // ex: "arrive", "depart"
	PortType       string      `json:"portType,omitempty"` // ex: "cloud.simlytics.devssfstore.Customer"
	Value          interface{} `json:"value,omitempty"`    // payload (typiquement un struct sérialisable JSON)
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
	DevsType          DevsType           `json:"devsType"` // type logique du message
	MessageType       MessageType        `json:"messageType,omitempty"`
	SimulationRunID   string             `json:"simulationRunId,omitempty"`
	MessageID         string             `json:"messageId,omitempty"`
	SenderID          string             `json:"senderId,omitempty"`
	ReceiverID        string             `json:"receiverId,omitempty"`
	Time              *SimTime           `json:"time,omitempty"` // temps courant du message
	EventTime         *SimTime           `json:"eventTime,omitempty"`
	NextTime          *SimTime           `json:"nextTime,omitempty"` // temps de la prochaine transition (NextTime / TransitionDone / ModelOutput)
	Sender            string             `json:"sender,omitempty"`   // ex: "clerk1"
	Target            string             `json:"target,omitempty"`
	ModelInputsOption *ModelInputsOption `json:"modelInputsOption,omitempty"` // pour ExecuteTransition
	ModelOutput       *ModelOutput       `json:"modelOutput,omitempty"`       // pour ModelOutputMessage
	Payload           map[string]any     `json:"payload,omitempty"`
}

type KafkaMessageInitSim struct {
	DevsType DevsType `json:"devsType"`       // type logique du message
	Time     *SimTime `json:"time,omitempty"` // temps courant du message
	Target   string   `json:"target,omitempty"`
	Sender   string   `json:"sender"` // ex: "clerk1"

}

type KafkaMessageNextTime struct {
	DevsType DevsType `json:"devsType"`           // type logique du message
	Time     *SimTime `json:"time,omitempty"`     // temps courant du message
	NextTime SimTime  `json:"nextTime,omitempty"` // temps courant du message
	Sender   string   `json:"sender"`             // ex: "clerk1"
}

type KafkaMessageExecuteTransition struct {
	DevsType          DevsType          `json:"devsType"` // type logique du message
	Time              SimTime           `json:"time"`     // temps courant du message
	Target            string            `json:"target,omitempty"`
	Sender            string            `json:"sender"`            // ex: "clerk1"
	ModelInputsOption ModelInputsOption `json:"modelInputsOption"` // pour ExecuteTransition
}

type KafkaMessageTransitionDone struct {
	DevsType DevsType `json:"devsType"` // type logique du message
	Time     SimTime  `json:"time"`     // temps courant du message
	NextTime SimTime  `json:"nextTime"` // temps de la prochaine transition (NextTime / TransitionDone / ModelOutput)
	Sender   string   `json:"sender"`   // ex: "clerk1"
}

type KafkaMessageSendOutput struct {
	DevsType DevsType `json:"devsType"`       // type logique du message
	Time     SimTime  `json:"time,omitempty"` // temps courant du message
	Target   string   `json:"target"`         // ex: "clerk1"
	Sender   string   `json:"sender"`         // ex: "clerk1"
}

type KafkaMessageSimulationDone struct {
	DevsType DevsType `json:"devsType"`         // type logique du message
	Target   string   `json:"target"`           // ex: "clerk1"
	Sender   string   `json:"sender,omitempty"` // ex: "clerk1"
}

type KafkaMessageModelOutput struct {
	DevsType    DevsType    `json:"devsType"`    // type logique du message
	Time        SimTime     `json:"time"`        // temps courant du message
	Sender      string      `json:"sender"`      // ex: "clerk1"
	ModelOutput ModelOutput `json:"modelOutput"` // pour ModelOutputMessage
}

type ErrorReportPayload struct {
	OriginRole string         `json:"originRole"`
	OriginID   string         `json:"originId"`
	Severity   string         `json:"severity"` // info|warning|error|fatal
	ErrorCode  any            `json:"errorCode"`
	Message    string         `json:"message"`
	Details    map[string]any `json:"details,omitempty"`
}

type KafkaMessageErrorReport struct {
	MessageType     MessageType        `json:"messageType"`
	SimulationRunID string             `json:"simulationRunId,omitempty"`
	MessageID       string             `json:"messageId"`
	SenderID        string             `json:"senderId"`
	ReceiverID      string             `json:"receiverId"`
	EventTime       *SimTime           `json:"eventTime,omitempty"`
	Payload         ErrorReportPayload `json:"payload"`
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

func (m *KafkaMessageNextTime) Marshal() ([]byte, error) {
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

func NewErrorReportMessage(
	simulationRunID string,
	senderID string,
	receiverID string,
	originRole string,
	originID string,
	severity string,
	errorCode any,
	message string,
	eventTime *SimTime,
	details map[string]any,
) *KafkaMessageErrorReport {
	return &KafkaMessageErrorReport{
		MessageType:     MessageTypeErrorReport,
		SimulationRunID: simulationRunID,
		MessageID:       newMessageID(),
		SenderID:        senderID,
		ReceiverID:      receiverID,
		EventTime:       eventTime,
		Payload: ErrorReportPayload{
			OriginRole: originRole,
			OriginID:   originID,
			Severity:   severity,
			ErrorCode:  errorCode,
			Message:    message,
			Details:    details,
		},
	}
}

func newMessageID() string {
	raw := make([]byte, 16)
	if _, err := rand.Read(raw); err != nil {
		return "msg-" + hex.EncodeToString([]byte("fallback"))
	}
	return "msg-" + hex.EncodeToString(raw)
}
