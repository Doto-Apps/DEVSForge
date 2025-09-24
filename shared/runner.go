package shared

type YamlInputConfigKafka struct {
	Enabled bool   `yaml:"enabled"`
	Address string `yaml:"address"`
	Topic   string `yaml:"topic"`
}

type YamlInputConfig struct {
	Kafka YamlInputConfigKafka `yaml:"kafka"`
}