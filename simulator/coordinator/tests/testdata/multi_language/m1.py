import json

from modeling import (
    Atomic,
    RunnableModelCfg,
    RunnableModelPortCfg,
    new_atomic_from_cfg,
)


class PythonAdder(Atomic):
    def __init__(self, id: str, name: str, ports=None):
        super().__init__(id=id, name=name, ports=ports)
        self.value = 0
        self.add_value = 10
        self.result = 0
        self.has_result = False

    def initialize(self) -> None:
        self.has_result = False
        self.passivate()

    def exit(self) -> None:
        pass

    def delt_int(self) -> None:
        self.passivate()

    def delt_ext(self, e: float) -> None:
        try:
            in_port = self.get_port_by_name("in")
            values = in_port.get_values()
            if values:
                data = json.loads(values[0])
                input_value = data.get("value", 0)
                self.result = input_value + self.add_value
                self.has_result = True
        except (KeyError, json.JSONDecodeError, IndexError):
            pass
        self.passivate()

    def delt_con(self, e: float) -> None:
        self.delt_ext(e)

    def lambda_(self) -> None:
        if not self.has_result:
            return

        try:
            out_port = self.get_port_by_name("out")
        except KeyError:
            return

        payload = {"value": self.result}
        out_port.add_value(payload)
        self.has_result = False


def NewModel(config: dict) -> Atomic:
    raw_ports = config.get("ports") or []
    ports_cfg = [
        RunnableModelPortCfg(id=p["id"], type=p["type"])
        for p in raw_ports
    ]

    cfg = RunnableModelCfg(
        id=config["id"],
        name=config["name"],
        ports=ports_cfg,
    )

    return new_atomic_from_cfg(cfg, PythonAdder)
