package kafka

import "encoding/json"

// Marshal sérialise le message en JSON prêt à être envoyé dans Kafka.
func (m *KafkaMessage) Marshal() ([]byte, error) {
	return json.Marshal(m)
}

// UnmarshalKafkaMessage désérialise un JSON Kafka en KafkaMessage.
func UnmarshalKafkaMessage(data []byte) (*KafkaMessage, error) {
	var msg KafkaMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		return nil, err
	}
	return &msg, nil
}
