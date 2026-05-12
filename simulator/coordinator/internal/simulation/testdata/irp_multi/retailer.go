package main

import (
	"fmt"
	"math"
	"strconv"

	modeling "devsforge-wrapper/modeling"
)

const minutesPerDay int64 = 24 * 60

type RetailerIRP struct {
	modeling.Atomic
	parameters       map[string]interface{}
	currentTime      int64
	nextCloseAt      int64
	currentInventory float64
	retailerID       int
	minInventory     float64
	maxInventory     float64
	dailyConsumption float64
	inventoryCost    float64
	closingHour      int
}

func NewModel(cfg modeling.RunnableModel) modeling.Atomic {
	params := make(map[string]interface{}, len(cfg.Parameters))
	for _, p := range cfg.Parameters {
		params[p.Name] = p.Value
	}
	return &RetailerIRP{
		Atomic:     modeling.NewAtomic(cfg),
		parameters: params,
	}
}

func (m *RetailerIRP) Initialize() {
	m.currentTime = 0
	m.retailerID = asIntRetailer(m.parameters["retailer_id"], 0)
	m.currentInventory = asFloatRetailer(m.parameters["starting_inventory"], 0)
	m.minInventory = asFloatRetailer(m.parameters["min_inventory"], 0)
	m.maxInventory = asFloatRetailer(m.parameters["max_inventory"], 0)
	m.dailyConsumption = asFloatRetailer(m.parameters["daily_consumption"], 0)
	m.inventoryCost = asFloatRetailer(m.parameters["inventory_cost"], 0)
	m.closingHour = asIntRetailer(m.parameters["closing_hour"], 16)
	m.nextCloseAt = int64(m.closingHour) * 60
}

func (m *RetailerIRP) Exit() {}

func (m *RetailerIRP) TA() float64 {
	delta := float64(m.nextCloseAt - m.currentTime)
	if delta < 0 {
		return 0
	}
	return delta
}

func (m *RetailerIRP) DeltInt() {
	m.currentTime = m.nextCloseAt

	if m.currentInventory > m.maxInventory {
		fmt.Printf("Retailer %d exceeded max inventory: current=%f max=%f\n", m.retailerID, m.currentInventory, m.maxInventory)
	}

	m.currentInventory -= m.dailyConsumption

	if m.currentInventory < m.minInventory {
		fmt.Printf("Retailer %d below min inventory: current=%f min=%f\n", m.retailerID, m.currentInventory, m.minInventory)
	}

	m.nextCloseAt += minutesPerDay
}

func (m *RetailerIRP) DeltExt(e float64) {
	m.currentTime += int64(math.Round(e))

	port, err := m.GetPortByName("receiveDelivery")
	if err != nil {
		return
	}
	if values, ok := port.GetValues().([]interface{}); ok {
		for _, value := range values {
			delivery, ok := asMapRetailer(value)
			if !ok {
				continue
			}
			deliveryRetailerID := asIntRetailer(delivery["retailerId"], -1)
			if deliveryRetailerID != m.retailerID {
				continue
			}
			m.currentInventory += asFloatRetailer(delivery["productAmount"], 0)
		}
	}
	port.Clear()
}

func (m *RetailerIRP) DeltCon(e float64) {
	m.DeltInt()
	m.DeltExt(0)
}

func (m *RetailerIRP) Lambda() {
	predictedInventory := m.currentInventory - m.dailyConsumption
	payload := map[string]interface{}{
		"day":        dayFromMinute(m.nextCloseAt),
		"retailerId": m.retailerID,
		"cost":       predictedInventory * m.inventoryCost,
	}

	port, err := m.GetPortByName("dailyInventoryCost")
	if err != nil {
		return
	}
	port.AddValue(payload)
}

func dayFromMinute(minute int64) int {
	if minute < 0 {
		return 1
	}
	return int(minute/minutesPerDay) + 1
}

func asMapRetailer(value interface{}) (map[string]interface{}, bool) {
	m, ok := value.(map[string]interface{})
	return m, ok
}

func asIntRetailer(value interface{}, fallback int) int {
	switch v := value.(type) {
	case int:
		return v
	case int64:
		return int(v)
	case int32:
		return int(v)
	case float64:
		return int(v)
	case float32:
		return int(v)
	case string:
		if p, err := strconv.Atoi(v); err == nil {
			return p
		}
	}
	return fallback
}

func asFloatRetailer(value interface{}, fallback float64) float64 {
	switch v := value.(type) {
	case float64:
		return v
	case float32:
		return float64(v)
	case int:
		return float64(v)
	case int64:
		return float64(v)
	case int32:
		return float64(v)
	case string:
		if p, err := strconv.ParseFloat(v, 64); err == nil {
			return p
		}
	}
	return fallback
}
