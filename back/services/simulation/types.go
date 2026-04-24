package simulation

type SimulateRequestBody struct {
	JSON       string `json:"json"`
	KafkaAddr  string `json:"kafka"`
	KafkaTopic string `json:"topic"`
}
