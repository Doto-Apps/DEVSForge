package internal

import (
	"context"
	"log"
	"os"

	"github.com/rs/zerolog"
	"github.com/segmentio/kafka-go"
)

//
// PRODUCER
//

// KafkaProducer est un producer basé sur Zerolog
type KafkaProducer struct {
	writer *kafka.Writer
	level  zerolog.Level
}

// NewKafkaProducer crée un producer Kafka qui envoie uniquement les messages du niveau donné
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

// Write implémente io.Writer pour Zerolog
func (p *KafkaProducer) Write(msg []byte) (int, error) {
	if p.level <= zerolog.InfoLevel {
		err := p.writer.WriteMessages(context.Background(),
			kafka.Message{
				Value: []byte(msg),
			},
		)
		if err != nil {
			return 0, err
		}
	}
	return len(msg), nil
}

func (p *KafkaProducer) SendMessage(value string) error {
	return p.writer.WriteMessages(context.Background(),
		kafka.Message{
			Value: []byte(value),
		})
}

// Close ferme le writer Kafka
func (p *KafkaProducer) Close() error {
	return p.writer.Close()
}

// NewLoggerWithKafka crée un logger Zerolog
// INFO → Kafka + console
// Autres niveaux → console uniquement
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

func (c *KafkaCollector) Start() {
	go func() {
		defer c.reader.Close()
		for {
			m, err := c.reader.ReadMessage(context.Background())
			if err != nil {
				log.Printf("❌ Kafka read error: %v", err)
				continue
			}
			log.Printf("📥 Kafka message reçu: key=%s value=%s", string(m.Key), string(m.Value))
			HandleMessage(string(m.Value))
		}
	}()
}

func (c *KafkaCollector) Close() error {
	return c.reader.Close()
}
