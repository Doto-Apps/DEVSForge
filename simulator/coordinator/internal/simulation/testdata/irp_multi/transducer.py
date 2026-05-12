from __future__ import annotations 
 
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
