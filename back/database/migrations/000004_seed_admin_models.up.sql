-- Seed default admin user (if missing), then seed admin models.
-- Model inserts target username='admin', so they remain idempotent.

INSERT INTO users (id, username, email, password, fullname, refresh_token, created_at, updated_at, deleted_at)
VALUES (
    'c148bb49-bbd2-4055-bfed-0c65539b77e3'::uuid,
    'admin',
    'admin@gmail.com',
    '$2a$14$F2jUgz16d4LUpPvPqMSKxuvDN1luX69w.eK2E9StUT3jFyzGu7USq',
    '',
    '',
    NOW(),
    NOW(),
    NULL
)
ON CONFLICT DO NOTHING;

INSERT INTO libraries (id, user_id, title, description, created_at, updated_at, deleted_at)
SELECT 'bd9dd34b-9b4d-4b2d-929b-145b96435eef'::uuid, u.id, 'IRP-Python', '', '2026-05-01 06:45:42.621196+00'::timestamptz, '2026-05-01 06:45:42.621196+00'::timestamptz, '0001-01-01 00:00:00+00'::timestamptz
FROM users u
WHERE u.username = 'admin'
ON CONFLICT (id) DO NOTHING;

INSERT INTO models (id, user_id, lib_id, name, type, language, description, code, ports, metadata, connections, components, created_at, updated_at, deleted_at)
SELECT 'd5cf6d62-7884-4ed9-b03a-3d129a62014a'::uuid, u.id, 'bd9dd34b-9b4d-4b2d-929b-145b96435eef'::uuid, 'DeliveryScheduleGenerator', 'atomic'::model_type, 'python'::model_language, '', 'from __future__ import annotations

from typing import Any

from modeling import Atomic, RunnableModelCfg, RunnableModelPortCfg, INFINITY, new_atomic_from_cfg


class DeliveryScheduleGeneratorIRP(Atomic):
    def __init__(self, id: str, name: str, ports=None):
        super().__init__(id=id, name=name, ports=ports)
        self.parameters: dict[str, Any] = {}
        self.current_time: int = 0
        self.posted: bool = False
        self.schedule_data: dict[str, Any] = {"deliveriesByDayByVehicle": {}}

    def initialize(self) -> None:
        self.current_time = 0
        self.posted = False

        custom_schedule = self.parameters.get("delivery_schedule")
        if isinstance(custom_schedule, dict):
            self.schedule_data = custom_schedule
            return

        self.schedule_data = self._build_schedule_from_parameters()

    def exit(self) -> None:
        return

    def ta(self) -> float:
        return INFINITY if self.posted else 0.0

    def delt_int(self) -> None:
        self.posted = True

    def delt_ext(self, e: float) -> None:
        self.current_time += int(round(e))

    def delt_con(self, e: float) -> None:
        self.delt_int()
        self.delt_ext(0.0)

    def lambda_(self) -> None:
        if self.posted:
            return

        try:
            out_port = self.get_port_by_name("postDeliverySchedule")
        except KeyError:
            return
        out_port.add_value(self.schedule_data)

    def _build_schedule_from_parameters(self) -> dict[str, Any]:
        num_time_periods = _as_int(self.parameters.get("num_time_periods"), 1)
        num_vehicles = _as_int(self.parameters.get("num_vehicles"), 1)
        vehicle_capacity = _as_float(self.parameters.get("vehicle_capacity"), 100.0)

        retailers_raw = self.parameters.get("retailers")
        retailers = [item for item in retailers_raw if isinstance(item, dict)] if isinstance(retailers_raw, list) else []

        deliveries_by_day_by_vehicle: dict[str, Any] = {}

        for day in range(1, num_time_periods + 1):
            retailer_index = 0
            daily_deliveries: dict[str, Any] = {}

            for vehicle_id in range(num_vehicles):
                delivery_route: dict[str, Any] = {
                    "vehicleId": vehicle_id,
                    "deliveries": [],
                }

                if retailer_index >= len(retailers):
                    continue

                retailer_data = retailers[retailer_index]
                loaded_quantity = _as_float(retailer_data.get("daily_consumption"), 0.0)
                vehicle_load = 0.0

                while vehicle_load + loaded_quantity < vehicle_capacity and retailer_index < len(retailers):
                    vehicle_load += loaded_quantity
                    retailer_id = _as_int(retailer_data.get("id"), retailer_index)
                    delivery = {
                        "retailerId": retailer_id,
                        "retailerLocation": {
                            "x": _as_float(retailer_data.get("x"), 0.0),
                            "y": _as_float(retailer_data.get("y"), 0.0),
                        },
                        "productAmount": loaded_quantity,
                    }
                    delivery_route["deliveries"].append(delivery)
                    retailer_index += 1

                    if retailer_index - 1 < len(retailers):
                        retailer_data = retailers[retailer_index - 1]
                        loaded_quantity = _as_float(retailer_data.get("daily_consumption"), 0.0)

                if delivery_route["deliveries"]:
                    daily_deliveries[str(vehicle_id)] = delivery_route

            deliveries_by_day_by_vehicle[str(day)] = daily_deliveries

        return {"deliveriesByDayByVehicle": deliveries_by_day_by_vehicle}


def NewModel(config: dict) -> Atomic:
    raw_ports = config.get("ports") or []
    ports_cfg = [
        RunnableModelPortCfg(
            id=p["id"],
            name=p.get("name", p["id"]),
            type=p["type"],
        )
        for p in raw_ports
    ]

    cfg = RunnableModelCfg(
        id=config["id"],
        name=config["name"],
        ports=ports_cfg,
    )

    model = new_atomic_from_cfg(cfg, DeliveryScheduleGeneratorIRP)
    raw_parameters = config.get("parameters") or []
    model.parameters = {
        p["name"]: p.get("value")
        for p in raw_parameters
        if isinstance(p, dict) and p.get("name")
    }
    return model


