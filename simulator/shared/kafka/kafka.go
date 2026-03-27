package kafka

import (
	"log/slog"
	"time"

	"github.com/twmb/franz-go/pkg/kgo"
)

type KafkaConfig struct {
	Config []kgo.Opt
}

func NewKafkaConfig(brokerAdress string, topic string, ID string) *KafkaConfig {
	opts := []kgo.Opt{
		kgo.SeedBrokers(brokerAdress),
		kgo.ClientID(ID), // tu peux mettre un autre ID si tu veux distinguer client / group

		// Consumer group
		kgo.ConsumerGroup(ID),
		kgo.ConsumeTopics(topic),

		// Démarrage & reset des offsets (équivalent auto.offset.reset = earliest)
		kgo.ConsumeStartOffset(kgo.NewOffset().AtStart()),
		kgo.ConsumeResetOffset(kgo.NewOffset().AtStart()),

		// Producteur simple sur un topic par défaut
		kgo.DefaultProduceTopic(topic),

		// Gestion plus safe des rebalances
		kgo.BlockRebalanceOnPoll(),
		kgo.RebalanceTimeout(2 * time.Second),

		kgo.AutoCommitInterval(1 * time.Second),
		kgo.TransactionTimeout(3 * time.Second),
	}
	slog.Info("Kafka config initialized", "broker", brokerAdress)
	return &KafkaConfig{Config: opts}
}
