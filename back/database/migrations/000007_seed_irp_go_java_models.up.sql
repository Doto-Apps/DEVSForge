-- Seed IRP model libraries for Go and Java.
-- The Python IRP seed lives in 000004_seed_admin_models.up.sql.
-- Component modelId values are remapped to the language-specific child model IDs.

INSERT INTO libraries (id, user_id, title, description, created_at, updated_at, deleted_at)
SELECT '2f49a189-7084-5e0d-bdc0-9082a7faac9d'::uuid, u.id, 'IRP-Go', 'Inventory Routing Problem seed models in Go.', NOW(), NOW(), NULL
FROM users u
WHERE u.username = 'admin'
ON CONFLICT (id) DO NOTHING;

INSERT INTO models (id, user_id, lib_id, name, type, language, description, code, ports, metadata, connections, components, created_at, updated_at, deleted_at)
SELECT '79af7ea9-62b1-5dc2-ac95-51c8e5808289'::uuid, u.id, '2f49a189-7084-5e0d-bdc0-9082a7faac9d'::uuid, $irp_go_deliveryschedulegenerator_name$DeliveryScheduleGenerator$irp_go_deliveryschedulegenerator_name$, 'atomic'::model_type, 'go'::model_language, $irp_go_deliveryschedulegenerator_description$$irp_go_deliveryschedulegenerator_description$, $irp_go_deliveryschedulegenerator_code$package main

import (
	"math"
	"strconv"

	modeling "devsforge-wrapper/modeling"
)

type DeliveryScheduleGeneratorIRP struct {
	modeling.Atomic
	parameters   map[string]interface{}
	currentTime  int64
	posted       bool
	scheduleData map[string]interface{}
}

func NewModel(cfg modeling.RunnableModel) modeling.Atomic {
	params := make(map[string]interface{}, len(cfg.Parameters))
	for _, p := range cfg.Parameters {
		params[p.Name] = p.Value
	}
	return &DeliveryScheduleGeneratorIRP{
		Atomic:     modeling.NewAtomic(cfg),
		parameters: params,
	}
}

func (m *DeliveryScheduleGeneratorIRP) Initialize() {
	m.currentTime = 0
	m.posted = false

	if custom, ok := asMapGenerator(m.parameters["delivery_schedule"]); ok {
		m.scheduleData = custom
		return
	}

	m.scheduleData = m.buildScheduleFromParameters()
}

func (m *DeliveryScheduleGeneratorIRP) Exit() {}

func (m *DeliveryScheduleGeneratorIRP) TA() float64 {
	if m.posted {
		return modeling.INFINITY
	}
	return 0
}

func (m *DeliveryScheduleGeneratorIRP) DeltInt() {
	m.posted = true
}

func (m *DeliveryScheduleGeneratorIRP) DeltExt(e float64) {
	m.currentTime += int64(math.Round(e))
}

func (m *DeliveryScheduleGeneratorIRP) DeltCon(e float64) {
	m.DeltInt()
	m.DeltExt(0)
}

func (m *DeliveryScheduleGeneratorIRP) Lambda() {
	if m.posted {
		return
	}
	port, err := m.GetPortByName("postDeliverySchedule")
	if err != nil {
		return
	}
	port.AddValue(m.scheduleData)
}

func (m *DeliveryScheduleGeneratorIRP) buildScheduleFromParameters() map[string]interface{} {
	numTimePeriods := asIntGenerator(m.parameters["num_time_periods"], 1)
	numVehicles := asIntGenerator(m.parameters["num_vehicles"], 1)
	vehicleCapacity := asFloatGenerator(m.parameters["vehicle_capacity"], 100)

	retailersRaw, _ := asSliceGenerator(m.parameters["retailers"])
	retailers := make([]map[string]interface{}, 0, len(retailersRaw))
	for _, item := range retailersRaw {
		retailer, ok := asMapGenerator(item)
		if !ok {
			continue
		}
		retailers = append(retailers, retailer)
	}

	deliveriesByDayByVehicle := map[string]interface{}{}

	for day := 1; day <= numTimePeriods; day++ {
		retailerIndex := 0
		dailyDeliveries := map[string]interface{}{}

		for vehicleID := 0; vehicleID < numVehicles; vehicleID++ {
			deliveryRoute := map[string]interface{}{
				"vehicleId":  vehicleID,
				"deliveries": []interface{}{},
			}

			if retailerIndex >= len(retailers) {
				continue
			}

			retailerData := retailers[retailerIndex]
			loadedQuantity := asFloatGenerator(retailerData["daily_consumption"], 0)
			vehicleLoad := 0.0

			for vehicleLoad+loadedQuantity < vehicleCapacity && retailerIndex < len(retailers) {
				vehicleLoad += loadedQuantity
				retailerID := asIntGenerator(retailerData["id"], retailerIndex)
				delivery := map[string]interface{}{
					"retailerId": retailerID,
					"retailerLocation": map[string]interface{}{
						"x": asFloatGenerator(retailerData["x"], 0),
						"y": asFloatGenerator(retailerData["y"], 0),
					},
					"productAmount": loadedQuantity,
				}
				deliveryRoute["deliveries"] = append(deliveryRoute["deliveries"].([]interface{}), delivery)
				retailerIndex++

				if retailerIndex-1 < len(retailers) {
					retailerData = retailers[retailerIndex-1]
					loadedQuantity = asFloatGenerator(retailerData["daily_consumption"], 0)
				}
			}

			if len(deliveryRoute["deliveries"].([]interface{})) > 0 {
				dailyDeliveries[strconv.Itoa(vehicleID)] = deliveryRoute
			}
		}

		deliveriesByDayByVehicle[strconv.Itoa(day)] = dailyDeliveries
	}

	return map[string]interface{}{
		"deliveriesByDayByVehicle": deliveriesByDayByVehicle,
	}
}

func asMapGenerator(value interface{}) (map[string]interface{}, bool) {
	m, ok := value.(map[string]interface{})
	return m, ok
}

func asSliceGenerator(value interface{}) ([]interface{}, bool) {
	s, ok := value.([]interface{})
	return s, ok
}