def _as_int(value: Any, fallback: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def _as_float(value: Any, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback
', '[{"id": "99618c33-1876-4d2b-8a7e-cbc2b6699ba2", "name": "postDeliverySchedule", "type": "out"}]'::jsonb, '{"style": {"width": 200, "height": 200}, "keyword": [], "position": {"x": 0, "y": 0}, "modelRole": "", "parameters": [{"name": "num_time_periods", "type": "int", "value": 0}, {"name": "num_vehicles", "type": "int", "value": 0}, {"name": "vehicle_capacity", "type": "float", "value": 0}, {"name": "retailers", "type": "object", "value": []}], "modelColors": {}}'::jsonb, '[]'::jsonb, '[]'::jsonb, '2026-05-01 06:53:17.386329+00'::timestamptz, '2026-05-01 06:53:17.386329+00'::timestamptz, NULL
FROM users u
WHERE u.username = 'admin'
ON CONFLICT (id) DO NOTHING;
INSERT INTO models (id, user_id, lib_id, name, type, language, description, code, ports, metadata, connections, components, created_at, updated_at, deleted_at)
SELECT '604a54ad-bc31-4a94-917e-ebb49c488452'::uuid, u.id, 'bd9dd34b-9b4d-4b2d-929b-145b96435eef'::uuid, 'BasicExperimentalFrame', 'coupled'::model_type, 'python'::model_language, '', '', '[]'::jsonb, '{"style": {"width": 1681, "height": 1718}, "keyword": [], "position": {"x": -1653.2022877125557, "y": -670.2027664974363}, "modelRole": "", "modelColors": {}}'::jsonb, '[{"to": {"port": "receiveDeliverySchedule", "instanceId": "580c5c9d-f085-4c63-b85e-57965fd68838"}, "from": {"port": "postDeliverySchedule", "instanceId": "1b169311-a8d2-4af2-80f6-492f000a901c"}}, {"to": {"port": "aggregateInventoryCost", "instanceId": "f8537458-e594-4412-a892-1e439b25d9df"}, "from": {"port": "reportInventoryCost", "instanceId": "580c5c9d-f085-4c63-b85e-57965fd68838"}}, {"to": {"port": "aggregateVehicleCost", "instanceId": "f8537458-e594-4412-a892-1e439b25d9df"}, "from": {"port": "reportVehicleCost", "instanceId": "580c5c9d-f085-4c63-b85e-57965fd68838"}}]'::jsonb, '[{"modelId": "d5cf6d62-7884-4ed9-b03a-3d129a62014a", "instanceId": "1b169311-a8d2-4af2-80f6-492f000a901c", "instanceMetadata": {"style": {"width": 200, "height": 200}, "keyword": [], "position": {"x": 63.48721200787509, "y": 744.3605266425859}, "modelRole": "", "parameters": [{"name": "num_time_periods", "type": "int", "value": 3}, {"name": "num_vehicles", "type": "int", "value": 2}, {"name": "vehicle_capacity", "type": "float", "value": 144}, {"name": "retailers", "type": "object", "value": []}], "modelColors": {}}}, {"modelId": "a4c1c8fe-5713-4e51-a53d-4192aac53c43", "instanceId": "580c5c9d-f085-4c63-b85e-57965fd68838", "instanceMetadata": {"style": {"width": 892, "height": 1388}, "keyword": [], "position": {"x": 385.40506044493077, "y": 104.99789384859696}, "modelRole": "", "modelColors": {}}}, {"modelId": "331408a8-51e6-42b0-9185-f3ca3d4a4fc8", "instanceId": "f8537458-e594-4412-a892-1e439b25d9df", "instanceMetadata": {"style": {"width": 200, "height": 200}, "keyword": [], "position": {"x": 1407.893513445477, "y": 723.2689485994332}, "modelRole": "", "parameters": [{"name": "last_day", "type": "int", "value": 3}], "modelColors": {}}}]'::jsonb, '2026-05-01 06:53:56.327543+00'::timestamptz, '2026-05-01 06:53:56.327543+00'::timestamptz, NULL
FROM users u
WHERE u.username = 'admin'
ON CONFLICT (id) DO NOTHING;
INSERT INTO models (id, user_id, lib_id, name, type, language, description, code, ports, metadata, connections, components, created_at, updated_at, deleted_at)
SELECT 'a4c1c8fe-5713-4e51-a53d-4192aac53c43'::uuid, u.id, 'bd9dd34b-9b4d-4b2d-929b-145b96435eef'::uuid, 'BasicInventoryRouting', 'coupled'::model_type, 'python'::model_language, '', '', '[{"id": "76c48b8a-528c-447a-b84f-b38a9a20e65c", "name": "receiveDeliverySchedule", "type": "in"}, {"id": "50c3b2e4-6d73-4718-b16d-529ec43337dd", "name": "reportVehicleCost", "type": "out"}, {"id": "5735f15b-d01f-4424-899f-61afc0ef868c", "name": "reportInventoryCost", "type": "out"}]'::jsonb, '{"style": {"width": 892, "height": 1388}, "keyword": [], "position": {"x": 12, "y": 9.676103500761087}, "modelRole": "", "modelColors": {}}'::jsonb, '[{"to": {"port": "acceptDeliverySchedule", "instanceId": "77a647c7-28d3-4f21-b7a7-a3a7569e388c"}, "from": {"port": "receiveDeliverySchedule", "instanceId": "root"}}, {"to": {"port": "reportInventoryCost", "instanceId": "root"}, "from": {"port": "dailyInventoryCost", "instanceId": "0c02acf6-866f-42d5-9e4c-4e7386459f37"}}, {"to": {"port": "receiveDelivery", "instanceId": "0c02acf6-866f-42d5-9e4c-4e7386459f37"}, "from": {"port": "dropDelivery", "instanceId": "0c8898cd-e6f8-4980-9e8f-0d904f1784e1"}}, {"to": {"port": "receiveDelivery", "instanceId": "0db1d550-426f-4dc0-8d45-9af7319527f6"}, "from": {"port": "dropDelivery", "instanceId": "0c8898cd-e6f8-4980-9e8f-0d904f1784e1"}}, {"to": {"port": "receiveDelivery", "instanceId": "9b9c3b3f-8120-4c50-9d5e-6d37fc3ca94f"}, "from": {"port": "dropDelivery", "instanceId": "0c8898cd-e6f8-4980-9e8f-0d904f1784e1"}}, {"to": {"port": "receiveDelivery", "instanceId": "a06b8588-67c6-42d6-9840-7acf7518fe3d"}, "from": {"port": "dropDelivery", "instanceId": "0c8898cd-e6f8-4980-9e8f-0d904f1784e1"}}, {"to": {"port": "receiveDelivery", "instanceId": "db617126-d2ff-46c5-af96-f7d196fbaef6"}, "from": {"port": "dropDelivery", "instanceId": "0c8898cd-e6f8-4980-9e8f-0d904f1784e1"}}, {"to": {"port": "reportInventoryCost", "instanceId": "root"}, "from": {"port": "dailyInventoryCost", "instanceId": "0db1d550-426f-4dc0-8d45-9af7319527f6"}}, {"to": {"port": "reportVehicleCost", "instanceId": "root"}, "from": {"port": "dailyDeliveryCost", "instanceId": "15402c03-3dfd-47c3-8305-3112de075c76"}}, {"to": {"port": "receiveDelivery", "instanceId": "0c02acf6-866f-42d5-9e4c-4e7386459f37"}, "from": {"port": "dropDelivery", "instanceId": "15402c03-3dfd-47c3-8305-3112de075c76"}}, {"to": {"port": "receiveDelivery", "instanceId": "0db1d550-426f-4dc0-8d45-9af7319527f6"}, "from": {"port": "dropDelivery", "instanceId": "15402c03-3dfd-47c3-8305-3112de075c76"}}, {"to": {"port": "receiveDelivery", "instanceId": "9b9c3b3f-8120-4c50-9d5e-6d37fc3ca94f"}, "from": {"port": "dropDelivery", "instanceId": "15402c03-3dfd-47c3-8305-3112de075c76"}}, {"to": {"port": "receiveDelivery", "instanceId": "a06b8588-67c6-42d6-9840-7acf7518fe3d"}, "from": {"port": "dropDelivery", "instanceId": "15402c03-3dfd-47c3-8305-3112de075c76"}}, {"to": {"port": "receiveDelivery", "instanceId": "db617126-d2ff-46c5-af96-f7d196fbaef6"}, "from": {"port": "dropDelivery", "instanceId": "15402c03-3dfd-47c3-8305-3112de075c76"}}, {"to": {"port": "reportInventoryCost", "instanceId": "root"}, "from": {"port": "dailyInventoryCost", "instanceId": "77a647c7-28d3-4f21-b7a7-a3a7569e388c"}}, {"to": {"port": "acceptDeliveryRoute", "instanceId": "0c8898cd-e6f8-4980-9e8f-0d904f1784e1"}, "from": {"port": "postDeliveryRoute", "instanceId": "77a647c7-28d3-4f21-b7a7-a3a7569e388c"}}, {"to": {"port": "acceptDeliveryRoute", "instanceId": "15402c03-3dfd-47c3-8305-3112de075c76"}, "from": {"port": "postDeliveryRoute", "instanceId": "77a647c7-28d3-4f21-b7a7-a3a7569e388c"}}, {"to": {"port": "reportInventoryCost", "instanceId": "root"}, "from": {"port": "dailyInventoryCost", "instanceId": "9b9c3b3f-8120-4c50-9d5e-6d37fc3ca94f"}}, {"to": {"port": "reportInventoryCost", "instanceId": "root"}, "from": {"port": "dailyInventoryCost", "instanceId": "a06b8588-67c6-42d6-9840-7acf7518fe3d"}}, {"to": {"port": "reportInventoryCost", "instanceId": "root"}, "from": {"port": "dailyInventoryCost", "instanceId": "db617126-d2ff-46c5-af96-f7d196fbaef6"}}]'::jsonb, '[{"modelId": "3f0e2f51-6a81-4f97-b8cc-7fe355c79cc8", "instanceId": "0c02acf6-866f-42d5-9e4c-4e7386459f37", "instanceMetadata": {"style": {"width": 200, "height": 200}, "keyword": [], "position": {"x": 616, "y": 51}, "modelRole": "", "parameters": [{"name": "retailer_id", "type": "int", "value": 0}, {"name": "starting_inventory", "type": "float", "value": 130}, {"name": "min_inventory", "type": "float", "value": 0}, {"name": "max_inventory", "type": "float", "value": 195}, {"name": "daily_consumption", "type": "float", "value": 65}, {"name": "inventory_cost", "type": "float", "value": 0.02}, {"name": "closing_hour", "type": "int", "value": 16}], "modelColors": {}}}, {"modelId": "a638d6d9-2611-4526-b638-f03b2043742a", "instanceId": "0c8898cd-e6f8-4980-9e8f-0d904f1784e1", "instanceMetadata": {"style": {"width": 200, "height": 200}, "keyword": [], "position": {"x": 316, "y": 716.5}, "modelRole": "", "parameters": [{"name": "vehicle_id", "type": "int", "value": 1}, {"name": "capacity", "type": "float", "value": 144}, {"name": "cost_per_km", "type": "float", "value": 1}, {"name": "speed_km_hr", "type": "float", "value": 150}, {"name": "manufacturer_x", "type": "float", "value": 154}, {"name": "manufacturer_y", "type": "float", "value": 417}, {"name": "minutes_per_delivery", "type": "int", "value": 15}, {"name": "closing_hour", "type": "int", "value": 16}], "modelColors": {}}}, {"modelId": "3f0e2f51-6a81-4f97-b8cc-7fe355c79cc8", "instanceId": "0db1d550-426f-4dc0-8d45-9af7319527f6", "instanceMetadata": {"style": {"width": 200, "height": 200}, "keyword": [], "position": {"x": 616, "y": 351}, "modelRole": "", "parameters": [{"name": "retailer_id", "type": "int", "value": 1}, {"name": "starting_inventory", "type": "float", "value": 70}, {"name": "min_inventory", "type": "float", "value": 105}, {"name": "max_inventory", "type": "float", "value": 0}, {"name": "daily_consumption", "type": "float", "value": 35}, {"name": "inventory_cost", "type": "float", "value": 0.03}, {"name": "closing_hour", "type": "int", "value": 16}], "modelColors": {}}}, {"modelId": "a638d6d9-2611-4526-b638-f03b2043742a", "instanceId": "15402c03-3dfd-47c3-8305-3112de075c76", "instanceMetadata": {"style": {"width": 200, "height": 200}, "keyword": [], "position": {"x": 311.4241758241758, "y": 493.9747252747253}, "modelRole": "", "parameters": [{"name": "vehicle_id", "type": "int", "value": 0}, {"name": "capacity", "type": "float", "value": 144}, {"name": "cost_per_km", "type": "float", "value": 1}, {"name": "speed_km_hr", "type": "float", "value": 150}, {"name": "manufacturer_x", "type": "float", "value": 154}, {"name": "manufacturer_y", "type": "float", "value": 417}, {"name": "minutes_per_delivery", "type": "int", "value": 15}, {"name": "closing_hour", "type": "int", "value": 16}], "modelColors": {}}}, {"modelId": "3dd4d8e6-44e2-4050-9d84-4fb3af49fa04", "instanceId": "77a647c7-28d3-4f21-b7a7-a3a7569e388c", "instanceMetadata": {"style": {"width": 200, "height": 200}, "keyword": [], "position": {"x": 16, "y": 606}, "modelRole": "", "parameters": [{"name": "manufacturer_id", "type": "int", "value": 0}, {"name": "starting_inventory", "type": "float", "value": 510}, {"name": "daily_production", "type": "float", "value": 193}, {"name": "inventory_cost", "type": "float", "value": 0.03}, {"name": "opening_hour", "type": "int", "value": 6}, {"name": "manufacturer_report_minute", "type": "int", "value": 1}], "modelColors": {}}}, {"modelId": "3f0e2f51-6a81-4f97-b8cc-7fe355c79cc8", "instanceId": "9b9c3b3f-8120-4c50-9d5e-6d37fc3ca94f", "instanceMetadata": {"style": {"width": 200, "height": 200}, "keyword": [], "position": {"x": 616, "y": 572}, "modelRole": "", "parameters": [{"name": "retailer_id", "type": "int", "value": 2}, {"name": "starting_inventory", "type": "float", "value": 58}, {"name": "min_inventory", "type": "float", "value": 0}, {"name": "max_inventory", "type": "float", "value": 116}, {"name": "daily_consumption", "type": "float", "value": 58}, {"name": "inventory_cost", "type": "float", "value": 0.03}, {"name": "closing_hour", "type": "int", "value": 16}], "modelColors": {}}}, {"modelId": "3f0e2f51-6a81-4f97-b8cc-7fe355c79cc8", "instanceId": "a06b8588-67c6-42d6-9840-7acf7518fe3d", "instanceMetadata": {"style": {"width": 200, "height": 200}, "keyword": [], "position": {"x": 616, "y": 872}, "modelRole": "", "parameters": [{"name": "retailer_id", "type": "int", "value": 3}, {"name": "starting_inventory", "type": "float", "value": 48}, {"name": "min_inventory", "type": "float", "value": 0}, {"name": "max_inventory", "type": "float", "value": 72}, {"name": "daily_consumption", "type": "float", "value": 24}, {"name": "inventory_cost", "type": "float", "value": 0.02}, {"name": "closing_hour", "type": "int", "value": 16}], "modelColors": {}}}, {"modelId": "3f0e2f51-6a81-4f97-b8cc-7fe355c79cc8", "instanceId": "db617126-d2ff-46c5-af96-f7d196fbaef6", "instanceMetadata": {"style": {"width": 200, "height": 200}, "keyword": [], "position": {"x": 616, "y": 1172}, "modelRole": "", "parameters": [{"name": "retailer_id", "type": "int", "value": 4}, {"name": "starting_inventory", "type": "float", "value": 11}, {"name": "min_inventory", "type": "float", "value": 0}, {"name": "max_inventory", "type": "float", "value": 22}, {"name": "daily_consumption", "type": "float", "value": 11}, {"name": "inventory_cost", "type": "float", "value": 0.02}, {"name": "closing_hour", "type": "int", "value": 16}], "modelColors": {}}}]'::jsonb, '2026-05-01 06:54:14.108083+00'::timestamptz, '2026-05-01 06:54:14.108083+00'::timestamptz, NULL
FROM users u
WHERE u.username = 'admin'
ON CONFLICT (id) DO NOTHING;
INSERT INTO models (id, user_id, lib_id, name, type, language, description, code, ports, metadata, connections, components, created_at, updated_at, deleted_at)
SELECT '3dd4d8e6-44e2-4050-9d84-4fb3af49fa04'::uuid, u.id, 'bd9dd34b-9b4d-4b2d-929b-145b96435eef'::uuid, 'Manufacturer', 'atomic'::model_type, 'python'::model_language, '', 'from __future__ import annotations

from typing import Any

from modeling import Atomic, RunnableModelCfg, RunnableModelPortCfg, INFINITY, new_atomic_from_cfg

MINUTES_PER_DAY = 24 * 60


class ManufacturerIRP(Atomic):
    def __init__(self, id: str, name: str, ports=None):
        super().__init__(id=id, name=name, ports=ports)
        self.parameters: dict[str, Any] = {}
        self.current_time: int = 0
        self.current_inventory: float = 0.0
        self.daily_production: float = 0.0
        self.inventory_cost: float = 0.0
        self.manufacturer_id: int = 0
        self.opening_hour: int = 6
        self.report_minute: int = 1439
        self.next_report_at: int = 1439
        self.route_events: dict[int, list[dict[str, Any]]] = {}

    def initialize(self) -> None:
        self.current_time = 0
        self.current_inventory = _as_float(self.parameters.get("starting_inventory"), 0.0)
        self.daily_production = _as_float(self.parameters.get("daily_production"), 0.0)
        self.inventory_cost = _as_float(self.parameters.get("inventory_cost"), 0.0)
        self.manufacturer_id = _as_int(self.parameters.get("manufacturer_id"), 0)
        self.opening_hour = _as_int(self.parameters.get("opening_hour"), 6)
        self.report_minute = _as_int(self.parameters.get("manufacturer_report_minute"), 1439)
        if self.report_minute < 0:
            self.report_minute = 1439
        self.next_report_at = self.report_minute
        self.route_events = {}

    def exit(self) -> None:
        return

    def ta(self) -> float:
        next_time = self._next_internal_time()
        if next_time is None:
            return INFINITY
        return max(float(next_time - self.current_time), 0.0)

    def delt_int(self) -> None:
        next_time = self._next_internal_time()
        if next_time is None:
            self.passivate()
            return

        self.current_time = next_time

        if self.next_report_at == next_time:
            self.current_inventory += self.daily_production
            self.next_report_at += MINUTES_PER_DAY

        routes = self.route_events.pop(next_time, [])
        for route in routes:
            self.current_inventory -= _route_load(route)

    def delt_ext(self, e: float) -> None:
        self.current_time += int(round(e))

        self._consume_input_port("acceptDeliverySchedule", self._handle_accept_delivery_schedule)
        self._consume_input_port("acceptDelivery", self._handle_accept_delivery)

    def delt_con(self, e: float) -> None:
        self.delt_int()
        self.delt_ext(0.0)

    def lambda_(self) -> None:
        next_time = self._next_internal_time()
        if next_time is None:
            return

        if self.next_report_at == next_time:
            predicted_inventory = self.current_inventory + self.daily_production
            self._emit(
                "dailyInventoryCost",
                {
                    "day": _day_from_minute(next_time),
                    "retailerId": self.manufacturer_id,
                    "cost": predicted_inventory * self.inventory_cost,
                },
            )

        for route in self.route_events.get(next_time, []):
            self._emit("postDeliveryRoute", route)

    def _consume_input_port(self, port_name: str, handler) -> None:
        try:
            port = self.get_port_by_name(port_name)
        except KeyError:
            return

        for value in list(port.get_values()):
            handler(value)
        port.clear()

    def _handle_accept_delivery_schedule(self, raw: Any) -> None:
        payload = _as_dict(raw)
        by_day = _as_dict(payload.get("deliveriesByDayByVehicle"))

        for day_key, routes_by_vehicle in by_day.items():
            day = _as_int(day_key, -1)
            if day < 1:
                continue
            load_time = (day - 1) * MINUTES_PER_DAY + self.opening_hour * 60
            by_vehicle = _as_dict(routes_by_vehicle)
            for route in by_vehicle.values():
                route_map = _as_dict(route)
                self.route_events.setdefault(load_time, []).append(route_map)

    def _handle_accept_delivery(self, raw: Any) -> None:
        delivery = _as_dict(raw)
        self.current_inventory += _as_float(delivery.get("productAmount"), 0.0)

    def _next_internal_time(self) -> int | None:
        next_time = self.next_report_at
        if self.route_events:
            route_time = min(self.route_events.keys())
            next_time = min(next_time, route_time)
        return max(next_time, self.current_time)

    def _emit(self, port_name: str, payload: Any) -> None:
        try:
            out_port = self.get_port_by_name(port_name)
        except KeyError:
            return
        out_port.add_value(payload)


def NewModel(config: dict) -> Atomic:
    raw_ports = config.get("ports") or []
    ports_cfg = [
        RunnableModelPortCfg(
            id=p["id"],
            name=p.get("name", p["id"]),
            type=p["type"],
        )
        for p in raw_ports
    ]

    cfg = RunnableModelCfg(
        id=config["id"],
        name=config["name"],
        ports=ports_cfg,
    )

    model = new_atomic_from_cfg(cfg, ManufacturerIRP)
    raw_parameters = config.get("parameters") or []
    model.parameters = {
        p["name"]: p.get("value")
        for p in raw_parameters
        if isinstance(p, dict) and p.get("name")
    }
    return model


def _as_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {}


def _as_int(value: Any, fallback: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def _as_float(value: Any, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _day_from_minute(minute: int) -> int:
    return minute // MINUTES_PER_DAY + 1


def _route_load(route: dict[str, Any]) -> float:
    deliveries = route.get("deliveries")
    if not isinstance(deliveries, list):
        return 0.0
    total = 0.0
    for delivery in deliveries:
        if isinstance(delivery, dict):
            total += _as_float(delivery.get("productAmount"), 0.0)
    return total
', '[{"id": "b7f8fef5-5622-42c8-a545-d4ce4da98613", "name": "acceptDeliverySchedule", "type": "in"}, {"id": "06fa00ec-8022-48a8-89f8-772d361866fc", "name": "acceptDelivery", "type": "in"}, {"id": "f0e5511d-7532-4d2f-9d2e-87ebb7b3adcb", "name": "postDeliveryRoute", "type": "out"}, {"id": "fb4844a9-32ac-4167-ae00-9dfad0becf57", "name": "dailyInventoryCost", "type": "out"}]'::jsonb, '{"style": {"width": 200, "height": 200}, "keyword": [], "position": {"x": 0, "y": 0}, "modelRole": "", "parameters": [{"name": "manufacturer_id", "type": "int", "value": 0}, {"name": "starting_inventory", "type": "float", "value": 0}, {"name": "daily_production", "type": "float", "value": 0}, {"name": "inventory_cost", "type": "float", "value": 0}, {"name": "opening_hour", "type": "int", "value": 0}, {"name": "manufacturer_report_minute", "type": "int", "value": 0}], "modelColors": {}}'::jsonb, '[]'::jsonb, '[]'::jsonb, '2026-05-01 06:55:37.297496+00'::timestamptz, '2026-05-01 06:55:37.297496+00'::timestamptz, NULL
FROM users u
WHERE u.username = 'admin'
ON CONFLICT (id) DO NOTHING;
INSERT INTO models (id, user_id, lib_id, name, type, language, description, code, ports, metadata, connections, components, created_at, updated_at, deleted_at)
SELECT '3f0e2f51-6a81-4f97-b8cc-7fe355c79cc8'::uuid, u.id, 'bd9dd34b-9b4d-4b2d-929b-145b96435eef'::uuid, 'Retailer', 'atomic'::model_type, 'python'::model_language, '', 'from __future__ import annotations

from typing import Any

from modeling import Atomic, RunnableModelCfg, RunnableModelPortCfg, new_atomic_from_cfg

MINUTES_PER_DAY = 24 * 60


class RetailerIRP(Atomic):
    def __init__(self, id: str, name: str, ports=None):
        super().__init__(id=id, name=name, ports=ports)
        self.parameters: dict[str, Any] = {}
        self.current_time: int = 0
        self.next_close_at: int = 16 * 60
        self.current_inventory: float = 0.0
        self.retailer_id: int = 0
        self.min_inventory: float = 0.0
        self.max_inventory: float = 0.0
        self.daily_consumption: float = 0.0
        self.inventory_cost: float = 0.0

    def initialize(self) -> None:
        self.current_time = 0
        self.retailer_id = _as_int(self.parameters.get("retailer_id"), 0)
        self.current_inventory = _as_float(self.parameters.get("starting_inventory"), 0.0)
        self.min_inventory = _as_float(self.parameters.get("min_inventory"), 0.0)
        self.max_inventory = _as_float(self.parameters.get("max_inventory"), 0.0)
        self.daily_consumption = _as_float(self.parameters.get("daily_consumption"), 0.0)
        self.inventory_cost = _as_float(self.parameters.get("inventory_cost"), 0.0)
        closing_hour = _as_int(self.parameters.get("closing_hour"), 16)
        self.next_close_at = closing_hour * 60

    def exit(self) -> None:
        return

    def ta(self) -> float:
        return max(float(self.next_close_at - self.current_time), 0.0)

    def delt_int(self) -> None:
        self.current_time = self.next_close_at

        if self.current_inventory > self.max_inventory:
            print(
                f"Retailer {self.retailer_id} exceeded max inventory: "
                f"current={self.current_inventory} max={self.max_inventory}"
            )

        self.current_inventory -= self.daily_consumption

        if self.current_inventory < self.min_inventory:
            print(
                f"Retailer {self.retailer_id} below min inventory: "
                f"current={self.current_inventory} min={self.min_inventory}"
            )

        self.next_close_at += MINUTES_PER_DAY

    def delt_ext(self, e: float) -> None:
        self.current_time += int(round(e))

        try:
            in_port = self.get_port_by_name("receiveDelivery")
        except KeyError:
            return

        for value in list(in_port.get_values()):
            if not isinstance(value, dict):
                continue
            delivery_retailer_id = _as_int(value.get("retailerId"), -1)
            if delivery_retailer_id != self.retailer_id:
                continue
            self.current_inventory += _as_float(value.get("productAmount"), 0.0)

        in_port.clear()

    def delt_con(self, e: float) -> None:
        self.delt_int()
        self.delt_ext(0.0)

    def lambda_(self) -> None:
        predicted_inventory = self.current_inventory - self.daily_consumption
        payload = {
            "day": _day_from_minute(self.next_close_at),
            "retailerId": self.retailer_id,
            "cost": predicted_inventory * self.inventory_cost,
        }

        try:
            out_port = self.get_port_by_name("dailyInventoryCost")
        except KeyError:
            return
        out_port.add_value(payload)


def NewModel(config: dict) -> Atomic:
    raw_ports = config.get("ports") or []
    ports_cfg = [
        RunnableModelPortCfg(
            id=p["id"],
            name=p.get("name", p["id"]),
            type=p["type"],
        )
        for p in raw_ports
    ]

    cfg = RunnableModelCfg(
        id=config["id"],
        name=config["name"],
        ports=ports_cfg,
    )

    model = new_atomic_from_cfg(cfg, RetailerIRP)
    raw_parameters = config.get("parameters") or []
    model.parameters = {
        p["name"]: p.get("value")
        for p in raw_parameters
        if isinstance(p, dict) and p.get("name")
    }
    return model


def _as_int(value: Any, fallback: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def _as_float(value: Any, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _day_from_minute(minute: int) -> int:
    return minute // MINUTES_PER_DAY + 1
', '[{"id": "c4949da2-30c4-4f6f-9abc-baf508af6e7a", "name": "receiveDelivery", "type": "in"}, {"id": "e8b5a6c0-76bc-4c36-beab-4827251d3d73", "name": "dailyInventoryCost", "type": "out"}]'::jsonb, '{"style": {"width": 200, "height": 200}, "keyword": [], "position": {"x": 0, "y": 0}, "modelRole": "", "parameters": [{"name": "retailer_id", "type": "int", "value": 0}, {"name": "starting_inventory", "type": "float", "value": 0}, {"name": "min_inventory", "type": "float", "value": 0}, {"name": "max_inventory", "type": "float", "value": 0}, {"name": "daily_consumption", "type": "float", "value": 0}, {"name": "inventory_cost", "type": "float", "value": 0}, {"name": "closing_hour", "type": "int", "value": 0}], "modelColors": {}}'::jsonb, '[]'::jsonb, '[]'::jsonb, '2026-05-01 06:55:49.521333+00'::timestamptz, '2026-05-01 06:55:49.521333+00'::timestamptz, NULL
FROM users u
WHERE u.username = 'admin'
ON CONFLICT (id) DO NOTHING;
INSERT INTO models (id, user_id, lib_id, name, type, language, description, code, ports, metadata, connections, components, created_at, updated_at, deleted_at)
SELECT '331408a8-51e6-42b0-9185-f3ca3d4a4fc8'::uuid, u.id, 'bd9dd34b-9b4d-4b2d-929b-145b96435eef'::uuid, 'Transducer', 'atomic'::model_type, 'python'::model_language, '', 'from __future__ import annotations

from typing import Any

from modeling import Atomic, RunnableModelCfg, RunnableModelPortCfg, INFINITY, new_atomic_from_cfg

MINUTES_PER_DAY = 24 * 60


class TransducerIRP(Atomic):
    def __init__(self, id: str, name: str, ports=None):
        super().__init__(id=id, name=name, ports=ports)
        self.parameters: dict[str, Any] = {}
        self.current_time: int = 0
        self.final_time: int = 0
        self.final_computed: bool = False
        self.vehicle_cost_by_day_by_vehicle: dict[int, dict[int, float]] = {}
        self.inventory_cost_by_day_by_retailer: dict[int, dict[int, float]] = {}

    def initialize(self) -> None:
        self.current_time = 0
        last_day = _as_int(self.parameters.get("last_day"), 1)
        if last_day < 0:
            last_day = 0
        self.final_time = last_day * MINUTES_PER_DAY
        self.final_computed = False
        self.vehicle_cost_by_day_by_vehicle = {}
        self.inventory_cost_by_day_by_retailer = {}

    def exit(self) -> None:
        return

    def ta(self) -> float:
        if self.final_computed:
            return INFINITY
        return max(float(self.final_time - self.current_time), 0.0)

    def delt_int(self) -> None:
        self.current_time = self.final_time
        if self.final_computed:
            return

        all_days = sorted(
            set(self.vehicle_cost_by_day_by_vehicle.keys())
            | set(self.inventory_cost_by_day_by_retailer.keys())
        )

        total_vehicle_cost = 0.0
        total_inventory_cost = 0.0

        for day in all_days:
            print(f"Day {day} costs:")

            for vehicle_id, cost in sorted(self.vehicle_cost_by_day_by_vehicle.get(day, {}).items()):
                print(f"Vehicle {vehicle_id}: {cost}")
                total_vehicle_cost += cost

            for retailer_id, cost in sorted(self.inventory_cost_by_day_by_retailer.get(day, {}).items()):
                print(f"Retailer {retailer_id}: {cost}")
                total_inventory_cost += cost

        print(
            "Vehicle costs "
            f"{total_vehicle_cost} + retailer costs {total_inventory_cost} = "
            f"{total_vehicle_cost + total_inventory_cost} total"
        )

        self.final_computed = True

    def delt_ext(self, e: float) -> None:
        self.current_time += int(round(e))

        self._consume_cost_port("aggregateInventoryCost", self._apply_inventory_cost)
        self._consume_cost_port("aggregateVehicleCost", self._apply_vehicle_cost)

    def delt_con(self, e: float) -> None:
        self.delt_int()
        self.delt_ext(0.0)

    def lambda_(self) -> None:
        return

    def _consume_cost_port(self, port_name: str, apply) -> None:
        try:
            in_port = self.get_port_by_name(port_name)
        except KeyError:
            return

        for value in list(in_port.get_values()):
            if isinstance(value, dict):
                apply(value)

        in_port.clear()

    def _apply_inventory_cost(self, payload: dict[str, Any]) -> None:
        day = _day_from_minute(self.current_time)
        retailer_id = _as_int(payload.get("retailerId"), 0)
        cost = _as_float(payload.get("cost"), 0.0)

        self.inventory_cost_by_day_by_retailer.setdefault(day, {})[retailer_id] = cost

    def _apply_vehicle_cost(self, payload: dict[str, Any]) -> None:
        day = _day_from_minute(self.current_time)
        vehicle_id = _as_int(payload.get("vehicleId"), 0)
        cost = _as_float(payload.get("cost"), 0.0)

        self.vehicle_cost_by_day_by_vehicle.setdefault(day, {})[vehicle_id] = cost


def NewModel(config: dict) -> Atomic:
    raw_ports = config.get("ports") or []
    ports_cfg = [
        RunnableModelPortCfg(
            id=p["id"],
            name=p.get("name", p["id"]),
            type=p["type"],
        )
        for p in raw_ports
    ]

    cfg = RunnableModelCfg(
        id=config["id"],
        name=config["name"],
        ports=ports_cfg,
    )

    model = new_atomic_from_cfg(cfg, TransducerIRP)
    raw_parameters = config.get("parameters") or []
    model.parameters = {
        p["name"]: p.get("value")
        for p in raw_parameters
        if isinstance(p, dict) and p.get("name")
    }
    return model


def _day_from_minute(minute: int) -> int:
    if minute < 0:
        return 1
    return minute // MINUTES_PER_DAY + 1


def _as_int(value: Any, fallback: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def _as_float(value: Any, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback
', '[{"id": "3b7131e4-c559-45ac-a47c-853b2fa9deeb", "name": "aggregateInventoryCost", "type": "in"}, {"id": "6804cb3e-9bea-441e-b7dd-0523bdb7ae0d", "name": "aggregateVehicleCost", "type": "in"}]'::jsonb, '{"style": {"width": 200, "height": 200}, "keyword": [], "position": {"x": 0, "y": 0}, "modelRole": "", "parameters": [{"name": "last_day", "type": "int", "value": 0}], "modelColors": {}}'::jsonb, '[]'::jsonb, '[]'::jsonb, '2026-05-01 06:56:02.354477+00'::timestamptz, '2026-05-01 06:56:02.354477+00'::timestamptz, NULL
FROM users u
WHERE u.username = 'admin'
ON CONFLICT (id) DO NOTHING;
INSERT INTO models (id, user_id, lib_id, name, type, language, description, code, ports, metadata, connections, components, created_at, updated_at, deleted_at)
SELECT 'a638d6d9-2611-4526-b638-f03b2043742a'::uuid, u.id, 'bd9dd34b-9b4d-4b2d-929b-145b96435eef'::uuid, 'Vehicle', 'atomic'::model_type, 'python'::model_language, '', 'from __future__ import annotations

import math
from typing import Any

from modeling import Atomic, RunnableModelCfg, RunnableModelPortCfg, INFINITY, new_atomic_from_cfg

MINUTES_PER_DAY = 24 * 60


class VehicleIRP(Atomic):
    def __init__(self, id: str, name: str, ports=None):
        super().__init__(id=id, name=name, ports=ports)
        self.parameters: dict[str, Any] = {}
        self.current_time: int = 0
        self.vehicle_id: int = 0
        self.capacity: float = 0.0
        self.cost_per_km: float = 0.0
        self.speed_km_hr: float = 1.0
        self.minutes_per_delivery: int = 15
        self.closing_hour: int = 16
        self.manufacturer_location: dict[str, float] = {"x": 0.0, "y": 0.0}
        self.location: dict[str, float] = {"x": 0.0, "y": 0.0}
        self.daily_km_traveled: float = 0.0
        self.route: list[dict[str, Any]] = []
        self.next_event: dict[str, Any] | None = None
        self.pending_immediate: list[dict[str, Any]] = []

    def initialize(self) -> None:
        self.current_time = 0
        self.vehicle_id = _as_int(self.parameters.get("vehicle_id"), 0)
        self.capacity = _as_float(self.parameters.get("capacity"), 0.0)
        self.cost_per_km = _as_float(self.parameters.get("cost_per_km"), 0.0)
        self.speed_km_hr = _as_float(self.parameters.get("speed_km_hr"), 1.0)
        self.minutes_per_delivery = _as_int(self.parameters.get("minutes_per_delivery"), 15)
        self.closing_hour = _as_int(self.parameters.get("closing_hour"), 16)

        self.manufacturer_location = {
            "x": _as_float(self.parameters.get("manufacturer_x"), 0.0),
            "y": _as_float(self.parameters.get("manufacturer_y"), 0.0),
        }
        self.location = dict(self.manufacturer_location)

        self.daily_km_traveled = 0.0
        self.route = []
        self.next_event = None
        self.pending_immediate = []

    def exit(self) -> None:
        return

    def ta(self) -> float:
        if self.pending_immediate:
            return 0.0
        if self.next_event is None:
            return INFINITY
        return max(float(self.next_event["time"] - self.current_time), 0.0)

    def delt_int(self) -> None:
        if self.pending_immediate:
            self.pending_immediate = []
            return

        if self.next_event is None:
            self.passivate()
            return

        event = self.next_event
        self.current_time = _as_int(event.get("time"), self.current_time)

        if event.get("kind") == "delivery":
            delivery = event.get("delivery")
            if isinstance(delivery, dict):
                destination = _delivery_location(delivery)
                distance = _distance(self.location, destination)
                self.daily_km_traveled += distance
                self.location = destination
            self._schedule_next_delivery()
            return

        if event.get("kind") == "return":
            distance = _distance(self.location, self.manufacturer_location)
            self.daily_km_traveled += distance
            self.location = dict(self.manufacturer_location)
            self.daily_km_traveled = 0.0
            self.next_event = None

    def delt_ext(self, e: float) -> None:
        self.current_time += int(round(e))

        try:
            in_port = self.get_port_by_name("acceptDeliveryRoute")
        except KeyError:
            return

        for value in list(in_port.get_values()):
            self._handle_accept_delivery_route(value)

        in_port.clear()

    def delt_con(self, e: float) -> None:
        self.delt_int()
        self.delt_ext(0.0)

    def lambda_(self) -> None:
        if self.pending_immediate:
            for payload in self.pending_immediate:
                self._emit("dropDelivery", payload)
            return

        if self.next_event is None:
            return

        if self.next_event.get("kind") == "delivery":
            delivery = self.next_event.get("delivery")
            if isinstance(delivery, dict):
                self._emit("dropDelivery", delivery)
            return

        if self.next_event.get("kind") == "return":
            distance = _distance(self.location, self.manufacturer_location)
            payload = {
                "vehicleId": self.vehicle_id,
                "day": _day_from_minute(_as_int(self.next_event.get("time"), self.current_time)),
                "cost": (self.daily_km_traveled + distance) * self.cost_per_km,
            }
            self._emit("dailyDeliveryCost", payload)

    def _handle_accept_delivery_route(self, raw: Any) -> None:
        if not isinstance(raw, dict):
            return

        incoming_vehicle_id = _as_int(raw.get("vehicleId"), self.vehicle_id)
        if incoming_vehicle_id != self.vehicle_id:
            return

        deliveries_raw = raw.get("deliveries")
        if not isinstance(deliveries_raw, list):
            deliveries_raw = []

        deliveries: list[dict[str, Any]] = []
        total_quantity = 0.0

        for item in deliveries_raw:
            if not isinstance(item, dict):
                continue
            deliveries.append(item)
            total_quantity += _as_float(item.get("productAmount"), 0.0)

        if total_quantity > self.capacity:
            excess = total_quantity - self.capacity
            self.pending_immediate.append(
                {
                    "retailerId": 0,
                    "retailerLocation": dict(self.manufacturer_location),
                    "productAmount": excess,
                }
            )
            self.daily_km_traveled = 0.0

        self.route = deliveries
        self._schedule_next_delivery()

    def _schedule_next_delivery(self) -> None:
        if not self.route:
            self._schedule_return_to_manufacturer(self.current_time)
            return

        next_delivery = self.route.pop(0)
        destination = _delivery_location(next_delivery)
        distance = _distance(self.location, destination)

        speed = self.speed_km_hr if self.speed_km_hr > 0.0 else 1.0
        travel_minutes = int(distance / (speed / 60.0))
        arrival = self.current_time + self.minutes_per_delivery + travel_minutes

        if _hour_part(arrival) < self.closing_hour:
            self.next_event = {
                "time": arrival,
                "kind": "delivery",
                "delivery": next_delivery,
            }
            return

        self._schedule_return_to_manufacturer(self.current_time)

    def _schedule_return_to_manufacturer(self, base_time: int) -> None:
        distance = _distance(self.location, self.manufacturer_location)
        speed = self.speed_km_hr if self.speed_km_hr > 0.0 else 1.0
        travel_minutes = int(distance / (speed / 60.0))
        arrival = base_time + self.minutes_per_delivery + travel_minutes
        self.next_event = {
            "time": arrival,
            "kind": "return",
        }

    def _emit(self, port_name: str, payload: Any) -> None:
        try:
            out_port = self.get_port_by_name(port_name)
        except KeyError:
            return
        out_port.add_value(payload)


def NewModel(config: dict) -> Atomic:
    raw_ports = config.get("ports") or []
    ports_cfg = [
        RunnableModelPortCfg(
            id=p["id"],
            name=p.get("name", p["id"]),
            type=p["type"],
        )
        for p in raw_ports
    ]

    cfg = RunnableModelCfg(
        id=config["id"],
        name=config["name"],
        ports=ports_cfg,
    )

    model = new_atomic_from_cfg(cfg, VehicleIRP)
    raw_parameters = config.get("parameters") or []
    model.parameters = {
        p["name"]: p.get("value")
        for p in raw_parameters
        if isinstance(p, dict) and p.get("name")
    }
    return model


def _delivery_location(delivery: dict[str, Any]) -> dict[str, float]:
    location = delivery.get("retailerLocation")
    if not isinstance(location, dict):
        return {"x": 0.0, "y": 0.0}
    return {
        "x": _as_float(location.get("x"), 0.0),
        "y": _as_float(location.get("y"), 0.0),
    }


def _distance(c1: dict[str, float], c2: dict[str, float]) -> float:
    dx = _as_float(c1.get("x"), 0.0) - _as_float(c2.get("x"), 0.0)
    dy = _as_float(c1.get("y"), 0.0) - _as_float(c2.get("y"), 0.0)
    return math.sqrt(dx * dx + dy * dy)


def _hour_part(minute: int) -> int:
    if minute < 0:
        return 0
    return (minute // 60) % 24


def _day_from_minute(minute: int) -> int:
    if minute < 0:
        return 1
    return minute // MINUTES_PER_DAY + 1


def _as_int(value: Any, fallback: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def _as_float(value: Any, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback
', '[{"id": "8adf1813-a157-4d84-a4ab-ee26f1a5f955", "name": "acceptDeliveryRoute", "type": "in"}, {"id": "6d20f2cd-0c2a-49c5-96b9-328d76c931c1", "name": "dropDelivery", "type": "out"}, {"id": "e9e0d037-9512-4f66-ae1c-80275ae01673", "name": "dailyDeliveryCost", "type": "out"}]'::jsonb, '{"style": {"width": 200, "height": 200}, "keyword": [], "position": {"x": 0, "y": 0}, "modelRole": "", "parameters": [{"name": "vehicle_id", "type": "int", "value": 0}, {"name": "capacity", "type": "float", "value": 0}, {"name": "cost_per_km", "type": "float", "value": 0}, {"name": "speed_km_hr", "type": "float", "value": 0}, {"name": "manufacturer_x", "type": "float", "value": 0}, {"name": "manufacturer_y", "type": "float", "value": 0}, {"name": "minutes_per_delivery", "type": "int", "value": 0}, {"name": "closing_hour", "type": "int", "value": 0}], "modelColors": {}}'::jsonb, '[]'::jsonb, '[]'::jsonb, '2026-05-01 06:56:23.290554+00'::timestamptz, '2026-05-01 06:56:23.290554+00'::timestamptz, NULL
FROM users u
WHERE u.username = 'admin'
ON CONFLICT (id) DO NOTHING;
