from __future__ import annotations 
 
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
