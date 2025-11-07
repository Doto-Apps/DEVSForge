package internal

import (
	"context"
	"log"
	"os"

	"devsforge/simulator/shared"

	"github.com/rs/zerolog"
	"github.com/segmentio/kafka-go"
)

//
// PRODUCER
//

// KafkaProducer est un producer Kafka, utilisé à la fois pour Zerolog et pour les messages DEVS-SF.
type KafkaProducer struct {
	writer *kafka.Writer
	level  zerolog.Level
}

// NewKafkaProducer crée un producer Kafka qui envoie uniquement les messages du niveau donné.
func NewKafkaProducer(broker string, topic string, level zerolog.Level) *KafkaProducer {
	writer := &kafka.Writer{
		Addr:     kafka.TCP(broker),
		Topic:    topic,
		Balancer: &kafka.LeastBytes{},
	}

	return &KafkaProducer{
		writer: writer,
		level:  level,
	}
}

// Write implémente io.Writer pour Zerolog (logs -> Kafka).
func (p *KafkaProducer) Write(msg []byte) (int, error) {
	if p.level <= zerolog.InfoLevel {
		err := p.writer.WriteMessages(context.Background(),
			kafka.Message{
				Value: msg,
			},
		)
		if err != nil {
			return 0, err
		}
	}
	return len(msg), nil
}

// SendMessage envoie un message texte brut (utile pour du legacy, debug, etc.).
func (p *KafkaProducer) SendMessage(value string) error {
	return p.writer.WriteMessages(context.Background(),
		kafka.Message{
			Value: []byte(value),
		})
}

// SendDevsMessage envoie un message DEVS-SF typé (KafkaMessage sérialisé en JSON).
func (p *KafkaProducer) SendDevsMessage(msg *shared.KafkaMessage) error {
	data, err := msg.Marshal()
	if err != nil {
		return err
	}

	return p.writer.WriteMessages(context.Background(),
		kafka.Message{
			Value: data,
		})
}

// Close ferme le writer Kafka.
func (p *KafkaProducer) Close() error {
	return p.writer.Close()
}

// NewLoggerWithKafka crée un logger Zerolog.
// INFO → Kafka + console
// Autres niveaux → console uniquement.
func NewLoggerWithKafka(broker string, topic string, runnerID string) (zerolog.Logger, *KafkaProducer) {
	producer := NewKafkaProducer(broker, topic, zerolog.InfoLevel)

	logger := zerolog.New(zerolog.MultiLevelWriter(
		zerolog.ConsoleWriter{Out: os.Stdout}, // tous les niveaux sur console
	)).With().Timestamp().Str("id", runnerID).Logger()

	return logger, producer
}

//
// CONSUMER
//

type KafkaCollector struct {
	reader *kafka.Reader
}

func NewKafkaCollector(broker string, topic, runnerID string) *KafkaCollector {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:  []string{broker},
		Topic:    topic,
		GroupID:  runnerID,
		MinBytes: 1,
		MaxBytes: 10e6, // 10MB
	})
	log.Printf("Reading on kafka host: %s", broker)
	return &KafkaCollector{reader: reader}
}

// StartRaw : boucle générique qui lit Kafka et passe les bytes au handler.
func (c *KafkaCollector) StartRaw(handler func([]byte) error) {
	go func() {
		defer c.reader.Close()
		for {
			m, err := c.reader.ReadMessage(context.Background())
			if err != nil {
				log.Printf("❌ Kafka read error: %v", err)
				continue
			}
			if err := handler(m.Value); err != nil {
				log.Printf("⚠️ handler error: %v", err)
			}
		}
	}()
}

// StartDevsLoop : boucle typée DEVS-SF, qui parse KafkaMessage et appelle un handler.
func (c *KafkaCollector) StartDevsLoop(handler func(*shared.KafkaMessage) error) {
	c.StartRaw(func(data []byte) error {
		devsMsg, err := shared.UnmarshalKafkaMessage(data)
		if err != nil {
			log.Printf("⚠️ invalid DEVS-SF message JSON: %v (raw=%s)", err, string(data))
			return nil // on ignore juste ce message
		}
		return handler(devsMsg)
	})
}

func (c *KafkaCollector) Close() error {
	return c.reader.Close()
}
