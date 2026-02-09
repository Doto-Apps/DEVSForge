package shared

type YamlInputConfigKafka struct {
	Enabled bool   `yaml:"enabled"`
	Address string `yaml:"address"`
	Topic   string `yaml:"topic"`
}

type YamlInputConfigGRPC struct {
	Host string `yaml:"host"`
	Port int    `yaml:"port"`
}

type YamlInputConfig struct {
	Kafka        YamlInputConfigKafka `yaml:"kafka"`
	GRPC         YamlInputConfigGRPC  `yaml:"grpc"`
	TmpDirectory string               `yaml:"tmpDirectory"`
}
