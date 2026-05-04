from __future__ import annotations 
 
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

