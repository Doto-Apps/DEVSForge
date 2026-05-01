from __future__ import annotations 
 
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
        self.current_inventory = _as_float(self.parameters.get(\"starting_inventory\"), 0.0) 
        self.daily_production = _as_float(self.parameters.get(\"daily_production\"), 0.0) 
        self.inventory_cost = _as_float(self.parameters.get(\"inventory_cost\"), 0.0) 
        self.manufacturer_id = _as_int(self.parameters.get(\"manufacturer_id\"), 0) 
        self.opening_hour = _as_int(self.parameters.get(\"opening_hour\"), 6) 
        self.report_minute = _as_int(self.parameters.get(\"manufacturer_report_minute\"), 1439) 
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
 
        self._consume_input_port(\"acceptDeliverySchedule\", self._handle_accept_delivery_schedule) 
        self._consume_input_port(\"acceptDelivery\", self._handle_accept_delivery) 
 
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
                \"dailyInventoryCost\", 
                { 
                    \"day\": _day_from_minute(next_time), 
                    \"retailerId\": self.manufacturer_id, 
                    \"cost\": predicted_inventory * self.inventory_cost, 
                }, 
            ) 
 
        for route in self.route_events.get(next_time, []): 
            self._emit(\"postDeliveryRoute\", route) 
 
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
        by_day = _as_dict(payload.get(\"deliveriesByDayByVehicle\")) 
 
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
        self.current_inventory += _as_float(delivery.get(\"productAmount\"), 0.0) 
 
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
 
    model = new_atomic_from_cfg(cfg, ManufacturerIRP) 
    raw_parameters = config.get(\"parameters\") or [] 
    model.parameters = { 
        p[\"name\"]: p.get(\"value\") 
        for p in raw_parameters 
        if isinstance(p, dict) and p.get(\"name\") 
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
    deliveries = route.get(\"deliveries\") 
    if not isinstance(deliveries, list): 
        return 0.0 
    total = 0.0 
    for delivery in deliveries: 
        if isinstance(delivery, dict): 
            total += _as_float(delivery.get(\"productAmount\"), 0.0) 
    return total 

