package main

import (
	"log"

	"devsforge/simulator/shared"
	modeling "devsforge/simulator/wrappers/go/modeling"
)

type Collector struct {
	modeling.Atomic
	Count int
}

func NewModel(cfg shared.RunnableModel) modeling.Atomic {
	return &Collector{
		Atomic: modeling.NewAtomic(cfg),
		Count:  0,
	}
}

func (m *Collector) Initialize() {
	// Pas d'événements internes : on se met en attente
	m.Passivate()
	log.Println("[COLLECTOR] Initialize")
}

func (m *Collector) Exit() {
	log.Printf("[COLLECTOR] Exit, messages reçus ~ %d\n", m.Count)
}

// Transition interne : rien de spécial, on reste passif
func (m *Collector) DeltInt() {
	m.Passivate()
}

// Transition externe : on considère qu'on a reçu au moins un message
// (si plus tard tu veux lire les vraies valeurs, tu pourras étendre ici)
func (m *Collector) DeltExt(e float64) {
	m.Count++
	log.Println("[COLLECTOR] DeltExt, nouveau message reçu")
	m.Passivate()
}

// Confluent : on traite comme une externe simple
func (m *Collector) DeltCon(e float64) {
	m.DeltExt(e)
}

// Pas de sortie
func (m *Collector) Lambda() {
	// no-op
}
