package main

import (
	modeling "devsforge/simulator/wrappers/go/modeling"
)

// GeneratorIncremental: génère un tick toutes les 1.0 unités de temps, 3 fois, puis se passivise.
type GeneratorIncremental struct {
	modeling.Atomic
	value int
}

// A chaque interne: on "émet" logiquement un incrément via Lambda() puis on reprogramme dans 1.0,
// et après 3 incréments on se passivise.
func (m *GeneratorIncremental) DeltInt() {
	m.value++
	if m.value >= 3 {
		m.Passivate()
	} else {
		m.HoldIn("active", 1.0)
	}
}

// Pas d'influence externe: on aligne juste le sigma.
func (m *GeneratorIncremental) DeltExt(e float64) {
	m.Continue(e)
}

// Confluent: interne prioritaire pour simplicité.
func (m *GeneratorIncremental) DeltCon(e float64) {
	m.DeltInt()
}

// Pas d'output matériel ici (le bootstrap n'achemine pas encore les sorties), on laisse vide.
func (m *GeneratorIncremental) Lambda() {
	// no-op
}
