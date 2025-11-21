package main

import (
	"encoding/json"

	"devsforge/simulator/shared"
	modeling "devsforge/simulator/wrappers/go/modeling"
)

type GeneratorIncrementalParameters struct {
	value int
	color string
}

type GeneratorIncremental struct {
	modeling.Atomic
	Parameters GeneratorIncrementalParameters
	storage    string
}

func NewModel(cfg shared.RunnableModel) modeling.Atomic {
	base := &GeneratorIncremental{
		Atomic: modeling.NewAtomic(cfg),
		Parameters: GeneratorIncrementalParameters{
			value: 0,
			color: "",
		},
	}
	return base
}

// Initialize est appelée avant la simulation.
func (m *GeneratorIncremental) Initialize() {
	m.Parameters.value = 0
	m.storage = "base"
	m.HoldIn("active", 1.0)
}

// Exit est appelée après la simulation.
func (m *GeneratorIncremental) Exit() {
	// no-op pour l’instant
}

// DeltInt : transition interne
func (m *GeneratorIncremental) DeltInt() {
	m.Parameters.value++

	if m.Parameters.value >= 3 {
		m.Passivate()
		m.storage = "gt 3"
	} else {
		m.HoldIn("active", 1.0)
	}
}

// DeltExt : transition externe
// Ici, on ignore les inputs et on ajuste juste sigma.
func (m *GeneratorIncremental) DeltExt(e float64) {
	m.Continue(e)
}

// DeltCon : confluent (interne + externe en même temps).
// On fait simple : interne prioritaire.
func (m *GeneratorIncremental) DeltCon(e float64) {
	m.DeltInt()
}

// Lambda : fonction de sortie
// Envoie la valeur courante sur le port "out" sous forme JSON.
func (m *GeneratorIncremental) Lambda() {
	outPort, err := m.GetPortByName("out")
	if err != nil {
		return
	}

	payload, err := json.Marshal(map[string]int{
		"value": m.Parameters.value,
	})
	if err != nil {
		return
	}
	outPort.AddValue(payload)

}
