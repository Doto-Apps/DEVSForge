// Package shared contient les types génériques partagés entre runner / coord / wrappers.
package kafka

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

// KafkaMessage est la structure simplifiée qui colle aux exemples DEVS-SF.
// Elle te permet de (un)marshal directement ce qui transite sur Kafka.
type KafkaMessage struct {
	DevsType          DevsType           `json:"devsType"`           // type logique du message
	Time              *SimTime           `json:"time,omitempty"`     // temps courant du message
	NextTime          *SimTime           `json:"nextTime,omitempty"` // temps de la prochaine transition (NextTime / TransitionDone / ModelOutput)
	Sender            string             `json:"sender,omitempty"`   // ex: "clerk1"
	Target            string             `json:"target,omitempty"`
	ModelInputsOption *ModelInputsOption `json:"modelInputsOption,omitempty"` // pour ExecuteTransition
	ModelOutput       *ModelOutput       `json:"modelOutput,omitempty"`       // pour ModelOutputMessage
}
