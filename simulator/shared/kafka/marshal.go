package kafka

import "encoding/json"

// UnmarshalKafkaMessage désérialise un JSON Kafka en KafkaMessage.
func UnmarshalKafkaMessage(data []byte) (*BaseKafkaMessage, error) {
	var msg BaseKafkaMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		return nil, err
	}
	return &msg, nil
}
