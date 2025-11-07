package main

import (
	"encoding/json"

	"devsforge/simulator/shared"
	modeling "devsforge/simulator/wrappers/go/modeling"
)

// GeneratorIncremental : petit modèle DEVS de test
// - time advance = 1.0 en phase "active"
// - à chaque internal transition, value++
// - après 3 steps, passivation
// - Lambda() envoie { "value": X } sur le port "out".
type GeneratorIncremental struct {
	modeling.Atomic
	value int
}

// NewModel est l’entrypoint appelé par le wrapper.
// Il reçoit la config complète du modèle (nom, ports, paramètres, etc.)
// et doit retourner un modeling.Atomic prêt à être simulé.
func NewModel(cfg shared.RunnableModel) modeling.Atomic {
	// 1) Création du modèle Atomic de base
	base := modeling.NewAtomic(cfg.Name)

	// 2) Création des ports à partir de la config – typés []string
	for _, port := range cfg.Ports {
		if port.Type == "in" {
			base.AddInPort(modeling.NewPort(port.ID, []string{}))
		} else {
			base.AddOutPort(modeling.NewPort(port.ID, []string{}))
		}
	}

	// 3) Wrap dans notre modèle spécifique
	return &GeneratorIncremental{
		Atomic: base,
		value:  0,
	}
}

// Initialize est appelée avant la simulation.
func (m *GeneratorIncremental) Initialize() {
	m.value = 0
	m.HoldIn("active", 1.0)
}

// Exit est appelée après la simulation.
func (m *GeneratorIncremental) Exit() {
	// no-op pour l’instant
}

// DeltInt : transition interne
func (m *GeneratorIncremental) DeltInt() {
	m.value++

	if m.value >= 3 {
		m.Passivate()
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
	outPort := m.GetOutPort("out")
	if outPort == nil {
		return
	}

	payload, err := json.Marshal(map[string]int{
		"value": m.value,
	})
	if err != nil {
		return
	}

	outPort.AddValue(string(payload))
}