func asIntGenerator(value interface{}, fallback int) int {
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

func asFloatGenerator(value interface{}, fallback float64) float64 {
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
$irp_go_deliveryschedulegenerator_code$, $irp_go_deliveryschedulegenerator_ports$[{"id":"99618c33-1876-4d2b-8a7e-cbc2b6699ba2","name":"postDeliverySchedule","type":"out"}]$irp_go_deliveryschedulegenerator_ports$::jsonb, $irp_go_deliveryschedulegenerator_metadata${"style":{"width":200,"height":200},"keyword":[],"position":{"x":0,"y":0},"modelRole":"","parameters":[{"name":"num_time_periods","type":"int","value":0},{"name":"num_vehicles","type":"int","value":0},{"name":"vehicle_capacity","type":"float","value":0},{"name":"retailers","type":"object","value":[]}],"modelColors":{}}$irp_go_deliveryschedulegenerator_metadata$::jsonb, $irp_go_deliveryschedulegenerator_connections$[]$irp_go_deliveryschedulegenerator_connections$::jsonb, $irp_go_deliveryschedulegenerator_components$[]$irp_go_deliveryschedulegenerator_components$::jsonb, NOW(), NOW(), NULL
FROM users u
WHERE u.username = 'admin'
ON CONFLICT (id) DO NOTHING;

INSERT INTO models (id, user_id, lib_id, name, type, language, description, code, ports, metadata, connections, components, created_at, updated_at, deleted_at)
SELECT 'cf77c380-b57c-57b3-bb95-2edb46eb8356'::uuid, u.id, '2f49a189-7084-5e0d-bdc0-9082a7faac9d'::uuid, $irp_go_basicexperimentalframe_name$BasicExperimentalFrame$irp_go_basicexperimentalframe_name$, 'coupled'::model_type, 'go'::model_language, $irp_go_basicexperimentalframe_description$$irp_go_basicexperimentalframe_description$, $irp_go_basicexperimentalframe_code$$irp_go_basicexperimentalframe_code$, $irp_go_basicexperimentalframe_ports$[]$irp_go_basicexperimentalframe_ports$::jsonb, $irp_go_basicexperimentalframe_metadata${"style":{"width":1681,"height":1718},"keyword":[],"position":{"x":-1653.2022877125557,"y":-670.2027664974363},"modelRole":"","modelColors":{}}$irp_go_basicexperimentalframe_metadata$::jsonb, $irp_go_basicexperimentalframe_connections$[{"to":{"port":"receiveDeliverySchedule","instanceId":"580c5c9d-f085-4c63-b85e-57965fd68838"},"from":{"port":"postDeliverySchedule","instanceId":"1b169311-a8d2-4af2-80f6-492f000a901c"}},{"to":{"port":"aggregateInventoryCost","instanceId":"f8537458-e594-4412-a892-1e439b25d9df"},"from":{"port":"reportInventoryCost","instanceId":"580c5c9d-f085-4c63-b85e-57965fd68838"}},{"to":{"port":"aggregateVehicleCost","instanceId":"f8537458-e594-4412-a892-1e439b25d9df"},"from":{"port":"reportVehicleCost","instanceId":"580c5c9d-f085-4c63-b85e-57965fd68838"}}]$irp_go_basicexperimentalframe_connections$::jsonb, $irp_go_basicexperimentalframe_components$[{"modelId":"79af7ea9-62b1-5dc2-ac95-51c8e5808289","instanceId":"1b169311-a8d2-4af2-80f6-492f000a901c","instanceMetadata":{"style":{"width":200,"height":200},"keyword":[],"position":{"x":63.48721200787509,"y":744.3605266425859},"modelRole":"","parameters":[{"name":"num_time_periods","type":"int","value":3},{"name":"num_vehicles","type":"int","value":2},{"name":"vehicle_capacity","type":"float","value":144},{"name":"retailers","type":"object","value":[{"daily_consumption":65,"id":0,"x":172,"y":334},{"daily_consumption":35,"id":1,"x":267,"y":87},{"daily_consumption":58,"id":2,"x":148,"y":433},{"daily_consumption":24,"id":3,"x":355,"y":444},{"daily_consumption":11,"id":4,"x":38,"y":152}]}],"modelColors":{}}},{"modelId":"01c4c9e8-1ff6-51eb-9bf6-c9f1a213a178","instanceId":"580c5c9d-f085-4c63-b85e-57965fd68838","instanceMetadata":{"style":{"width":892,"height":1388},"keyword":[],"position":{"x":385.40506044493077,"y":104.99789384859696},"modelRole":"","modelColors":{}}},{"modelId":"8a54f84f-6095-587b-b7c9-04dfe2e95a60","instanceId":"f8537458-e594-4412-a892-1e439b25d9df","instanceMetadata":{"style":{"width":200,"height":200},"keyword":[],"position":{"x":1407.893513445477,"y":723.2689485994332},"modelRole":"","parameters":[{"name":"last_day","type":"int","value":3}],"modelColors":{}}}]$irp_go_basicexperimentalframe_components$::jsonb, NOW(), NOW(), NULL
FROM users u
WHERE u.username = 'admin'
ON CONFLICT (id) DO NOTHING;

INSERT INTO models (id, user_id, lib_id, name, type, language, description, code, ports, metadata, connections, components, created_at, updated_at, deleted_at)
SELECT '01c4c9e8-1ff6-51eb-9bf6-c9f1a213a178'::uuid, u.id, '2f49a189-7084-5e0d-bdc0-9082a7faac9d'::uuid, $irp_go_basicinventoryrouting_name$BasicInventoryRouting$irp_go_basicinventoryrouting_name$, 'coupled'::model_type, 'go'::model_language, $irp_go_basicinventoryrouting_description$$irp_go_basicinventoryrouting_description$, $irp_go_basicinventoryrouting_code$$irp_go_basicinventoryrouting_code$, $irp_go_basicinventoryrouting_ports$[{"id":"76c48b8a-528c-447a-b84f-b38a9a20e65c","name":"receiveDeliverySchedule","type":"in"},{"id":"50c3b2e4-6d73-4718-b16d-529ec43337dd","name":"reportVehicleCost","type":"out"},{"id":"5735f15b-d01f-4424-899f-61afc0ef868c","name":"reportInventoryCost","type":"out"}]$irp_go_basicinventoryrouting_ports$::jsonb, $irp_go_basicinventoryrouting_metadata${"style":{"width":892,"height":1388},"keyword":[],"position":{"x":12,"y":9.676103500761087},"modelRole":"","modelColors":{}}$irp_go_basicinventoryrouting_metadata$::jsonb, $irp_go_basicinventoryrouting_connections$[{"to":{"port":"acceptDeliverySchedule","instanceId":"77a647c7-28d3-4f21-b7a7-a3a7569e388c"},"from":{"port":"receiveDeliverySchedule","instanceId":"root"}},{"to":{"port":"reportInventoryCost","instanceId":"root"},"from":{"port":"dailyInventoryCost","instanceId":"0c02acf6-866f-42d5-9e4c-4e7386459f37"}},{"to":{"port":"receiveDelivery","instanceId":"0c02acf6-866f-42d5-9e4c-4e7386459f37"},"from":{"port":"dropDelivery","instanceId":"0c8898cd-e6f8-4980-9e8f-0d904f1784e1"}},{"to":{"port":"receiveDelivery","instanceId":"0db1d550-426f-4dc0-8d45-9af7319527f6"},"from":{"port":"dropDelivery","instanceId":"0c8898cd-e6f8-4980-9e8f-0d904f1784e1"}},{"to":{"port":"receiveDelivery","instanceId":"9b9c3b3f-8120-4c50-9d5e-6d37fc3ca94f"},"from":{"port":"dropDelivery","instanceId":"0c8898cd-e6f8-4980-9e8f-0d904f1784e1"}},{"to":{"port":"receiveDelivery","instanceId":"a06b8588-67c6-42d6-9840-7acf7518fe3d"},"from":{"port":"dropDelivery","instanceId":"0c8898cd-e6f8-4980-9e8f-0d904f1784e1"}},{"to":{"port":"receiveDelivery","instanceId":"db617126-d2ff-46c5-af96-f7d196fbaef6"},"from":{"port":"dropDelivery","instanceId":"0c8898cd-e6f8-4980-9e8f-0d904f1784e1"}},{"to":{"port":"reportInventoryCost","instanceId":"root"},"from":{"port":"dailyInventoryCost","instanceId":"0db1d550-426f-4dc0-8d45-9af7319527f6"}},{"to":{"port":"reportVehicleCost","instanceId":"root"},"from":{"port":"dailyDeliveryCost","instanceId":"15402c03-3dfd-47c3-8305-3112de075c76"}},{"to":{"port":"receiveDelivery","instanceId":"0c02acf6-866f-42d5-9e4c-4e7386459f37"},"from":{"port":"dropDelivery","instanceId":"15402c03-3dfd-47c3-8305-3112de075c76"}},{"to":{"port":"receiveDelivery","instanceId":"0db1d550-426f-4dc0-8d45-9af7319527f6"},"from":{"port":"dropDelivery","instanceId":"15402c03-3dfd-47c3-8305-3112de075c76"}},{"to":{"port":"receiveDelivery","instanceId":"9b9c3b3f-8120-4c50-9d5e-6d37fc3ca94f"},"from":{"port":"dropDelivery","instanceId":"15402c03-3dfd-47c3-8305-3112de075c76"}},{"to":{"port":"receiveDelivery","instanceId":"a06b8588-67c6-42d6-9840-7acf7518fe3d"},"from":{"port":"dropDelivery","instanceId":"15402c03-3dfd-47c3-8305-3112de075c76"}},{"to":{"port":"receiveDelivery","instanceId":"db617126-d2ff-46c5-af96-f7d196fbaef6"},"from":{"port":"dropDelivery","instanceId":"15402c03-3dfd-47c3-8305-3112de075c76"}},{"to":{"port":"reportInventoryCost","instanceId":"root"},"from":{"port":"dailyInventoryCost","instanceId":"77a647c7-28d3-4f21-b7a7-a3a7569e388c"}},{"to":{"port":"acceptDeliveryRoute","instanceId":"0c8898cd-e6f8-4980-9e8f-0d904f1784e1"},"from":{"port":"postDeliveryRoute","instanceId":"77a647c7-28d3-4f21-b7a7-a3a7569e388c"}},{"to":{"port":"acceptDeliveryRoute","instanceId":"15402c03-3dfd-47c3-8305-3112de075c76"},"from":{"port":"postDeliveryRoute","instanceId":"77a647c7-28d3-4f21-b7a7-a3a7569e388c"}},{"to":{"port":"reportInventoryCost","instanceId":"root"},"from":{"port":"dailyInventoryCost","instanceId":"9b9c3b3f-8120-4c50-9d5e-6d37fc3ca94f"}},{"to":{"port":"reportInventoryCost","instanceId":"root"},"from":{"port":"dailyInventoryCost","instanceId":"a06b8588-67c6-42d6-9840-7acf7518fe3d"}},{"to":{"port":"reportInventoryCost","instanceId":"root"},"from":{"port":"dailyInventoryCost","instanceId":"db617126-d2ff-46c5-af96-f7d196fbaef6"}}]$irp_go_basicinventoryrouting_connections$::jsonb, $irp_go_basicinventoryrouting_components$[{"modelId":"17aedad2-b788-508e-b7eb-bb53bd329f1a","instanceId":"0c02acf6-866f-42d5-9e4c-4e7386459f37","instanceMetadata":{"style":{"width":200,"height":200},"keyword":[],"position":{"x":616,"y":51},"modelRole":"","parameters":[{"name":"retailer_id","type":"int","value":0},{"name":"starting_inventory","type":"float","value":130},{"name":"min_inventory","type":"float","value":0},{"name":"max_inventory","type":"float","value":195},{"name":"daily_consumption","type":"float","value":65},{"name":"inventory_cost","type":"float","value":0.02},{"name":"closing_hour","type":"int","value":16}],"modelColors":{}}},{"modelId":"49fd520a-86f3-5157-97e3-5a5bc4def5b2","instanceId":"0c8898cd-e6f8-4980-9e8f-0d904f1784e1","instanceMetadata":{"style":{"width":200,"height":200},"keyword":[],"position":{"x":316,"y":716.5},"modelRole":"","parameters":[{"name":"vehicle_id","type":"int","value":1},{"name":"capacity","type":"float","value":144},{"name":"cost_per_km","type":"float","value":1},{"name":"speed_km_hr","type":"float","value":150},{"name":"manufacturer_x","type":"float","value":154},{"name":"manufacturer_y","type":"float","value":417},{"name":"minutes_per_delivery","type":"int","value":15},{"name":"closing_hour","type":"int","value":16}],"modelColors":{}}},{"modelId":"17aedad2-b788-508e-b7eb-bb53bd329f1a","instanceId":"0db1d550-426f-4dc0-8d45-9af7319527f6","instanceMetadata":{"style":{"width":200,"height":200},"keyword":[],"position":{"x":616,"y":351},"modelRole":"","parameters":[{"name":"retailer_id","type":"int","value":1},{"name":"starting_inventory","type":"float","value":70},{"name":"min_inventory","type":"float","value":105},{"name":"max_inventory","type":"float","value":0},{"name":"daily_consumption","type":"float","value":35},{"name":"inventory_cost","type":"float","value":0.03},{"name":"closing_hour","type":"int","value":16}],"modelColors":{}}},{"modelId":"49fd520a-86f3-5157-97e3-5a5bc4def5b2","instanceId":"15402c03-3dfd-47c3-8305-3112de075c76","instanceMetadata":{"style":{"width":200,"height":200},"keyword":[],"position":{"x":311.4241758241758,"y":493.9747252747253},"modelRole":"","parameters":[{"name":"vehicle_id","type":"int","value":0},{"name":"capacity","type":"float","value":144},{"name":"cost_per_km","type":"float","value":1},{"name":"speed_km_hr","type":"float","value":150},{"name":"manufacturer_x","type":"float","value":154},{"name":"manufacturer_y","type":"float","value":417},{"name":"minutes_per_delivery","type":"int","value":15},{"name":"closing_hour","type":"int","value":16}],"modelColors":{}}},{"modelId":"b7f07e1f-0a16-5030-aa68-8372375763a4","instanceId":"77a647c7-28d3-4f21-b7a7-a3a7569e388c","instanceMetadata":{"style":{"width":200,"height":200},"keyword":[],"position":{"x":16,"y":606},"modelRole":"","parameters":[{"name":"manufacturer_id","type":"int","value":0},{"name":"starting_inventory","type":"float","value":510},{"name":"daily_production","type":"float","value":193},{"name":"inventory_cost","type":"float","value":0.03},{"name":"opening_hour","type":"int","value":6},{"name":"manufacturer_report_minute","type":"int","value":1}],"modelColors":{}}},{"modelId":"17aedad2-b788-508e-b7eb-bb53bd329f1a","instanceId":"9b9c3b3f-8120-4c50-9d5e-6d37fc3ca94f","instanceMetadata":{"style":{"width":200,"height":200},"keyword":[],"position":{"x":616,"y":572},"modelRole":"","parameters":[{"name":"retailer_id","type":"int","value":2},{"name":"starting_inventory","type":"float","value":58},{"name":"min_inventory","type":"float","value":0},{"name":"max_inventory","type":"float","value":116},{"name":"daily_consumption","type":"float","value":58},{"name":"inventory_cost","type":"float","value":0.03},{"name":"closing_hour","type":"int","value":16}],"modelColors":{}}},{"modelId":"17aedad2-b788-508e-b7eb-bb53bd329f1a","instanceId":"a06b8588-67c6-42d6-9840-7acf7518fe3d","instanceMetadata":{"style":{"width":200,"height":200},"keyword":[],"position":{"x":616,"y":872},"modelRole":"","parameters":[{"name":"retailer_id","type":"int","value":3},{"name":"starting_inventory","type":"float","value":48},{"name":"min_inventory","type":"float","value":0},{"name":"max_inventory","type":"float","value":72},{"name":"daily_consumption","type":"float","value":24},{"name":"inventory_cost","type":"float","value":0.02},{"name":"closing_hour","type":"int","value":16}],"modelColors":{}}},{"modelId":"17aedad2-b788-508e-b7eb-bb53bd329f1a","instanceId":"db617126-d2ff-46c5-af96-f7d196fbaef6","instanceMetadata":{"style":{"width":200,"height":200},"keyword":[],"position":{"x":616,"y":1172},"modelRole":"","parameters":[{"name":"retailer_id","type":"int","value":4},{"name":"starting_inventory","type":"float","value":11},{"name":"min_inventory","type":"float","value":0},{"name":"max_inventory","type":"float","value":22},{"name":"daily_consumption","type":"float","value":11},{"name":"inventory_cost","type":"float","value":0.02},{"name":"closing_hour","type":"int","value":16}],"modelColors":{}}}]$irp_go_basicinventoryrouting_components$::jsonb, NOW(), NOW(), NULL
FROM users u
WHERE u.username = 'admin'
ON CONFLICT (id) DO NOTHING;

INSERT INTO models (id, user_id, lib_id, name, type, language, description, code, ports, metadata, connections, components, created_at, updated_at, deleted_at)
SELECT 'b7f07e1f-0a16-5030-aa68-8372375763a4'::uuid, u.id, '2f49a189-7084-5e0d-bdc0-9082a7faac9d'::uuid, $irp_go_manufacturer_name$Manufacturer$irp_go_manufacturer_name$, 'atomic'::model_type, 'go'::model_language, $irp_go_manufacturer_description$$irp_go_manufacturer_description$, $irp_go_manufacturer_code$package main

import (
	"math"
	"sort"
	"strconv"

	modeling "devsforge-wrapper/modeling"
)

const minutesPerDay int64 = 24 * 60

type ManufacturerIRP struct {
	modeling.Atomic
	parameters       map[string]interface{}
	currentTime      int64
	currentInventory float64
	dailyProduction  float64
	inventoryCost    float64
	manufacturerID   int
	openingHour      int
	reportMinute     int64
	nextReportAt     int64
	routeEvents      map[int64][]map[string]interface{}
}

func NewModel(cfg modeling.RunnableModel) modeling.Atomic {
	params := make(map[string]interface{}, len(cfg.Parameters))
	for _, p := range cfg.Parameters {
		params[p.Name] = p.Value
	}

	m := &ManufacturerIRP{
		Atomic:      modeling.NewAtomic(cfg),
		parameters:  params,
		routeEvents: map[int64][]map[string]interface{}{},
	}
	return m
}

func (m *ManufacturerIRP) Initialize() {
	m.currentTime = 0
	m.currentInventory = asFloat(m.parameters["starting_inventory"], 0)
	m.dailyProduction = asFloat(m.parameters["daily_production"], 0)
	m.inventoryCost = asFloat(m.parameters["inventory_cost"], 0)
	m.manufacturerID = asInt(m.parameters["manufacturer_id"], 0)
	m.openingHour = asInt(m.parameters["opening_hour"], 6)
	report := asInt(m.parameters["manufacturer_report_minute"], 1439)
	if report < 0 {
		report = 1439
	}
	m.reportMinute = int64(report)
	m.nextReportAt = m.reportMinute
	m.routeEvents = map[int64][]map[string]interface{}{}
}

func (m *ManufacturerIRP) Exit() {}

func (m *ManufacturerIRP) TA() float64 {
	nextTime, ok := m.nextInternalTime()
	if !ok {
		return modeling.INFINITY
	}
	delta := float64(nextTime - m.currentTime)
	if delta < 0 {
		return 0
	}
	return delta
}

func (m *ManufacturerIRP) DeltInt() {
	nextTime, ok := m.nextInternalTime()
	if !ok {
		return
	}
	m.currentTime = nextTime

	if m.nextReportAt == nextTime {
		m.currentInventory += m.dailyProduction
		m.nextReportAt += minutesPerDay
	}

	if routes, exists := m.routeEvents[nextTime]; exists {
		for _, route := range routes {
			m.currentInventory -= routeLoad(route)
		}
		delete(m.routeEvents, nextTime)
	}
}

func (m *ManufacturerIRP) DeltExt(e float64) {
	m.currentTime += int64(math.Round(e))

	if port, err := m.GetPortByName("acceptDeliverySchedule"); err == nil {
		if values, ok := port.GetValues().([]interface{}); ok {
			for _, value := range values {
				m.handleAcceptDeliverySchedule(value)
			}
		}
		port.Clear()
	}

	if port, err := m.GetPortByName("acceptDelivery"); err == nil {
		if values, ok := port.GetValues().([]interface{}); ok {
			for _, value := range values {
				m.handleAcceptDelivery(value)
			}
		}
		port.Clear()
	}
}

func (m *ManufacturerIRP) DeltCon(e float64) {
	m.DeltInt()
	m.DeltExt(0)
}

func (m *ManufacturerIRP) Lambda() {
	nextTime, ok := m.nextInternalTime()
	if !ok {
		return
	}

	if m.nextReportAt == nextTime {
		predictedInventory := m.currentInventory + m.dailyProduction
		payload := map[string]interface{}{
			"day":        dayFromMinute(nextTime),
			"retailerId": m.manufacturerID,
			"cost":       predictedInventory * m.inventoryCost,
		}
		m.emit("dailyInventoryCost", payload)
	}

	if routes, exists := m.routeEvents[nextTime]; exists {
		for _, route := range routes {
			m.emit("postDeliveryRoute", route)
		}
	}
}

func (m *ManufacturerIRP) handleAcceptDeliverySchedule(raw interface{}) {
	root, ok := asMap(raw)
	if !ok {
		return
	}
	byDay, ok := asMap(root["deliveriesByDayByVehicle"])
	if !ok {
		return
	}

	for dayKey, dayValue := range byDay {
		dayIndex, err := strconv.Atoi(dayKey)
		if err != nil {
			continue
		}
		if dayIndex < 1 {
			continue
		}

		dayRoutes, ok := asMap(dayValue)
		if !ok {
			continue
		}

		loadTime := int64(dayIndex-1)*minutesPerDay + int64(m.openingHour)*60
		for _, routeValue := range dayRoutes {
			routeMap, ok := asMap(routeValue)
			if !ok {
				continue
			}
			m.routeEvents[loadTime] = append(m.routeEvents[loadTime], routeMap)
		}
	}
}

func (m *ManufacturerIRP) handleAcceptDelivery(raw interface{}) {
	delivery, ok := asMap(raw)
	if !ok {
		return
	}
	m.currentInventory += asFloat(delivery["productAmount"], 0)
}

func (m *ManufacturerIRP) nextRouteTime() (int64, bool) {
	if len(m.routeEvents) == 0 {
		return 0, false
	}
	keys := make([]int64, 0, len(m.routeEvents))
	for k := range m.routeEvents {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool { return keys[i] < keys[j] })
	return keys[0], true
}

func (m *ManufacturerIRP) nextInternalTime() (int64, bool) {
	next := m.nextReportAt
	routeTime, hasRoute := m.nextRouteTime()
	if hasRoute && routeTime < next {
		next = routeTime
	}
	if next < m.currentTime {
		next = m.currentTime
	}
	return next, true
}

func (m *ManufacturerIRP) emit(portName string, value interface{}) {
	port, err := m.GetPortByName(portName)
	if err != nil {
		return
	}
	port.AddValue(value)
}

func dayFromMinute(minute int64) int {
	if minute < 0 {
		return 1
	}
	return int(minute/minutesPerDay) + 1
}

func routeLoad(route map[string]interface{}) float64 {
	deliveries, ok := asSlice(route["deliveries"])
	if !ok {
		return 0
	}
	total := 0.0
	for _, item := range deliveries {
		delivery, ok := asMap(item)
		if !ok {
			continue
		}
		total += asFloat(delivery["productAmount"], 0)
	}
	return total
}

func asMap(value interface{}) (map[string]interface{}, bool) {
	m, ok := value.(map[string]interface{})
	return m, ok
}

func asSlice(value interface{}) ([]interface{}, bool) {
	s, ok := value.([]interface{})
	return s, ok
}

func asFloat(value interface{}, fallback float64) float64 {
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

func asInt(value interface{}, fallback int) int {
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
$irp_go_manufacturer_code$, $irp_go_manufacturer_ports$[{"id":"b7f8fef5-5622-42c8-a545-d4ce4da98613","name":"acceptDeliverySchedule","type":"in"},{"id":"06fa00ec-8022-48a8-89f8-772d361866fc","name":"acceptDelivery","type":"in"},{"id":"f0e5511d-7532-4d2f-9d2e-87ebb7b3adcb","name":"postDeliveryRoute","type":"out"},{"id":"fb4844a9-32ac-4167-ae00-9dfad0becf57","name":"dailyInventoryCost","type":"out"}]$irp_go_manufacturer_ports$::jsonb, $irp_go_manufacturer_metadata${"style":{"width":200,"height":200},"keyword":[],"position":{"x":0,"y":0},"modelRole":"","parameters":[{"name":"manufacturer_id","type":"int","value":0},{"name":"starting_inventory","type":"float","value":0},{"name":"daily_production","type":"float","value":0},{"name":"inventory_cost","type":"float","value":0},{"name":"opening_hour","type":"int","value":0},{"name":"manufacturer_report_minute","type":"int","value":0}],"modelColors":{}}$irp_go_manufacturer_metadata$::jsonb, $irp_go_manufacturer_connections$[]$irp_go_manufacturer_connections$::jsonb, $irp_go_manufacturer_components$[]$irp_go_manufacturer_components$::jsonb, NOW(), NOW(), NULL
FROM users u
WHERE u.username = 'admin'
ON CONFLICT (id) DO NOTHING;

INSERT INTO models (id, user_id, lib_id, name, type, language, description, code, ports, metadata, connections, components, created_at, updated_at, deleted_at)
SELECT '17aedad2-b788-508e-b7eb-bb53bd329f1a'::uuid, u.id, '2f49a189-7084-5e0d-bdc0-9082a7faac9d'::uuid, $irp_go_retailer_name$Retailer$irp_go_retailer_name$, 'atomic'::model_type, 'go'::model_language, $irp_go_retailer_description$$irp_go_retailer_description$, $irp_go_retailer_code$package main

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
$irp_go_retailer_code$, $irp_go_retailer_ports$[{"id":"c4949da2-30c4-4f6f-9abc-baf508af6e7a","name":"receiveDelivery","type":"in"},{"id":"e8b5a6c0-76bc-4c36-beab-4827251d3d73","name":"dailyInventoryCost","type":"out"}]$irp_go_retailer_ports$::jsonb, $irp_go_retailer_metadata${"style":{"width":200,"height":200},"keyword":[],"position":{"x":0,"y":0},"modelRole":"","parameters":[{"name":"retailer_id","type":"int","value":0},{"name":"starting_inventory","type":"float","value":0},{"name":"min_inventory","type":"float","value":0},{"name":"max_inventory","type":"float","value":0},{"name":"daily_consumption","type":"float","value":0},{"name":"inventory_cost","type":"float","value":0},{"name":"closing_hour","type":"int","value":0}],"modelColors":{}}$irp_go_retailer_metadata$::jsonb, $irp_go_retailer_connections$[]$irp_go_retailer_connections$::jsonb, $irp_go_retailer_components$[]$irp_go_retailer_components$::jsonb, NOW(), NOW(), NULL
FROM users u
WHERE u.username = 'admin'
ON CONFLICT (id) DO NOTHING;

INSERT INTO models (id, user_id, lib_id, name, type, language, description, code, ports, metadata, connections, components, created_at, updated_at, deleted_at)
SELECT '8a54f84f-6095-587b-b7c9-04dfe2e95a60'::uuid, u.id, '2f49a189-7084-5e0d-bdc0-9082a7faac9d'::uuid, $irp_go_transducer_name$Transducer$irp_go_transducer_name$, 'atomic'::model_type, 'go'::model_language, $irp_go_transducer_description$$irp_go_transducer_description$, $irp_go_transducer_code$package main

import (
	"fmt"
	"math"
	"sort"
	"strconv"

	modeling "devsforge-wrapper/modeling"
)

const minutesPerDay int64 = 24 * 60

type TransducerIRP struct {
	modeling.Atomic
	parameters                 map[string]interface{}
	currentTime                int64
	finalTime                  int64
	finalComputed              bool
	vehicleCostByDayByVehicle  map[int]map[int]float64
	inventoryCostByDayRetailer map[int]map[int]float64
}

func NewModel(cfg modeling.RunnableModel) modeling.Atomic {
	params := make(map[string]interface{}, len(cfg.Parameters))
	for _, p := range cfg.Parameters {
		params[p.Name] = p.Value
	}
	return &TransducerIRP{
		Atomic:     modeling.NewAtomic(cfg),
		parameters: params,
	}
}

func (m *TransducerIRP) Initialize() {
	m.currentTime = 0
	lastDay := asIntTransducer(m.parameters["last_day"], 1)
	if lastDay < 0 {
		lastDay = 0
	}
	m.finalTime = int64(lastDay) * minutesPerDay
	m.finalComputed = false
	m.vehicleCostByDayByVehicle = map[int]map[int]float64{}
	m.inventoryCostByDayRetailer = map[int]map[int]float64{}
}

func (m *TransducerIRP) Exit() {}

func (m *TransducerIRP) TA() float64 {
	if m.finalComputed {
		return modeling.INFINITY
	}
	delta := float64(m.finalTime - m.currentTime)
	if delta < 0 {
		return 0
	}
	return delta
}

func (m *TransducerIRP) DeltInt() {
	m.currentTime = m.finalTime
	if m.finalComputed {
		return
	}

	days := make(map[int]struct{})
	for day := range m.vehicleCostByDayByVehicle {
		days[day] = struct{}{}
	}
	for day := range m.inventoryCostByDayRetailer {
		days[day] = struct{}{}
	}

	sortedDays := make([]int, 0, len(days))
	for day := range days {
		sortedDays = append(sortedDays, day)
	}
	sort.Ints(sortedDays)

	totalVehicleCost := 0.0
	totalInventoryCost := 0.0

	for _, day := range sortedDays {
		fmt.Printf("Day %d costs:\n", day)

		if costByVehicle, ok := m.vehicleCostByDayByVehicle[day]; ok {
			vehicleIDs := sortedIntKeys(costByVehicle)
			for _, vehicleID := range vehicleIDs {
				cost := costByVehicle[vehicleID]
				fmt.Printf("Vehicle %d: %f\n", vehicleID, cost)
				totalVehicleCost += cost
			}
		}

		if costByRetailer, ok := m.inventoryCostByDayRetailer[day]; ok {
			retailerIDs := sortedIntKeys(costByRetailer)
			for _, retailerID := range retailerIDs {
				cost := costByRetailer[retailerID]
				fmt.Printf("Retailer %d: %f\n", retailerID, cost)
				totalInventoryCost += cost
			}
		}
	}

	fmt.Printf(
		"Vehicle costs %f + retailer costs %f = %f total\n",
		totalVehicleCost,
		totalInventoryCost,
		totalVehicleCost+totalInventoryCost,
	)

	m.finalComputed = true
}

func (m *TransducerIRP) DeltExt(e float64) {
	m.currentTime += int64(math.Round(e))

	m.consumeCostPort("aggregateInventoryCost", func(payload map[string]interface{}) {
		day := dayFromMinute(m.currentTime)
		retailerID := asIntTransducer(payload["retailerId"], 0)
		cost := asFloatTransducer(payload["cost"], 0)
		if _, ok := m.inventoryCostByDayRetailer[day]; !ok {
			m.inventoryCostByDayRetailer[day] = map[int]float64{}
		}
		m.inventoryCostByDayRetailer[day][retailerID] = cost
	})

	m.consumeCostPort("aggregateVehicleCost", func(payload map[string]interface{}) {
		day := dayFromMinute(m.currentTime)
		vehicleID := asIntTransducer(payload["vehicleId"], 0)
		cost := asFloatTransducer(payload["cost"], 0)
		if _, ok := m.vehicleCostByDayByVehicle[day]; !ok {
			m.vehicleCostByDayByVehicle[day] = map[int]float64{}
		}
		m.vehicleCostByDayByVehicle[day][vehicleID] = cost
	})
}

func (m *TransducerIRP) DeltCon(e float64) {
	m.DeltInt()
	m.DeltExt(0)
}

func (m *TransducerIRP) Lambda() {}

func (m *TransducerIRP) consumeCostPort(portName string, apply func(map[string]interface{})) {
	port, err := m.GetPortByName(portName)
	if err != nil {
		return
	}
	if values, ok := port.GetValues().([]interface{}); ok {
		for _, value := range values {
			payload, ok := asMapTransducer(value)
			if !ok {
				continue
			}
			apply(payload)
		}
	}
	port.Clear()
}

func sortedIntKeys(values map[int]float64) []int {
	keys := make([]int, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Ints(keys)
	return keys
}

func dayFromMinute(minute int64) int {
	if minute < 0 {
		return 1
	}
	return int(minute/minutesPerDay) + 1
}

func asMapTransducer(value interface{}) (map[string]interface{}, bool) {
	m, ok := value.(map[string]interface{})
	return m, ok
}

func asIntTransducer(value interface{}, fallback int) int {
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

func asFloatTransducer(value interface{}, fallback float64) float64 {
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
$irp_go_transducer_code$, $irp_go_transducer_ports$[{"id":"3b7131e4-c559-45ac-a47c-853b2fa9deeb","name":"aggregateInventoryCost","type":"in"},{"id":"6804cb3e-9bea-441e-b7dd-0523bdb7ae0d","name":"aggregateVehicleCost","type":"in"}]$irp_go_transducer_ports$::jsonb, $irp_go_transducer_metadata${"style":{"width":200,"height":200},"keyword":[],"position":{"x":0,"y":0},"modelRole":"","parameters":[{"name":"last_day","type":"int","value":0}],"modelColors":{}}$irp_go_transducer_metadata$::jsonb, $irp_go_transducer_connections$[]$irp_go_transducer_connections$::jsonb, $irp_go_transducer_components$[]$irp_go_transducer_components$::jsonb, NOW(), NOW(), NULL
FROM users u
WHERE u.username = 'admin'
ON CONFLICT (id) DO NOTHING;

INSERT INTO models (id, user_id, lib_id, name, type, language, description, code, ports, metadata, connections, components, created_at, updated_at, deleted_at)
SELECT '49fd520a-86f3-5157-97e3-5a5bc4def5b2'::uuid, u.id, '2f49a189-7084-5e0d-bdc0-9082a7faac9d'::uuid, $irp_go_vehicle_name$Vehicle$irp_go_vehicle_name$, 'atomic'::model_type, 'go'::model_language, $irp_go_vehicle_description$$irp_go_vehicle_description$, $irp_go_vehicle_code$package main

import (
	"math"
	"strconv"

	modeling "devsforge-wrapper/modeling"
)

type irpCoordinate struct {
	X float64
	Y float64
}

type vehicleEventKind string

const (
	vehicleEventDelivery vehicleEventKind = "delivery"
	vehicleEventReturn   vehicleEventKind = "return"
)

const minutesPerDay int64 = 24 * 60

type vehicleEvent struct {
	Time     int64
	Kind     vehicleEventKind
	Delivery map[string]interface{}
}

type VehicleIRP struct {
	modeling.Atomic
	parameters         map[string]interface{}
	currentTime        int64
	vehicleID          int
	capacity           float64
	costPerKm          float64
	speedKmHr          float64
	manufacturer       irpCoordinate
	location           irpCoordinate
	dailyKmTraveled    float64
	minutesPerDelivery int64
	closingHour        int
	route              []map[string]interface{}
	nextEvent          *vehicleEvent
	pendingImmediate   []map[string]interface{}
}

func NewModel(cfg modeling.RunnableModel) modeling.Atomic {
	params := make(map[string]interface{}, len(cfg.Parameters))
	for _, p := range cfg.Parameters {
		params[p.Name] = p.Value
	}
	return &VehicleIRP{
		Atomic:     modeling.NewAtomic(cfg),
		parameters: params,
	}
}

func (m *VehicleIRP) Initialize() {
	m.currentTime = 0
	m.vehicleID = asIntVehicle(m.parameters["vehicle_id"], 0)
	m.capacity = asFloatVehicle(m.parameters["capacity"], 0)
	m.costPerKm = asFloatVehicle(m.parameters["cost_per_km"], 0)
	m.speedKmHr = asFloatVehicle(m.parameters["speed_km_hr"], 1)
	m.manufacturer = irpCoordinate{
		X: asFloatVehicle(m.parameters["manufacturer_x"], 0),
		Y: asFloatVehicle(m.parameters["manufacturer_y"], 0),
	}
	m.location = m.manufacturer
	m.dailyKmTraveled = 0
	m.minutesPerDelivery = int64(asIntVehicle(m.parameters["minutes_per_delivery"], 15))
	m.closingHour = asIntVehicle(m.parameters["closing_hour"], 16)
	m.route = nil
	m.nextEvent = nil
	m.pendingImmediate = nil
}

func (m *VehicleIRP) Exit() {}

func (m *VehicleIRP) TA() float64 {
	if len(m.pendingImmediate) > 0 {
		return 0
	}
	if m.nextEvent == nil {
		return modeling.INFINITY
	}
	delta := float64(m.nextEvent.Time - m.currentTime)
	if delta < 0 {
		return 0
	}
	return delta
}

func (m *VehicleIRP) DeltInt() {
	if len(m.pendingImmediate) > 0 {
		m.pendingImmediate = nil
		return
	}
	if m.nextEvent == nil {
		return
	}

	event := m.nextEvent
	m.currentTime = event.Time

	switch event.Kind {
	case vehicleEventDelivery:
		deliveryLocation := readDeliveryLocation(event.Delivery)
		distance := distanceBetween(m.location, deliveryLocation)
		m.dailyKmTraveled += distance
		m.location = deliveryLocation
		m.scheduleNextDelivery()
	case vehicleEventReturn:
		distance := distanceBetween(m.location, m.manufacturer)
		m.dailyKmTraveled += distance
		m.location = m.manufacturer
		m.dailyKmTraveled = 0
		m.nextEvent = nil
	}
}

func (m *VehicleIRP) DeltExt(e float64) {
	m.currentTime += int64(math.Round(e))

	port, err := m.GetPortByName("acceptDeliveryRoute")
	if err != nil {
		return
	}
	if values, ok := port.GetValues().([]interface{}); ok {
		for _, value := range values {
			m.handleAcceptDeliveryRoute(value)
		}
	}
	port.Clear()
}

func (m *VehicleIRP) DeltCon(e float64) {
	m.DeltInt()
	m.DeltExt(0)
}

func (m *VehicleIRP) Lambda() {
	if len(m.pendingImmediate) > 0 {
		for _, payload := range m.pendingImmediate {
			m.emit("dropDelivery", payload)
		}
		return
	}

	if m.nextEvent == nil {
		return
	}

	switch m.nextEvent.Kind {
	case vehicleEventDelivery:
		m.emit("dropDelivery", m.nextEvent.Delivery)
	case vehicleEventReturn:
		distance := distanceBetween(m.location, m.manufacturer)
		cost := (m.dailyKmTraveled + distance) * m.costPerKm
		payload := map[string]interface{}{
			"vehicleId": m.vehicleID,
			"day":       dayFromMinute(m.nextEvent.Time),
			"cost":      cost,
		}
		m.emit("dailyDeliveryCost", payload)
	}
}

func (m *VehicleIRP) handleAcceptDeliveryRoute(raw interface{}) {
	routeMap, ok := asMapVehicle(raw)
	if !ok {
		return
	}

	incomingVehicleID := asIntVehicle(routeMap["vehicleId"], m.vehicleID)
	if incomingVehicleID != m.vehicleID {
		return
	}

	deliveriesRaw, ok := asSliceVehicle(routeMap["deliveries"])
	if !ok {
		deliveriesRaw = []interface{}{}
	}

	deliveries := make([]map[string]interface{}, 0, len(deliveriesRaw))
	totalQuantity := 0.0
	for _, item := range deliveriesRaw {
		delivery, ok := asMapVehicle(item)
		if !ok {
			continue
		}
		deliveries = append(deliveries, delivery)
		totalQuantity += asFloatVehicle(delivery["productAmount"], 0)
	}

	if totalQuantity > m.capacity {
		excess := totalQuantity - m.capacity
		returnDelivery := map[string]interface{}{
			"retailerId": 0,
			"retailerLocation": map[string]interface{}{
				"x": m.manufacturer.X,
				"y": m.manufacturer.Y,
			},
			"productAmount": excess,
		}
		m.pendingImmediate = append(m.pendingImmediate, returnDelivery)
		m.dailyKmTraveled = 0
	}

	m.route = deliveries
	m.scheduleNextDelivery()
}

func (m *VehicleIRP) scheduleNextDelivery() {
	if len(m.route) == 0 {
		m.scheduleReturnToManufacturer(m.currentTime)
		return
	}

	next := m.route[0]
	m.route = m.route[1:]

	destination := readDeliveryLocation(next)
	distance := distanceBetween(m.location, destination)
	arrival := m.currentTime + m.minutesPerDelivery + int64(distance/(safeSpeed(m.speedKmHr)/60.0))
	if hourPart(arrival) < m.closingHour {
		m.nextEvent = &vehicleEvent{
			Time:     arrival,
			Kind:     vehicleEventDelivery,
			Delivery: next,
		}
		return
	}

	m.scheduleReturnToManufacturer(m.currentTime)
}

func (m *VehicleIRP) scheduleReturnToManufacturer(baseTime int64) {
	distance := distanceBetween(m.location, m.manufacturer)
	arrival := baseTime + m.minutesPerDelivery + int64(distance/(safeSpeed(m.speedKmHr)/60.0))
	m.nextEvent = &vehicleEvent{Time: arrival, Kind: vehicleEventReturn}
}

func (m *VehicleIRP) emit(portName string, value interface{}) {
	port, err := m.GetPortByName(portName)
	if err != nil {
		return
	}
	port.AddValue(value)
}

func readDeliveryLocation(delivery map[string]interface{}) irpCoordinate {
	locMap, ok := asMapVehicle(delivery["retailerLocation"])
	if !ok {
		return irpCoordinate{}
	}
	return irpCoordinate{
		X: asFloatVehicle(locMap["x"], 0),
		Y: asFloatVehicle(locMap["y"], 0),
	}
}

func distanceBetween(c1 irpCoordinate, c2 irpCoordinate) float64 {
	dx := c1.X - c2.X
	dy := c1.Y - c2.Y
	return math.Sqrt(dx*dx + dy*dy)
}

func safeSpeed(speed float64) float64 {
	if speed <= 0 {
		return 1
	}
	return speed
}

func hourPart(minute int64) int {
	if minute < 0 {
		return 0
	}
	return int((minute / 60) % 24)
}

func dayFromMinute(minute int64) int {
	if minute < 0 {
		return 1
	}
	return int(minute/minutesPerDay) + 1
}

func asMapVehicle(value interface{}) (map[string]interface{}, bool) {
	m, ok := value.(map[string]interface{})
	return m, ok
}

func asSliceVehicle(value interface{}) ([]interface{}, bool) {
	s, ok := value.([]interface{})
	return s, ok
}

func asIntVehicle(value interface{}, fallback int) int {
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

func asFloatVehicle(value interface{}, fallback float64) float64 {
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
$irp_go_vehicle_code$, $irp_go_vehicle_ports$[{"id":"8adf1813-a157-4d84-a4ab-ee26f1a5f955","name":"acceptDeliveryRoute","type":"in"},{"id":"6d20f2cd-0c2a-49c5-96b9-328d76c931c1","name":"dropDelivery","type":"out"},{"id":"e9e0d037-9512-4f66-ae1c-80275ae01673","name":"dailyDeliveryCost","type":"out"}]$irp_go_vehicle_ports$::jsonb, $irp_go_vehicle_metadata${"style":{"width":200,"height":200},"keyword":[],"position":{"x":0,"y":0},"modelRole":"","parameters":[{"name":"vehicle_id","type":"int","value":0},{"name":"capacity","type":"float","value":0},{"name":"cost_per_km","type":"float","value":0},{"name":"speed_km_hr","type":"float","value":0},{"name":"manufacturer_x","type":"float","value":0},{"name":"manufacturer_y","type":"float","value":0},{"name":"minutes_per_delivery","type":"int","value":0},{"name":"closing_hour","type":"int","value":0}],"modelColors":{}}$irp_go_vehicle_metadata$::jsonb, $irp_go_vehicle_connections$[]$irp_go_vehicle_connections$::jsonb, $irp_go_vehicle_components$[]$irp_go_vehicle_components$::jsonb, NOW(), NOW(), NULL
FROM users u
WHERE u.username = 'admin'
ON CONFLICT (id) DO NOTHING;

INSERT INTO libraries (id, user_id, title, description, created_at, updated_at, deleted_at)
SELECT 'f53eab46-2ee5-5dbf-8e1a-301dd06af6c1'::uuid, u.id, 'IRP-Java', 'Inventory Routing Problem seed models in Java.', NOW(), NOW(), NULL
FROM users u
WHERE u.username = 'admin'
ON CONFLICT (id) DO NOTHING;

INSERT INTO models (id, user_id, lib_id, name, type, language, description, code, ports, metadata, connections, components, created_at, updated_at, deleted_at)
SELECT 'caf4b1c4-a5bc-5e17-bdfe-769bf5f3a6a3'::uuid, u.id, 'f53eab46-2ee5-5dbf-8e1a-301dd06af6c1'::uuid, $irp_java_deliveryschedulegenerator_name$DeliveryScheduleGenerator$irp_java_deliveryschedulegenerator_name$, 'atomic'::model_type, 'java'::model_language, $irp_java_deliveryschedulegenerator_description$$irp_java_deliveryschedulegenerator_description$, $irp_java_deliveryschedulegenerator_code$package com.devsforge.runner;

import com.devsforge.runner.modeling.Atomic;
import com.devsforge.runner.modeling.Port;
import com.devsforge.runner.modeling.RunnableModel;
import com.devsforge.runner.modeling.RunnableModelParameter;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class DeliveryScheduleGenerator extends Atomic {
    private final Map<String, Object> parameters = new HashMap<>();
    private long currentTime = 0L;
    private boolean posted = false;
    private Map<String, Object> scheduleData = new LinkedHashMap<>();

    public DeliveryScheduleGenerator(RunnableModel cfg) {
        super(cfg);
        if (cfg.getParameters() != null) {
            for (RunnableModelParameter parameter : cfg.getParameters()) {
                parameters.put(parameter.getName(), parameter.getValue());
            }
        }
    }

    @Override
    public void initialize() {
        currentTime = 0L;
        posted = false;

        Map<String, Object> customSchedule = asMap(parameters.get("delivery_schedule"));
        if (!customSchedule.isEmpty()) {
            scheduleData = customSchedule;
            return;
        }

        scheduleData = buildScheduleFromParameters();
    }

    @Override
    public void exit() {
        // no-op
    }

    @Override
    public double ta() {
        if (posted) {
            return Double.MAX_VALUE;
        }
        return 0.0;
    }

    @Override
    public void deltInt() {
        posted = true;
    }

    @Override
    public void deltExt(double e) {
        currentTime += Math.round(e);
    }

    @Override
    public void deltCon(double e) {
        deltInt();
        deltExt(0.0);
    }

    @Override
    public void lambda() {
        if (posted) {
            return;
        }

        try {
            Port outPort = getPortByName("postDeliverySchedule");
            outPort.addValue(scheduleData);
        } catch (Exception ignored) {
            // missing port
        }
    }

    private Map<String, Object> buildScheduleFromParameters() {
        int numTimePeriods = asInt(parameters.get("num_time_periods"), 1);
        int numVehicles = asInt(parameters.get("num_vehicles"), 1);
        double vehicleCapacity = asDouble(parameters.get("vehicle_capacity"), 100.0);

        List<Map<String, Object>> retailers = new ArrayList<>();
        Object retailersRaw = parameters.get("retailers");
        if (retailersRaw instanceof List<?>) {
            List<?> list = (List<?>) retailersRaw;
            for (Object item : list) {
                Map<String, Object> retailer = asMap(item);
                if (!retailer.isEmpty()) {
                    retailers.add(retailer);
                }
            }
        }

        Map<String, Object> deliveriesByDayByVehicle = new LinkedHashMap<>();

        for (int day = 1; day <= numTimePeriods; day++) {
            int retailerIndex = 0;
            Map<String, Object> dailyDeliveries = new LinkedHashMap<>();

            for (int vehicleId = 0; vehicleId < numVehicles; vehicleId++) {
                Map<String, Object> deliveryRoute = new LinkedHashMap<>();
                deliveryRoute.put("vehicleId", vehicleId);
                deliveryRoute.put("deliveries", new ArrayList<>());

                if (retailerIndex >= retailers.size()) {
                    continue;
                }

                Map<String, Object> retailerData = retailers.get(retailerIndex);
                double loadedQuantity = asDouble(retailerData.get("daily_consumption"), 0.0);
                double vehicleLoad = 0.0;

                while (vehicleLoad + loadedQuantity < vehicleCapacity && retailerIndex < retailers.size()) {
                    vehicleLoad += loadedQuantity;

                    int retailerId = asInt(retailerData.get("id"), retailerIndex);
                    Map<String, Object> delivery = new LinkedHashMap<>();
                    delivery.put("retailerId", retailerId);

                    Map<String, Object> location = new LinkedHashMap<>();
                    location.put("x", asDouble(retailerData.get("x"), 0.0));
                    location.put("y", asDouble(retailerData.get("y"), 0.0));
                    delivery.put("retailerLocation", location);
                    delivery.put("productAmount", loadedQuantity);

                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> deliveries = (List<Map<String, Object>>) deliveryRoute.get("deliveries");
                    deliveries.add(delivery);

                    retailerIndex++;
                    if (retailerIndex - 1 < retailers.size()) {
                        retailerData = retailers.get(retailerIndex - 1);
                        loadedQuantity = asDouble(retailerData.get("daily_consumption"), 0.0);
                    }
                }

                @SuppressWarnings("unchecked")
                List<Map<String, Object>> deliveries = (List<Map<String, Object>>) deliveryRoute.get("deliveries");
                if (!deliveries.isEmpty()) {
                    dailyDeliveries.put(String.valueOf(vehicleId), deliveryRoute);
                }
            }

            deliveriesByDayByVehicle.put(String.valueOf(day), dailyDeliveries);
        }

        Map<String, Object> schedule = new LinkedHashMap<>();
        schedule.put("deliveriesByDayByVehicle", deliveriesByDayByVehicle);
        return schedule;
    }

    private static Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?>) {
            Map<?, ?> map = (Map<?, ?>) value;
            Map<String, Object> result = new HashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                result.put(String.valueOf(entry.getKey()), entry.getValue());
            }
            return result;
        }
        return new HashMap<>();
    }

    private static int asInt(Object value, int fallback) {
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        if (value instanceof String) {
            try {
                return Integer.parseInt((String) value);
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }

    private static double asDouble(Object value, double fallback) {
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        if (value instanceof String) {
            try {
                return Double.parseDouble((String) value);
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }
}
$irp_java_deliveryschedulegenerator_code$, $irp_java_deliveryschedulegenerator_ports$[{"id":"99618c33-1876-4d2b-8a7e-cbc2b6699ba2","name":"postDeliverySchedule","type":"out"}]$irp_java_deliveryschedulegenerator_ports$::jsonb, $irp_java_deliveryschedulegenerator_metadata${"style":{"width":200,"height":200},"keyword":[],"position":{"x":0,"y":0},"modelRole":"","parameters":[{"name":"num_time_periods","type":"int","value":0},{"name":"num_vehicles","type":"int","value":0},{"name":"vehicle_capacity","type":"float","value":0},{"name":"retailers","type":"object","value":[]}],"modelColors":{}}$irp_java_deliveryschedulegenerator_metadata$::jsonb, $irp_java_deliveryschedulegenerator_connections$[]$irp_java_deliveryschedulegenerator_connections$::jsonb, $irp_java_deliveryschedulegenerator_components$[]$irp_java_deliveryschedulegenerator_components$::jsonb, NOW(), NOW(), NULL
FROM users u
WHERE u.username = 'admin'
ON CONFLICT (id) DO NOTHING;

INSERT INTO models (id, user_id, lib_id, name, type, language, description, code, ports, metadata, connections, components, created_at, updated_at, deleted_at)
SELECT '764fd6f2-8965-5dc9-9a68-21246829d746'::uuid, u.id, 'f53eab46-2ee5-5dbf-8e1a-301dd06af6c1'::uuid, $irp_java_basicexperimentalframe_name$BasicExperimentalFrame$irp_java_basicexperimentalframe_name$, 'coupled'::model_type, 'java'::model_language, $irp_java_basicexperimentalframe_description$$irp_java_basicexperimentalframe_description$, $irp_java_basicexperimentalframe_code$$irp_java_basicexperimentalframe_code$, $irp_java_basicexperimentalframe_ports$[]$irp_java_basicexperimentalframe_ports$::jsonb, $irp_java_basicexperimentalframe_metadata${"style":{"width":1681,"height":1718},"keyword":[],"position":{"x":-1653.2022877125557,"y":-670.2027664974363},"modelRole":"","modelColors":{}}$irp_java_basicexperimentalframe_metadata$::jsonb, $irp_java_basicexperimentalframe_connections$[{"to":{"port":"receiveDeliverySchedule","instanceId":"580c5c9d-f085-4c63-b85e-57965fd68838"},"from":{"port":"postDeliverySchedule","instanceId":"1b169311-a8d2-4af2-80f6-492f000a901c"}},{"to":{"port":"aggregateInventoryCost","instanceId":"f8537458-e594-4412-a892-1e439b25d9df"},"from":{"port":"reportInventoryCost","instanceId":"580c5c9d-f085-4c63-b85e-57965fd68838"}},{"to":{"port":"aggregateVehicleCost","instanceId":"f8537458-e594-4412-a892-1e439b25d9df"},"from":{"port":"reportVehicleCost","instanceId":"580c5c9d-f085-4c63-b85e-57965fd68838"}}]$irp_java_basicexperimentalframe_connections$::jsonb, $irp_java_basicexperimentalframe_components$[{"modelId":"caf4b1c4-a5bc-5e17-bdfe-769bf5f3a6a3","instanceId":"1b169311-a8d2-4af2-80f6-492f000a901c","instanceMetadata":{"style":{"width":200,"height":200},"keyword":[],"position":{"x":63.48721200787509,"y":744.3605266425859},"modelRole":"","parameters":[{"name":"num_time_periods","type":"int","value":3},{"name":"num_vehicles","type":"int","value":2},{"name":"vehicle_capacity","type":"float","value":144},{"name":"retailers","type":"object","value":[{"daily_consumption":65,"id":0,"x":172,"y":334},{"daily_consumption":35,"id":1,"x":267,"y":87},{"daily_consumption":58,"id":2,"x":148,"y":433},{"daily_consumption":24,"id":3,"x":355,"y":444},{"daily_consumption":11,"id":4,"x":38,"y":152}]}],"modelColors":{}}},{"modelId":"b640fe1d-2cc7-562e-8f5b-e18edb5092e0","instanceId":"580c5c9d-f085-4c63-b85e-57965fd68838","instanceMetadata":{"style":{"width":892,"height":1388},"keyword":[],"position":{"x":385.40506044493077,"y":104.99789384859696},"modelRole":"","modelColors":{}}},{"modelId":"d4105b49-927b-56f0-a0b8-d05d448a9275","instanceId":"f8537458-e594-4412-a892-1e439b25d9df","instanceMetadata":{"style":{"width":200,"height":200},"keyword":[],"position":{"x":1407.893513445477,"y":723.2689485994332},"modelRole":"","parameters":[{"name":"last_day","type":"int","value":3}],"modelColors":{}}}]$irp_java_basicexperimentalframe_components$::jsonb, NOW(), NOW(), NULL
FROM users u
WHERE u.username = 'admin'
ON CONFLICT (id) DO NOTHING;

INSERT INTO models (id, user_id, lib_id, name, type, language, description, code, ports, metadata, connections, components, created_at, updated_at, deleted_at)
SELECT 'b640fe1d-2cc7-562e-8f5b-e18edb5092e0'::uuid, u.id, 'f53eab46-2ee5-5dbf-8e1a-301dd06af6c1'::uuid, $irp_java_basicinventoryrouting_name$BasicInventoryRouting$irp_java_basicinventoryrouting_name$, 'coupled'::model_type, 'java'::model_language, $irp_java_basicinventoryrouting_description$$irp_java_basicinventoryrouting_description$, $irp_java_basicinventoryrouting_code$$irp_java_basicinventoryrouting_code$, $irp_java_basicinventoryrouting_ports$[{"id":"76c48b8a-528c-447a-b84f-b38a9a20e65c","name":"receiveDeliverySchedule","type":"in"},{"id":"50c3b2e4-6d73-4718-b16d-529ec43337dd","name":"reportVehicleCost","type":"out"},{"id":"5735f15b-d01f-4424-899f-61afc0ef868c","name":"reportInventoryCost","type":"out"}]$irp_java_basicinventoryrouting_ports$::jsonb, $irp_java_basicinventoryrouting_metadata${"style":{"width":892,"height":1388},"keyword":[],"position":{"x":12,"y":9.676103500761087},"modelRole":"","modelColors":{}}$irp_java_basicinventoryrouting_metadata$::jsonb, $irp_java_basicinventoryrouting_connections$[{"to":{"port":"acceptDeliverySchedule","instanceId":"77a647c7-28d3-4f21-b7a7-a3a7569e388c"},"from":{"port":"receiveDeliverySchedule","instanceId":"root"}},{"to":{"port":"reportInventoryCost","instanceId":"root"},"from":{"port":"dailyInventoryCost","instanceId":"0c02acf6-866f-42d5-9e4c-4e7386459f37"}},{"to":{"port":"receiveDelivery","instanceId":"0c02acf6-866f-42d5-9e4c-4e7386459f37"},"from":{"port":"dropDelivery","instanceId":"0c8898cd-e6f8-4980-9e8f-0d904f1784e1"}},{"to":{"port":"receiveDelivery","instanceId":"0db1d550-426f-4dc0-8d45-9af7319527f6"},"from":{"port":"dropDelivery","instanceId":"0c8898cd-e6f8-4980-9e8f-0d904f1784e1"}},{"to":{"port":"receiveDelivery","instanceId":"9b9c3b3f-8120-4c50-9d5e-6d37fc3ca94f"},"from":{"port":"dropDelivery","instanceId":"0c8898cd-e6f8-4980-9e8f-0d904f1784e1"}},{"to":{"port":"receiveDelivery","instanceId":"a06b8588-67c6-42d6-9840-7acf7518fe3d"},"from":{"port":"dropDelivery","instanceId":"0c8898cd-e6f8-4980-9e8f-0d904f1784e1"}},{"to":{"port":"receiveDelivery","instanceId":"db617126-d2ff-46c5-af96-f7d196fbaef6"},"from":{"port":"dropDelivery","instanceId":"0c8898cd-e6f8-4980-9e8f-0d904f1784e1"}},{"to":{"port":"reportInventoryCost","instanceId":"root"},"from":{"port":"dailyInventoryCost","instanceId":"0db1d550-426f-4dc0-8d45-9af7319527f6"}},{"to":{"port":"reportVehicleCost","instanceId":"root"},"from":{"port":"dailyDeliveryCost","instanceId":"15402c03-3dfd-47c3-8305-3112de075c76"}},{"to":{"port":"receiveDelivery","instanceId":"0c02acf6-866f-42d5-9e4c-4e7386459f37"},"from":{"port":"dropDelivery","instanceId":"15402c03-3dfd-47c3-8305-3112de075c76"}},{"to":{"port":"receiveDelivery","instanceId":"0db1d550-426f-4dc0-8d45-9af7319527f6"},"from":{"port":"dropDelivery","instanceId":"15402c03-3dfd-47c3-8305-3112de075c76"}},{"to":{"port":"receiveDelivery","instanceId":"9b9c3b3f-8120-4c50-9d5e-6d37fc3ca94f"},"from":{"port":"dropDelivery","instanceId":"15402c03-3dfd-47c3-8305-3112de075c76"}},{"to":{"port":"receiveDelivery","instanceId":"a06b8588-67c6-42d6-9840-7acf7518fe3d"},"from":{"port":"dropDelivery","instanceId":"15402c03-3dfd-47c3-8305-3112de075c76"}},{"to":{"port":"receiveDelivery","instanceId":"db617126-d2ff-46c5-af96-f7d196fbaef6"},"from":{"port":"dropDelivery","instanceId":"15402c03-3dfd-47c3-8305-3112de075c76"}},{"to":{"port":"reportInventoryCost","instanceId":"root"},"from":{"port":"dailyInventoryCost","instanceId":"77a647c7-28d3-4f21-b7a7-a3a7569e388c"}},{"to":{"port":"acceptDeliveryRoute","instanceId":"0c8898cd-e6f8-4980-9e8f-0d904f1784e1"},"from":{"port":"postDeliveryRoute","instanceId":"77a647c7-28d3-4f21-b7a7-a3a7569e388c"}},{"to":{"port":"acceptDeliveryRoute","instanceId":"15402c03-3dfd-47c3-8305-3112de075c76"},"from":{"port":"postDeliveryRoute","instanceId":"77a647c7-28d3-4f21-b7a7-a3a7569e388c"}},{"to":{"port":"reportInventoryCost","instanceId":"root"},"from":{"port":"dailyInventoryCost","instanceId":"9b9c3b3f-8120-4c50-9d5e-6d37fc3ca94f"}},{"to":{"port":"reportInventoryCost","instanceId":"root"},"from":{"port":"dailyInventoryCost","instanceId":"a06b8588-67c6-42d6-9840-7acf7518fe3d"}},{"to":{"port":"reportInventoryCost","instanceId":"root"},"from":{"port":"dailyInventoryCost","instanceId":"db617126-d2ff-46c5-af96-f7d196fbaef6"}}]$irp_java_basicinventoryrouting_connections$::jsonb, $irp_java_basicinventoryrouting_components$[{"modelId":"97536cbb-fd69-5982-9862-7f5aea2a1045","instanceId":"0c02acf6-866f-42d5-9e4c-4e7386459f37","instanceMetadata":{"style":{"width":200,"height":200},"keyword":[],"position":{"x":616,"y":51},"modelRole":"","parameters":[{"name":"retailer_id","type":"int","value":0},{"name":"starting_inventory","type":"float","value":130},{"name":"min_inventory","type":"float","value":0},{"name":"max_inventory","type":"float","value":195},{"name":"daily_consumption","type":"float","value":65},{"name":"inventory_cost","type":"float","value":0.02},{"name":"closing_hour","type":"int","value":16}],"modelColors":{}}},{"modelId":"173bdabb-71ef-5950-8ff5-536e93c83350","instanceId":"0c8898cd-e6f8-4980-9e8f-0d904f1784e1","instanceMetadata":{"style":{"width":200,"height":200},"keyword":[],"position":{"x":316,"y":716.5},"modelRole":"","parameters":[{"name":"vehicle_id","type":"int","value":1},{"name":"capacity","type":"float","value":144},{"name":"cost_per_km","type":"float","value":1},{"name":"speed_km_hr","type":"float","value":150},{"name":"manufacturer_x","type":"float","value":154},{"name":"manufacturer_y","type":"float","value":417},{"name":"minutes_per_delivery","type":"int","value":15},{"name":"closing_hour","type":"int","value":16}],"modelColors":{}}},{"modelId":"97536cbb-fd69-5982-9862-7f5aea2a1045","instanceId":"0db1d550-426f-4dc0-8d45-9af7319527f6","instanceMetadata":{"style":{"width":200,"height":200},"keyword":[],"position":{"x":616,"y":351},"modelRole":"","parameters":[{"name":"retailer_id","type":"int","value":1},{"name":"starting_inventory","type":"float","value":70},{"name":"min_inventory","type":"float","value":105},{"name":"max_inventory","type":"float","value":0},{"name":"daily_consumption","type":"float","value":35},{"name":"inventory_cost","type":"float","value":0.03},{"name":"closing_hour","type":"int","value":16}],"modelColors":{}}},{"modelId":"173bdabb-71ef-5950-8ff5-536e93c83350","instanceId":"15402c03-3dfd-47c3-8305-3112de075c76","instanceMetadata":{"style":{"width":200,"height":200},"keyword":[],"position":{"x":311.4241758241758,"y":493.9747252747253},"modelRole":"","parameters":[{"name":"vehicle_id","type":"int","value":0},{"name":"capacity","type":"float","value":144},{"name":"cost_per_km","type":"float","value":1},{"name":"speed_km_hr","type":"float","value":150},{"name":"manufacturer_x","type":"float","value":154},{"name":"manufacturer_y","type":"float","value":417},{"name":"minutes_per_delivery","type":"int","value":15},{"name":"closing_hour","type":"int","value":16}],"modelColors":{}}},{"modelId":"88779612-a3b2-5900-a3d8-e24ea1943162","instanceId":"77a647c7-28d3-4f21-b7a7-a3a7569e388c","instanceMetadata":{"style":{"width":200,"height":200},"keyword":[],"position":{"x":16,"y":606},"modelRole":"","parameters":[{"name":"manufacturer_id","type":"int","value":0},{"name":"starting_inventory","type":"float","value":510},{"name":"daily_production","type":"float","value":193},{"name":"inventory_cost","type":"float","value":0.03},{"name":"opening_hour","type":"int","value":6},{"name":"manufacturer_report_minute","type":"int","value":1}],"modelColors":{}}},{"modelId":"97536cbb-fd69-5982-9862-7f5aea2a1045","instanceId":"9b9c3b3f-8120-4c50-9d5e-6d37fc3ca94f","instanceMetadata":{"style":{"width":200,"height":200},"keyword":[],"position":{"x":616,"y":572},"modelRole":"","parameters":[{"name":"retailer_id","type":"int","value":2},{"name":"starting_inventory","type":"float","value":58},{"name":"min_inventory","type":"float","value":0},{"name":"max_inventory","type":"float","value":116},{"name":"daily_consumption","type":"float","value":58},{"name":"inventory_cost","type":"float","value":0.03},{"name":"closing_hour","type":"int","value":16}],"modelColors":{}}},{"modelId":"97536cbb-fd69-5982-9862-7f5aea2a1045","instanceId":"a06b8588-67c6-42d6-9840-7acf7518fe3d","instanceMetadata":{"style":{"width":200,"height":200},"keyword":[],"position":{"x":616,"y":872},"modelRole":"","parameters":[{"name":"retailer_id","type":"int","value":3},{"name":"starting_inventory","type":"float","value":48},{"name":"min_inventory","type":"float","value":0},{"name":"max_inventory","type":"float","value":72},{"name":"daily_consumption","type":"float","value":24},{"name":"inventory_cost","type":"float","value":0.02},{"name":"closing_hour","type":"int","value":16}],"modelColors":{}}},{"modelId":"97536cbb-fd69-5982-9862-7f5aea2a1045","instanceId":"db617126-d2ff-46c5-af96-f7d196fbaef6","instanceMetadata":{"style":{"width":200,"height":200},"keyword":[],"position":{"x":616,"y":1172},"modelRole":"","parameters":[{"name":"retailer_id","type":"int","value":4},{"name":"starting_inventory","type":"float","value":11},{"name":"min_inventory","type":"float","value":0},{"name":"max_inventory","type":"float","value":22},{"name":"daily_consumption","type":"float","value":11},{"name":"inventory_cost","type":"float","value":0.02},{"name":"closing_hour","type":"int","value":16}],"modelColors":{}}}]$irp_java_basicinventoryrouting_components$::jsonb, NOW(), NOW(), NULL
FROM users u
WHERE u.username = 'admin'
ON CONFLICT (id) DO NOTHING;

INSERT INTO models (id, user_id, lib_id, name, type, language, description, code, ports, metadata, connections, components, created_at, updated_at, deleted_at)
SELECT '88779612-a3b2-5900-a3d8-e24ea1943162'::uuid, u.id, 'f53eab46-2ee5-5dbf-8e1a-301dd06af6c1'::uuid, $irp_java_manufacturer_name$Manufacturer$irp_java_manufacturer_name$, 'atomic'::model_type, 'java'::model_language, $irp_java_manufacturer_description$$irp_java_manufacturer_description$, $irp_java_manufacturer_code$package com.devsforge.runner;

import com.devsforge.runner.modeling.Atomic;
import com.devsforge.runner.modeling.Port;
import com.devsforge.runner.modeling.RunnableModel;
import com.devsforge.runner.modeling.RunnableModelParameter;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

public class Manufacturer extends Atomic {
    private static final long MINUTES_PER_DAY = 24L * 60L;

    private final Map<String, Object> parameters = new HashMap<>();
    private long currentTime = 0L;
    private double currentInventory = 0.0;
    private double dailyProduction = 0.0;
    private double inventoryCost = 0.0;
    private int manufacturerId = 0;
    private int openingHour = 6;
    private long reportMinute = 1439L;
    private long nextReportAt = 1439L;
    private final Map<Long, List<Map<String, Object>>> routeEvents = new HashMap<>();

    public Manufacturer(RunnableModel cfg) {
        super(cfg);
        if (cfg.getParameters() != null) {
            for (RunnableModelParameter parameter : cfg.getParameters()) {
                parameters.put(parameter.getName(), parameter.getValue());
            }
        }
    }

    @Override
    public void initialize() {
        currentTime = 0L;
        currentInventory = asDouble(parameters.get("starting_inventory"), 0.0);
        dailyProduction = asDouble(parameters.get("daily_production"), 0.0);
        inventoryCost = asDouble(parameters.get("inventory_cost"), 0.0);
        manufacturerId = asInt(parameters.get("manufacturer_id"), 0);
        openingHour = asInt(parameters.get("opening_hour"), 6);
        reportMinute = asLong(parameters.get("manufacturer_report_minute"), 1439L);
        if (reportMinute < 0) {
            reportMinute = 1439L;
        }
        nextReportAt = reportMinute;
        routeEvents.clear();
    }

    @Override
    public void exit() {
        // no-op
    }

    @Override
    public double ta() {
        long nextTime = nextInternalTime();
        double delta = (double) (nextTime - currentTime);
        return Math.max(delta, 0.0);
    }

    @Override
    public void deltInt() {
        long nextTime = nextInternalTime();
        currentTime = nextTime;

        if (nextReportAt == nextTime) {
            currentInventory += dailyProduction;
            nextReportAt += MINUTES_PER_DAY;
        }

        List<Map<String, Object>> routes = routeEvents.remove(nextTime);
        if (routes != null) {
            for (Map<String, Object> route : routes) {
                currentInventory -= routeLoad(route);
            }
        }
    }

    @Override
    public void deltExt(double e) {
        currentTime += Math.round(e);

        consumeInputPort("acceptDeliverySchedule", this::handleAcceptDeliverySchedule);
        consumeInputPort("acceptDelivery", this::handleAcceptDelivery);
    }

    @Override
    public void deltCon(double e) {
        deltInt();
        deltExt(0.0);
    }

    @Override
    public void lambda() {
        long nextTime = nextInternalTime();

        if (nextReportAt == nextTime) {
            double predictedInventory = currentInventory + dailyProduction;
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("day", dayFromMinute(nextTime));
            payload.put("retailerId", manufacturerId);
            payload.put("cost", predictedInventory * inventoryCost);
            emit("dailyInventoryCost", payload);
        }

        List<Map<String, Object>> routes = routeEvents.get(nextTime);
        if (routes == null) {
            return;
        }

        for (Map<String, Object> route : routes) {
            emit("postDeliveryRoute", route);
        }
    }

    private void consumeInputPort(String portName, Consumer<Object> handler) {
        try {
            Port port = getPortByName(portName);
            Object rawValues = port.getValues();
            if (rawValues instanceof List<?>) {
                List<?> values = (List<?>) rawValues;
                for (Object value : values) {
                    handler.accept(value);
                }
            }
            port.clear();
        } catch (Exception ignored) {
            // missing port
        }
    }

    private void handleAcceptDeliverySchedule(Object raw) {
        Map<String, Object> root = asMap(raw);
        Map<String, Object> byDay = asMap(root.get("deliveriesByDayByVehicle"));

        for (Map.Entry<String, Object> dayEntry : byDay.entrySet()) {
            int day = asInt(dayEntry.getKey(), -1);
            if (day < 1) {
                continue;
            }

            long loadTime = (long) (day - 1) * MINUTES_PER_DAY + (long) openingHour * 60L;
            Map<String, Object> routesByVehicle = asMap(dayEntry.getValue());
            for (Object route : routesByVehicle.values()) {
                Map<String, Object> routeMap = asMap(route);
                routeEvents.computeIfAbsent(loadTime, ignored -> new ArrayList<>()).add(routeMap);
            }
        }
    }

    private void handleAcceptDelivery(Object raw) {
        Map<String, Object> delivery = asMap(raw);
        currentInventory += asDouble(delivery.get("productAmount"), 0.0);
    }

    private long nextInternalTime() {
        long next = Math.max(nextReportAt, currentTime);
        if (!routeEvents.isEmpty()) {
            long routeMin = Long.MAX_VALUE;
            for (Long routeTime : routeEvents.keySet()) {
                if (routeTime < routeMin) {
                    routeMin = routeTime;
                }
            }
            next = Math.min(next, Math.max(routeMin, currentTime));
        }
        return next;
    }

    private void emit(String portName, Object payload) {
        try {
            Port outPort = getPortByName(portName);
            outPort.addValue(payload);
        } catch (Exception ignored) {
            // missing port
        }
    }

    private static int dayFromMinute(long minute) {
        if (minute < 0) {
            return 1;
        }
        return (int) (minute / MINUTES_PER_DAY) + 1;
    }

    private static double routeLoad(Map<String, Object> route) {
        Object deliveriesRaw = route.get("deliveries");
        if (!(deliveriesRaw instanceof List<?>)) {
            return 0.0;
        }
        List<?> deliveries = (List<?>) deliveriesRaw;
        double total = 0.0;
        for (Object item : deliveries) {
            Map<String, Object> delivery = asMap(item);
            total += asDouble(delivery.get("productAmount"), 0.0);
        }
        return total;
    }

    private static Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?>) {
            Map<?, ?> map = (Map<?, ?>) value;
            Map<String, Object> result = new HashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                result.put(String.valueOf(entry.getKey()), entry.getValue());
            }
            return result;
        }
        return new HashMap<>();
    }

    private static int asInt(Object value, int fallback) {
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        if (value instanceof String) {
            try {
                return Integer.parseInt((String) value);
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }

    private static long asLong(Object value, long fallback) {
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        if (value instanceof String) {
            try {
                return Long.parseLong((String) value);
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }

    private static double asDouble(Object value, double fallback) {
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        if (value instanceof String) {
            try {
                return Double.parseDouble((String) value);
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }
}
$irp_java_manufacturer_code$, $irp_java_manufacturer_ports$[{"id":"b7f8fef5-5622-42c8-a545-d4ce4da98613","name":"acceptDeliverySchedule","type":"in"},{"id":"06fa00ec-8022-48a8-89f8-772d361866fc","name":"acceptDelivery","type":"in"},{"id":"f0e5511d-7532-4d2f-9d2e-87ebb7b3adcb","name":"postDeliveryRoute","type":"out"},{"id":"fb4844a9-32ac-4167-ae00-9dfad0becf57","name":"dailyInventoryCost","type":"out"}]$irp_java_manufacturer_ports$::jsonb, $irp_java_manufacturer_metadata${"style":{"width":200,"height":200},"keyword":[],"position":{"x":0,"y":0},"modelRole":"","parameters":[{"name":"manufacturer_id","type":"int","value":0},{"name":"starting_inventory","type":"float","value":0},{"name":"daily_production","type":"float","value":0},{"name":"inventory_cost","type":"float","value":0},{"name":"opening_hour","type":"int","value":0},{"name":"manufacturer_report_minute","type":"int","value":0}],"modelColors":{}}$irp_java_manufacturer_metadata$::jsonb, $irp_java_manufacturer_connections$[]$irp_java_manufacturer_connections$::jsonb, $irp_java_manufacturer_components$[]$irp_java_manufacturer_components$::jsonb, NOW(), NOW(), NULL
FROM users u
WHERE u.username = 'admin'
ON CONFLICT (id) DO NOTHING;

INSERT INTO models (id, user_id, lib_id, name, type, language, description, code, ports, metadata, connections, components, created_at, updated_at, deleted_at)
SELECT '97536cbb-fd69-5982-9862-7f5aea2a1045'::uuid, u.id, 'f53eab46-2ee5-5dbf-8e1a-301dd06af6c1'::uuid, $irp_java_retailer_name$Retailer$irp_java_retailer_name$, 'atomic'::model_type, 'java'::model_language, $irp_java_retailer_description$$irp_java_retailer_description$, $irp_java_retailer_code$package com.devsforge.runner;

import com.devsforge.runner.modeling.Atomic;
import com.devsforge.runner.modeling.Port;
import com.devsforge.runner.modeling.RunnableModel;
import com.devsforge.runner.modeling.RunnableModelParameter;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class Retailer extends Atomic {
    private static final long MINUTES_PER_DAY = 24L * 60L;

    private final Map<String, Object> parameters = new HashMap<>();
    private long currentTime = 0L;
    private long nextCloseAt = 16L * 60L;
    private double currentInventory = 0.0;
    private int retailerId = 0;
    private double minInventory = 0.0;
    private double maxInventory = 0.0;
    private double dailyConsumption = 0.0;
    private double inventoryCost = 0.0;

    public Retailer(RunnableModel cfg) {
        super(cfg);
        if (cfg.getParameters() != null) {
            for (RunnableModelParameter parameter : cfg.getParameters()) {
                parameters.put(parameter.getName(), parameter.getValue());
            }
        }
    }

    @Override
    public void initialize() {
        currentTime = 0L;
        retailerId = asInt(parameters.get("retailer_id"), 0);
        currentInventory = asDouble(parameters.get("starting_inventory"), 0.0);
        minInventory = asDouble(parameters.get("min_inventory"), 0.0);
        maxInventory = asDouble(parameters.get("max_inventory"), 0.0);
        dailyConsumption = asDouble(parameters.get("daily_consumption"), 0.0);
        inventoryCost = asDouble(parameters.get("inventory_cost"), 0.0);
        int closingHour = asInt(parameters.get("closing_hour"), 16);
        nextCloseAt = (long) closingHour * 60L;
    }

    @Override
    public void exit() {
        // no-op
    }

    @Override
    public double ta() {
        return Math.max((double) (nextCloseAt - currentTime), 0.0);
    }

    @Override
    public void deltInt() {
        currentTime = nextCloseAt;

        if (currentInventory > maxInventory) {
            System.out.printf(
                "Retailer %d exceeded max inventory: current=%f max=%f%n",
                retailerId,
                currentInventory,
                maxInventory
            );
        }

        currentInventory -= dailyConsumption;

        if (currentInventory < minInventory) {
            System.out.printf(
                "Retailer %d below min inventory: current=%f min=%f%n",
                retailerId,
                currentInventory,
                minInventory
            );
        }

        nextCloseAt += MINUTES_PER_DAY;
    }

    @Override
    public void deltExt(double e) {
        currentTime += Math.round(e);

        try {
            Port inPort = getPortByName("receiveDelivery");
            Object rawValues = inPort.getValues();
            if (rawValues instanceof List<?>) {
                List<?> values = (List<?>) rawValues;
                for (Object value : values) {
                    Map<String, Object> delivery = asMap(value);
                    int incomingRetailerId = asInt(delivery.get("retailerId"), -1);
                    if (incomingRetailerId != retailerId) {
                        continue;
                    }
                    currentInventory += asDouble(delivery.get("productAmount"), 0.0);
                }
            }
            inPort.clear();
        } catch (Exception ignored) {
            // missing port
        }
    }

    @Override
    public void deltCon(double e) {
        deltInt();
        deltExt(0.0);
    }

    @Override
    public void lambda() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("day", dayFromMinute(nextCloseAt));
        payload.put("retailerId", retailerId);
        payload.put("cost", (currentInventory - dailyConsumption) * inventoryCost);

        try {
            Port outPort = getPortByName("dailyInventoryCost");
            outPort.addValue(payload);
        } catch (Exception ignored) {
            // missing port
        }
    }

    private static int dayFromMinute(long minute) {
        if (minute < 0) {
            return 1;
        }
        return (int) (minute / MINUTES_PER_DAY) + 1;
    }

    private static Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?>) {
            Map<?, ?> map = (Map<?, ?>) value;
            Map<String, Object> result = new HashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                result.put(String.valueOf(entry.getKey()), entry.getValue());
            }
            return result;
        }
        return new HashMap<>();
    }

    private static int asInt(Object value, int fallback) {
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        if (value instanceof String) {
            try {
                return Integer.parseInt((String) value);
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }

    private static double asDouble(Object value, double fallback) {
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        if (value instanceof String) {
            try {
                return Double.parseDouble((String) value);
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }
}
$irp_java_retailer_code$, $irp_java_retailer_ports$[{"id":"c4949da2-30c4-4f6f-9abc-baf508af6e7a","name":"receiveDelivery","type":"in"},{"id":"e8b5a6c0-76bc-4c36-beab-4827251d3d73","name":"dailyInventoryCost","type":"out"}]$irp_java_retailer_ports$::jsonb, $irp_java_retailer_metadata${"style":{"width":200,"height":200},"keyword":[],"position":{"x":0,"y":0},"modelRole":"","parameters":[{"name":"retailer_id","type":"int","value":0},{"name":"starting_inventory","type":"float","value":0},{"name":"min_inventory","type":"float","value":0},{"name":"max_inventory","type":"float","value":0},{"name":"daily_consumption","type":"float","value":0},{"name":"inventory_cost","type":"float","value":0},{"name":"closing_hour","type":"int","value":0}],"modelColors":{}}$irp_java_retailer_metadata$::jsonb, $irp_java_retailer_connections$[]$irp_java_retailer_connections$::jsonb, $irp_java_retailer_components$[]$irp_java_retailer_components$::jsonb, NOW(), NOW(), NULL
FROM users u
WHERE u.username = 'admin'
ON CONFLICT (id) DO NOTHING;

INSERT INTO models (id, user_id, lib_id, name, type, language, description, code, ports, metadata, connections, components, created_at, updated_at, deleted_at)
SELECT 'd4105b49-927b-56f0-a0b8-d05d448a9275'::uuid, u.id, 'f53eab46-2ee5-5dbf-8e1a-301dd06af6c1'::uuid, $irp_java_transducer_name$Transducer$irp_java_transducer_name$, 'atomic'::model_type, 'java'::model_language, $irp_java_transducer_description$$irp_java_transducer_description$, $irp_java_transducer_code$package com.devsforge.runner;

import com.devsforge.runner.modeling.Atomic;
import com.devsforge.runner.modeling.Port;
import com.devsforge.runner.modeling.RunnableModel;
import com.devsforge.runner.modeling.RunnableModelParameter;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

public class Transducer extends Atomic {
    private static final long MINUTES_PER_DAY = 24L * 60L;

    private final Map<String, Object> parameters = new HashMap<>();
    private long currentTime = 0L;
    private long finalTime = 0L;
    private boolean finalComputed = false;
    private final Map<Integer, Map<Integer, Double>> vehicleCostByDayByVehicle = new HashMap<>();
    private final Map<Integer, Map<Integer, Double>> inventoryCostByDayByRetailer = new HashMap<>();

    public Transducer(RunnableModel cfg) {
        super(cfg);
        if (cfg.getParameters() != null) {
            for (RunnableModelParameter parameter : cfg.getParameters()) {
                parameters.put(parameter.getName(), parameter.getValue());
            }
        }
    }

    @Override
    public void initialize() {
        currentTime = 0L;
        int lastDay = asInt(parameters.get("last_day"), 1);
        if (lastDay < 0) {
            lastDay = 0;
        }
        finalTime = (long) lastDay * MINUTES_PER_DAY;
        finalComputed = false;
        vehicleCostByDayByVehicle.clear();
        inventoryCostByDayByRetailer.clear();
    }

    @Override
    public void exit() {
        // no-op
    }

    @Override
    public double ta() {
        if (finalComputed) {
            return Double.MAX_VALUE;
        }
        return Math.max((double) (finalTime - currentTime), 0.0);
    }

    @Override
    public void deltInt() {
        currentTime = finalTime;
        if (finalComputed) {
            return;
        }

        List<Integer> allDays = new ArrayList<>();
        allDays.addAll(vehicleCostByDayByVehicle.keySet());
        for (Integer day : inventoryCostByDayByRetailer.keySet()) {
            if (!allDays.contains(day)) {
                allDays.add(day);
            }
        }
        allDays.sort(Integer::compareTo);

        double totalVehicleCost = 0.0;
        double totalInventoryCost = 0.0;

        for (Integer day : allDays) {
            System.out.printf("Day %d costs:%n", day);

            Map<Integer, Double> costByVehicle = vehicleCostByDayByVehicle.getOrDefault(day, Map.of());
            List<Integer> vehicleIds = new ArrayList<>(costByVehicle.keySet());
            vehicleIds.sort(Integer::compareTo);
            for (Integer vehicleId : vehicleIds) {
                double cost = costByVehicle.get(vehicleId);
                System.out.printf("Vehicle %d: %f%n", vehicleId, cost);
                totalVehicleCost += cost;
            }

            Map<Integer, Double> costByRetailer = inventoryCostByDayByRetailer.getOrDefault(day, Map.of());
            List<Integer> retailerIds = new ArrayList<>(costByRetailer.keySet());
            retailerIds.sort(Integer::compareTo);
            for (Integer retailerId : retailerIds) {
                double cost = costByRetailer.get(retailerId);
                System.out.printf("Retailer %d: %f%n", retailerId, cost);
                totalInventoryCost += cost;
            }
        }

        System.out.printf(
            "Vehicle costs %f + retailer costs %f = %f total%n",
            totalVehicleCost,
            totalInventoryCost,
            totalVehicleCost + totalInventoryCost
        );

        finalComputed = true;
    }

    @Override
    public void deltExt(double e) {
        currentTime += Math.round(e);

        consumeCostPort("aggregateInventoryCost", this::applyInventoryCost);
        consumeCostPort("aggregateVehicleCost", this::applyVehicleCost);
    }

    @Override
    public void deltCon(double e) {
        deltInt();
        deltExt(0.0);
    }

    @Override
    public void lambda() {
        // no outputs
    }

    private void consumeCostPort(String portName, Consumer<Map<String, Object>> apply) {
        try {
            Port inPort = getPortByName(portName);
            Object rawValues = inPort.getValues();
            if (rawValues instanceof List<?>) {
                List<?> values = (List<?>) rawValues;
                for (Object value : values) {
                    Map<String, Object> payload = asMap(value);
                    if (!payload.isEmpty()) {
                        apply.accept(payload);
                    }
                }
            }
            inPort.clear();
        } catch (Exception ignored) {
            // missing port
        }
    }

    private void applyInventoryCost(Map<String, Object> payload) {
        int day = dayFromMinute(currentTime);
        int retailerId = asInt(payload.get("retailerId"), 0);
        double cost = asDouble(payload.get("cost"), 0.0);
        inventoryCostByDayByRetailer.computeIfAbsent(day, ignored -> new HashMap<>()).put(retailerId, cost);
    }

    private void applyVehicleCost(Map<String, Object> payload) {
        int day = dayFromMinute(currentTime);
        int vehicleId = asInt(payload.get("vehicleId"), 0);
        double cost = asDouble(payload.get("cost"), 0.0);
        vehicleCostByDayByVehicle.computeIfAbsent(day, ignored -> new HashMap<>()).put(vehicleId, cost);
    }

    private static int dayFromMinute(long minute) {
        if (minute < 0) {
            return 1;
        }
        return (int) (minute / MINUTES_PER_DAY) + 1;
    }

    private static int asInt(Object value, int fallback) {
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        if (value instanceof String) {
            try {
                return Integer.parseInt((String) value);
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }

    private static double asDouble(Object value, double fallback) {
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        if (value instanceof String) {
            try {
                return Double.parseDouble((String) value);
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }

    private static Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?>) {
            Map<?, ?> map = (Map<?, ?>) value;
            Map<String, Object> result = new HashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                result.put(String.valueOf(entry.getKey()), entry.getValue());
            }
            return result;
        }
        return new HashMap<>();
    }
}
$irp_java_transducer_code$, $irp_java_transducer_ports$[{"id":"3b7131e4-c559-45ac-a47c-853b2fa9deeb","name":"aggregateInventoryCost","type":"in"},{"id":"6804cb3e-9bea-441e-b7dd-0523bdb7ae0d","name":"aggregateVehicleCost","type":"in"}]$irp_java_transducer_ports$::jsonb, $irp_java_transducer_metadata${"style":{"width":200,"height":200},"keyword":[],"position":{"x":0,"y":0},"modelRole":"","parameters":[{"name":"last_day","type":"int","value":0}],"modelColors":{}}$irp_java_transducer_metadata$::jsonb, $irp_java_transducer_connections$[]$irp_java_transducer_connections$::jsonb, $irp_java_transducer_components$[]$irp_java_transducer_components$::jsonb, NOW(), NOW(), NULL
FROM users u
WHERE u.username = 'admin'
ON CONFLICT (id) DO NOTHING;

INSERT INTO models (id, user_id, lib_id, name, type, language, description, code, ports, metadata, connections, components, created_at, updated_at, deleted_at)
SELECT '173bdabb-71ef-5950-8ff5-536e93c83350'::uuid, u.id, 'f53eab46-2ee5-5dbf-8e1a-301dd06af6c1'::uuid, $irp_java_vehicle_name$Vehicle$irp_java_vehicle_name$, 'atomic'::model_type, 'java'::model_language, $irp_java_vehicle_description$$irp_java_vehicle_description$, $irp_java_vehicle_code$package com.devsforge.runner;

import com.devsforge.runner.modeling.Atomic;
import com.devsforge.runner.modeling.Port;
import com.devsforge.runner.modeling.RunnableModel;
import com.devsforge.runner.modeling.RunnableModelParameter;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class Vehicle extends Atomic {
    private static final long MINUTES_PER_DAY = 24L * 60L;

    private final Map<String, Object> parameters = new HashMap<>();
    private long currentTime = 0L;
    private int vehicleId = 0;
    private double capacity = 0.0;
    private double costPerKm = 0.0;
    private double speedKmHr = 1.0;
    private int minutesPerDelivery = 15;
    private int closingHour = 16;
    private Coordinate manufacturerLocation = new Coordinate(0.0, 0.0);
    private Coordinate location = new Coordinate(0.0, 0.0);
    private double dailyKmTraveled = 0.0;
    private List<Map<String, Object>> route = new ArrayList<>();
    private VehicleEvent nextEvent = null;
    private final List<Map<String, Object>> pendingImmediate = new ArrayList<>();

    public Vehicle(RunnableModel cfg) {
        super(cfg);
        if (cfg.getParameters() != null) {
            for (RunnableModelParameter parameter : cfg.getParameters()) {
                parameters.put(parameter.getName(), parameter.getValue());
            }
        }
    }

    @Override
    public void initialize() {
        currentTime = 0L;
        vehicleId = asInt(parameters.get("vehicle_id"), 0);
        capacity = asDouble(parameters.get("capacity"), 0.0);
        costPerKm = asDouble(parameters.get("cost_per_km"), 0.0);
        speedKmHr = asDouble(parameters.get("speed_km_hr"), 1.0);
        minutesPerDelivery = asInt(parameters.get("minutes_per_delivery"), 15);
        closingHour = asInt(parameters.get("closing_hour"), 16);

        manufacturerLocation = new Coordinate(
            asDouble(parameters.get("manufacturer_x"), 0.0),
            asDouble(parameters.get("manufacturer_y"), 0.0)
        );
        location = manufacturerLocation.copy();

        dailyKmTraveled = 0.0;
        route = new ArrayList<>();
        nextEvent = null;
        pendingImmediate.clear();
    }

    @Override
    public void exit() {
        // no-op
    }

    @Override
    public double ta() {
        if (!pendingImmediate.isEmpty()) {
            return 0.0;
        }
        if (nextEvent == null) {
            return Double.MAX_VALUE;
        }
        return Math.max((double) (nextEvent.time - currentTime), 0.0);
    }

    @Override
    public void deltInt() {
        if (!pendingImmediate.isEmpty()) {
            pendingImmediate.clear();
            return;
        }

        if (nextEvent == null) {
            passivate();
            return;
        }

        currentTime = nextEvent.time;

        if (nextEvent.kind == VehicleEventKind.DELIVERY) {
            Coordinate destination = deliveryLocation(nextEvent.delivery);
            double distance = distanceBetween(location, destination);
            dailyKmTraveled += distance;
            location = destination;
            scheduleNextDelivery();
            return;
        }

        if (nextEvent.kind == VehicleEventKind.RETURN) {
            double distance = distanceBetween(location, manufacturerLocation);
            dailyKmTraveled += distance;
            location = manufacturerLocation.copy();
            dailyKmTraveled = 0.0;
            nextEvent = null;
        }
    }

    @Override
    public void deltExt(double e) {
        currentTime += Math.round(e);

        try {
            Port inPort = getPortByName("acceptDeliveryRoute");
            Object rawValues = inPort.getValues();
            if (rawValues instanceof List<?>) {
                List<?> values = (List<?>) rawValues;
                for (Object value : values) {
                    handleAcceptDeliveryRoute(value);
                }
            }
            inPort.clear();
        } catch (Exception ignored) {
            // missing port
        }
    }

    @Override
    public void deltCon(double e) {
        deltInt();
        deltExt(0.0);
    }

    @Override
    public void lambda() {
        if (!pendingImmediate.isEmpty()) {
            for (Map<String, Object> payload : pendingImmediate) {
                emit("dropDelivery", payload);
            }
            return;
        }

        if (nextEvent == null) {
            return;
        }

        if (nextEvent.kind == VehicleEventKind.DELIVERY) {
            emit("dropDelivery", nextEvent.delivery);
            return;
        }

        if (nextEvent.kind == VehicleEventKind.RETURN) {
            double distance = distanceBetween(location, manufacturerLocation);
            double cost = (dailyKmTraveled + distance) * costPerKm;
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("vehicleId", vehicleId);
            payload.put("day", dayFromMinute(nextEvent.time));
            payload.put("cost", cost);
            emit("dailyDeliveryCost", payload);
        }
    }

    private void handleAcceptDeliveryRoute(Object raw) {
        Map<String, Object> routeMap = asMap(raw);
        if (routeMap.isEmpty()) {
            return;
        }

        int incomingVehicleId = asInt(routeMap.get("vehicleId"), vehicleId);
        if (incomingVehicleId != vehicleId) {
            return;
        }

        Object deliveriesRaw = routeMap.get("deliveries");
        List<Map<String, Object>> deliveries = new ArrayList<>();
        double totalQuantity = 0.0;

        if (deliveriesRaw instanceof List<?>) {
            for (Object item : (List<?>) deliveriesRaw) {
                Map<String, Object> delivery = asMap(item);
                if (delivery.isEmpty()) {
                    continue;
                }
                deliveries.add(delivery);
                totalQuantity += asDouble(delivery.get("productAmount"), 0.0);
            }
        }

        if (totalQuantity > capacity) {
            double excess = totalQuantity - capacity;
            Map<String, Object> returnDelivery = new LinkedHashMap<>();
            returnDelivery.put("retailerId", 0);

            Map<String, Object> manufacturerPoint = new LinkedHashMap<>();
            manufacturerPoint.put("x", manufacturerLocation.x);
            manufacturerPoint.put("y", manufacturerLocation.y);
            returnDelivery.put("retailerLocation", manufacturerPoint);
            returnDelivery.put("productAmount", excess);

            pendingImmediate.add(returnDelivery);
            dailyKmTraveled = 0.0;
        }

        route = deliveries;
        scheduleNextDelivery();
    }

    private void scheduleNextDelivery() {
        if (route.isEmpty()) {
            scheduleReturnToManufacturer(currentTime);
            return;
        }

        Map<String, Object> nextDelivery = route.remove(0);
        Coordinate destination = deliveryLocation(nextDelivery);
        double distance = distanceBetween(location, destination);
        long arrival = currentTime + (long) minutesPerDelivery + (long) (distance / (safeSpeed(speedKmHr) / 60.0));

        if (hourPart(arrival) < closingHour) {
            nextEvent = new VehicleEvent(arrival, VehicleEventKind.DELIVERY, nextDelivery);
            return;
        }

        scheduleReturnToManufacturer(currentTime);
    }

    private void scheduleReturnToManufacturer(long baseTime) {
        double distance = distanceBetween(location, manufacturerLocation);
        long arrival = baseTime + (long) minutesPerDelivery + (long) (distance / (safeSpeed(speedKmHr) / 60.0));
        nextEvent = new VehicleEvent(arrival, VehicleEventKind.RETURN, null);
    }

    private void emit(String portName, Object payload) {
        try {
            Port outPort = getPortByName(portName);
            outPort.addValue(payload);
        } catch (Exception ignored) {
            // missing port
        }
    }

    private static Coordinate deliveryLocation(Map<String, Object> delivery) {
        Map<String, Object> locationMap = asMap(delivery.get("retailerLocation"));
        return new Coordinate(
            asDouble(locationMap.get("x"), 0.0),
            asDouble(locationMap.get("y"), 0.0)
        );
    }

    private static double distanceBetween(Coordinate c1, Coordinate c2) {
        double dx = c1.x - c2.x;
        double dy = c1.y - c2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private static double safeSpeed(double speed) {
        if (speed <= 0.0) {
            return 1.0;
        }
        return speed;
    }

    private static int hourPart(long minute) {
        if (minute < 0) {
            return 0;
        }
        return (int) ((minute / 60L) % 24L);
    }

    private static int dayFromMinute(long minute) {
        if (minute < 0) {
            return 1;
        }
        return (int) (minute / MINUTES_PER_DAY) + 1;
    }

    private static Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?>) {
            Map<?, ?> map = (Map<?, ?>) value;
            Map<String, Object> result = new HashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                result.put(String.valueOf(entry.getKey()), entry.getValue());
            }
            return result;
        }
        return new HashMap<>();
    }

    private static int asInt(Object value, int fallback) {
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        if (value instanceof String) {
            try {
                return Integer.parseInt((String) value);
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }

    private static double asDouble(Object value, double fallback) {
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        if (value instanceof String) {
            try {
                return Double.parseDouble((String) value);
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }

    private enum VehicleEventKind {
        DELIVERY,
        RETURN
    }

    private static class VehicleEvent {
        private final long time;
        private final VehicleEventKind kind;
        private final Map<String, Object> delivery;

        private VehicleEvent(long time, VehicleEventKind kind, Map<String, Object> delivery) {
            this.time = time;
            this.kind = kind;
            this.delivery = delivery;
        }
    }

    private static class Coordinate {
        private final double x;
        private final double y;

        private Coordinate(double x, double y) {
            this.x = x;
            this.y = y;
        }

        private Coordinate copy() {
            return new Coordinate(x, y);
        }
    }
}
$irp_java_vehicle_code$, $irp_java_vehicle_ports$[{"id":"8adf1813-a157-4d84-a4ab-ee26f1a5f955","name":"acceptDeliveryRoute","type":"in"},{"id":"6d20f2cd-0c2a-49c5-96b9-328d76c931c1","name":"dropDelivery","type":"out"},{"id":"e9e0d037-9512-4f66-ae1c-80275ae01673","name":"dailyDeliveryCost","type":"out"}]$irp_java_vehicle_ports$::jsonb, $irp_java_vehicle_metadata${"style":{"width":200,"height":200},"keyword":[],"position":{"x":0,"y":0},"modelRole":"","parameters":[{"name":"vehicle_id","type":"int","value":0},{"name":"capacity","type":"float","value":0},{"name":"cost_per_km","type":"float","value":0},{"name":"speed_km_hr","type":"float","value":0},{"name":"manufacturer_x","type":"float","value":0},{"name":"manufacturer_y","type":"float","value":0},{"name":"minutes_per_delivery","type":"int","value":0},{"name":"closing_hour","type":"int","value":0}],"modelColors":{}}$irp_java_vehicle_metadata$::jsonb, $irp_java_vehicle_connections$[]$irp_java_vehicle_connections$::jsonb, $irp_java_vehicle_components$[]$irp_java_vehicle_components$::jsonb, NOW(), NOW(), NULL
FROM users u
WHERE u.username = 'admin'
ON CONFLICT (id) DO NOTHING;
