import json
import logging

from simulator.wrappers.python.modeling.modeling import (
    Atomic,
    RunnableModelCfg,
    RunnableModelPortCfg,
    new_atomic_from_cfg,
)


class GeneratorIncremental(Atomic):
    def __init__(self, id: str, name: str, ports=None):
        super().__init__(id=id, name=name, ports=ports)
        self.value = 0
        self.color = ""
        self.storage = "base"

    # Initialize est appelée avant la simulation.
    def initialize(self) -> None:
        self.value = 0
        self.storage = "base"
        self.hold_in("active", 1.0)
        logging.info("Pute")

    # Exit est appelée après la simulation.
    def exit(self) -> None:
        # no-op pour l’instant
        pass

    # DeltInt : transition interne
    def delt_int(self) -> None:
        self.value += 1

        if self.value >= 3:
            self.passivate()
            self.storage = "gt 3"
        else:
            self.hold_in("active", 1.0)

    # DeltExt : transition externe
    # Ici, on ignore les inputs et on ajuste juste sigma.
    def delt_ext(self, e: float) -> None:
        self.continue_(e)

    # DeltCon : confluent (interne + externe en même temps).
    # On fait simple : interne prioritaire.
    def delt_con(self, e: float) -> None:
        self.delt_int()

    # Lambda : fonction de sortie
    # Envoie la valeur courante sur le port "out" sous forme JSON.
    def lambda_(self) -> None:
        try:
            out_port = self.get_port_by_name("out")
        except KeyError:
            # Si le modèle n'a pas de port "out" dans le manifest, on ne fait rien
            return

        payload = json.dumps({"value": self.value})
        out_port.add_value(payload)


def NewModel(config: dict) -> Atomic:
    """
    config = JSON de shared.RunnableModel envoyé par le runner.
    On en extrait juste ce qui nous intéresse pour créer l'Atomic Python.
    """
    # Si "ports" vaut None ou n'existe pas → on prend []
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

    return new_atomic_from_cfg(cfg, GeneratorIncremental)
