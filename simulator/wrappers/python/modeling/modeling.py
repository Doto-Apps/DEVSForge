from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Optional
import json

# Équivalents de util.PASSIVE / util.ACTIVE / util.INFINITY
PASSIVE = "passive"
ACTIVE = "active"
INFINITY = float("inf")


# =========================
# Ports
# =========================

@dataclass
class Port:
    """
    Équivalent de struct port en Go.

    - id: identifiant interne du port (ID du modèle / DSL)
    - name: nom logique du port
    - port_type: "in" ou "out"
    - values: liste des valeurs stockées (List[Any])
    """
    id: str
    name: str
    port_type: str  # "in" / "out"
    parent: Optional["Component"] = None
    values: List[Any] = field(default_factory=list)

    # --- API équivalente à Port interface (Go) ---

    def get_name(self) -> str:
        return self.name

    def get_id(self) -> str:
        return self.id

    def get_port_type(self) -> str:
        return self.port_type

    def length(self) -> int:
        return len(self.values)

    def is_empty(self) -> bool:
        return self.length() == 0

    def clear(self) -> None:
        self.values.clear()

    def add_value(self, val: Any) -> None:
        self.values.append(val)

    def add_values(self, vals: Iterable[Any]) -> None:
        self.values.extend(list(vals))

    def get_single_value(self) -> Any:
        return self.values[0]

    def get_values(self) -> List[Any]:
        # comme GetValues() interface{} → ici on renvoie la liste (copie légère)
        return list(self.values)

    def set_parent(self, c: "Component") -> None:
        self.parent = c

    def get_parent(self) -> Optional["Component"]:
        return self.parent

    def __str__(self) -> str:
        """
        Même style que port.String() en Go :
        {
          "Name": "<name>",
          "Values": [...]
        }
        """
        tmp = {
            "Name": self.name,
            "Values": self.values,
        }
        try:
            return json.dumps(tmp, default=str)
        except TypeError:
            # fallback en cas d'objet non sérialisable
            return f'{{"Name": {self.name!r}, "Values": {self.values!r}}}'


# =========================
# Component
# =========================

class Component(ABC):
    """
    Équivalent de l'interface Component Go + struct component.
    """

    def __init__(self, id: str, name: str, ports: Iterable[Port] | None = None) -> None:
        self._id = id
        self._name = name
        self._parent: Optional["Component"] = None
        # Ports indexés par leur name
        self._ports: Dict[str, Port] = {}
        if ports:
            self.add_ports(list(ports))

    # --- API similaire à ton interface Go ---

    def get_name(self) -> str:
        return self._name

    def get_id(self) -> str:
        return self._id

    @abstractmethod
    def initialize(self) -> None:
        """
        Équivalent de Component.Initialize() en Go.
        """
        ...

    @abstractmethod
    def exit(self) -> None:
        """
        Équivalent de Component.Exit() en Go.
        """
        ...

    def is_input_empty(self) -> bool:
        """
        Retourne True si aucun port d'entrée ("in") ne contient de valeur.
        Équivalent de IsInputEmpty() en Go.
        """
        for p in self._ports.values():
            if p.get_port_type() == "in" and not p.is_empty():
                return False
        return True

    def add_ports(self, ports: Iterable[Port]) -> None:
        """
        Équivalent de AddPorts([]Port) en Go.

        On clone les ports en recréant un Port avec même id / name / type,
        mais une liste de valeurs vide, comme NewPort(..., make([]interface{}, 0)).
        """
        for p in ports:
            cloned = Port(
                id=p.get_id(),
                name=p.get_name(),
                port_type=p.get_port_type(),
                values=[],
            )
            self.add_port(cloned)

    def add_port(self, port: Port) -> None:
        port.set_parent(self)
        self._ports[port.get_name()] = port

    def get_port_by_name(self, port_name: str) -> Port:
        try:
            return self._ports[port_name]
        except KeyError:
            raise KeyError(
                f"Port '{port_name}' not found on component '{self._name}'"
            )

    def get_ports(self, port_type: Optional[str] = None) -> List[Port]:
        """
        Équivalent de GetPorts(portType *string) []Port en Go.
        - port_type is None ⇒ tous les ports
        - sinon, seulement ceux dont p.get_port_type() == port_type
        """
        if port_type is None:
            return list(self._ports.values())
        return [p for p in self._ports.values() if p.get_port_type() == port_type]

    # gestion du parent (couplage hiérarchique)

    def set_parent(self, component: "Component") -> None:
        self._parent = component

    def get_parent(self) -> Optional["Component"]:
        return self._parent

    def __str__(self) -> str:
        ports_desc = ", ".join(
            f"{p.get_name()} {p.get_port_type()}" for p in self._ports.values()
        )
        return f"{self._name}: Ports [ {ports_desc} ]"


# =========================
# Atomic
# =========================

class Atomic(Component, ABC):
    """
    Équivalent de type atomic struct + interface Atomic en Go.
    """

    def __init__(self, id: str, name: str, ports: Iterable[Port] | None = None) -> None:
        super().__init__(id=id, name=name, ports=ports)
        self._phase: str = PASSIVE
        self._sigma: float = INFINITY

    # --- Fonctions DEVS de base ---

    def ta(self) -> float:
        """Time advance (TA): retourne sigma."""
        return self._sigma

    @abstractmethod
    def delt_int(self) -> None:
        ...

    @abstractmethod
    def delt_ext(self, e: float) -> None:
        ...

    @abstractmethod
    def delt_con(self, e: float) -> None:
        ...

    @abstractmethod
    def lambda_(self) -> None:
        ...

    # --- Helpers DEVS comme dans atomic.go ---

    def hold_in(self, phase: str, sigma: float) -> None:
        self._phase = phase
        self.set_sigma(sigma)

    def activate(self) -> None:
        self._phase = ACTIVE
        self._sigma = 0.0

    def activate_in(self, phase: str) -> None:
        self._phase = phase
        self._sigma = 0.0

    def passivate(self) -> None:
        self._phase = PASSIVE
        self._sigma = INFINITY

    def passivate_in(self, phase: str) -> None:
        self._phase = phase
        self._sigma = INFINITY

    def continue_(self, e: float) -> None:
        self.set_sigma(self._sigma - e)

    def phase_is(self, phase: str) -> bool:
        return self._phase == phase

    def get_phase(self) -> str:
        return self._phase

    def set_phase(self, phase: str) -> None:
        self._phase = phase

    def get_sigma(self) -> float:
        return self._sigma

    def set_sigma(self, sigma: float) -> None:
        if sigma < 0:
            sigma = 0.0
        self._sigma = sigma

    def show_state(self) -> str:
        return f"{self.get_name()} [\tstate: {self._phase}\tsigma: {self._sigma:.6f} ]"


# =========================
# RunnableModel côté Python
# (équivalent léger de shared.RunnableModel)
# =========================

@dataclass
class RunnableModelPortCfg:
    id: str        # ID unique du port
    name: str      # Nom du port (utilisé par get_port_by_name)
    type: str      # "in" / "out"


@dataclass
class RunnableModelCfg:
    id: str
    name: str
    ports: List[RunnableModelPortCfg]


def new_atomic_from_cfg(cfg: RunnableModelCfg, atomic_cls: type[Atomic]) -> Atomic:
    """
    Équivalent de NewAtomic(cfg) côté Python :
    - crée les Ports à partir du cfg
    - instancie la classe Atomic avec id/name/ports.
    """
    ports = [
        Port(id=p.id, name=p.name, port_type=p.type, values=[])
        for p in cfg.ports
    ]
    return atomic_cls(id=cfg.id, name=cfg.name, ports=ports)
