package main

import (
	modeling "devsforge-wrapper/modeling"
	"encoding/json"
)

type GoSender struct {
	modeling.Atomic
	InitialValue int
	Sent         bool
}

func NewModel(cfg modeling.RunnableModel) modeling.Atomic {
	return &GoSender{
		Atomic:       modeling.NewAtomic(cfg),
		InitialValue: 5,
		Sent:         false,
	}
}

func (m *GoSender) Initialize() {
	m.Sent = false
	m.HoldIn("active", 0.0)
}

func (m *GoSender) Exit() {}

func (m *GoSender) DeltInt() {
	m.Passivate()
}

func (m *GoSender) DeltExt(e float64) {
	m.Continue(e)
}

func (m *GoSender) DeltCon(e float64) {
	m.DeltInt()
}

func (m *GoSender) Lambda() {
	if m.Sent {
		m.Passivate()
		return
	}

	outPort, err := m.GetPortByName("out")
	if err != nil {
		return
	}

	payload, err := json.Marshal(map[string]int{
		"value": m.InitialValue,
	})
	if err != nil {
		return
	}

	outPort.AddValue(payload)
	m.Sent = true
	m.HoldIn("active", 1.0)
}
