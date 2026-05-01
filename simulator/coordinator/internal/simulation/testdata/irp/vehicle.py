from __future__ import annotations 
 
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
        self.manufacturer_location: dict[str, float] = {\"x\": 0.0, \"y\": 0.0} 
        self.location: dict[str, float] = {\"x\": 0.0, \"y\": 0.0} 
        self.daily_km_traveled: float = 0.0 
        self.route: list[dict[str, Any]] = [] 
        self.next_event: dict[str, Any] | None = None 
        self.pending_immediate: list[dict[str, Any]] = [] 
 
    def initialize(self) -> None: 
        self.current_time = 0 
        self.vehicle_id = _as_int(self.parameters.get(\"vehicle_id\"), 0) 
        self.capacity = _as_float(self.parameters.get(\"capacity\"), 0.0) 
        self.cost_per_km = _as_float(self.parameters.get(\"cost_per_km\"), 0.0) 
        self.speed_km_hr = _as_float(self.parameters.get(\"speed_km_hr\"), 1.0) 
        self.minutes_per_delivery = _as_int(self.parameters.get(\"minutes_per_delivery\"), 15) 
        self.closing_hour = _as_int(self.parameters.get(\"closing_hour\"), 16) 
 
        self.manufacturer_location = { 
            \"x\": _as_float(self.parameters.get(\"manufacturer_x\"), 0.0), 
            \"y\": _as_float(self.parameters.get(\"manufacturer_y\"), 0.0), 
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
        return max(float(self.next_event[\"time\"] - self.current_time), 0.0) 
 
    def delt_int(self) -> None: 
        if self.pending_immediate: 
            self.pending_immediate = [] 
            return 
 
        if self.next_event is None: 
            self.passivate() 
            return 
 
        event = self.next_event 
        self.current_time = _as_int(event.get(\"time\"), self.current_time) 
 
        if event.get(\"kind\") == \"delivery\": 
            delivery = event.get(\"delivery\") 
            if isinstance(delivery, dict): 
                destination = _delivery_location(delivery) 
                distance = _distance(self.location, destination) 
                self.daily_km_traveled += distance 
                self.location = destination 
            self._schedule_next_delivery() 
            return 
 
        if event.get(\"kind\") == \"return\": 
            distance = _distance(self.location, self.manufacturer_location) 
            self.daily_km_traveled += distance 
            self.location = dict(self.manufacturer_location) 
            self.daily_km_traveled = 0.0 
            self.next_event = None 
 
    def delt_ext(self, e: float) -> None: 
        self.current_time += int(round(e)) 
 
        try: 
            in_port = self.get_port_by_name(\"acceptDeliveryRoute\") 
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
                self._emit(\"dropDelivery\", payload) 
            return 
 
        if self.next_event is None: 
            return 
 
        if self.next_event.get(\"kind\") == \"delivery\": 
            delivery = self.next_event.get(\"delivery\") 
            if isinstance(delivery, dict): 
                self._emit(\"dropDelivery\", delivery) 
            return 
 
        if self.next_event.get(\"kind\") == \"return\": 
            distance = _distance(self.location, self.manufacturer_location) 
            payload = { 
                \"vehicleId\": self.vehicle_id, 
                \"day\": _day_from_minute(_as_int(self.next_event.get(\"time\"), self.current_time)), 
                \"cost\": (self.daily_km_traveled + distance) * self.cost_per_km, 
            } 
            self._emit(\"dailyDeliveryCost\", payload) 
 
    def _handle_accept_delivery_route(self, raw: Any) -> None: 
        if not isinstance(raw, dict): 
            return 
 
        incoming_vehicle_id = _as_int(raw.get(\"vehicleId\"), self.vehicle_id) 
        if incoming_vehicle_id != self.vehicle_id: 
            return 
 
        deliveries_raw = raw.get(\"deliveries\") 
        if not isinstance(deliveries_raw, list): 
            deliveries_raw = [] 
 
        deliveries: list[dict[str, Any]] = [] 
        total_quantity = 0.0 
 
        for item in deliveries_raw: 
            if not isinstance(item, dict): 
                continue 
            deliveries.append(item) 
            total_quantity += _as_float(item.get(\"productAmount\"), 0.0) 
 
        if total_quantity > self.capacity: 
            excess = total_quantity - self.capacity 
            self.pending_immediate.append( 
                { 
                    \"retailerId\": 0, 
                    \"retailerLocation\": dict(self.manufacturer_location), 
                    \"productAmount\": excess, 
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
                \"time\": arrival, 
                \"kind\": \"delivery\", 
                \"delivery\": next_delivery, 
            } 
            return 
 
        self._schedule_return_to_manufacturer(self.current_time) 
 
    def _schedule_return_to_manufacturer(self, base_time: int) -> None: 
        distance = _distance(self.location, self.manufacturer_location) 
        speed = self.speed_km_hr if self.speed_km_hr > 0.0 else 1.0 
        travel_minutes = int(distance / (speed / 60.0)) 
        arrival = base_time + self.minutes_per_delivery + travel_minutes 
        self.next_event = { 
            \"time\": arrival, 
            \"kind\": \"return\", 
        } 
 
    def _emit(self, port_name: str, payload: Any) -> None: 
        try: 
            out_port = self.get_port_by_name(port_name) 
        except KeyError: 
            return 
        out_port.add_value(payload) 
 
 
def NewModel(config: dict) -> Atomic: 
    raw_ports = config.get(\"ports\") or [] 
    ports_cfg = [ 
        RunnableModelPortCfg( 
            id=p[\"id\"], 
            name=p.get(\"name\", p[\"id\"]), 
            type=p[\"type\"], 
        ) 
        for p in raw_ports 
    ] 
 
    cfg = RunnableModelCfg( 
        id=config[\"id\"], 
        name=config[\"name\"], 
        ports=ports_cfg, 
    ) 
 
    model = new_atomic_from_cfg(cfg, VehicleIRP) 
    raw_parameters = config.get(\"parameters\") or [] 
    model.parameters = { 
        p[\"name\"]: p.get(\"value\") 
        for p in raw_parameters 
        if isinstance(p, dict) and p.get(\"name\") 
    } 
    return model 
 
 
def _delivery_location(delivery: dict[str, Any]) -> dict[str, float]: 
    location = delivery.get(\"retailerLocation\") 
    if not isinstance(location, dict): 
        return {\"x\": 0.0, \"y\": 0.0} 
    return { 
        \"x\": _as_float(location.get(\"x\"), 0.0), 
        \"y\": _as_float(location.get(\"y\"), 0.0), 
    } 
 
 
def _distance(c1: dict[str, float], c2: dict[str, float]) -> float: 
    dx = _as_float(c1.get(\"x\"), 0.0) - _as_float(c2.get(\"x\"), 0.0) 
    dy = _as_float(c1.get(\"y\"), 0.0) - _as_float(c2.get(\"y\"), 0.0) 
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

