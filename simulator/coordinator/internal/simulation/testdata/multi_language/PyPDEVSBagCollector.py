from pypdevs.DEVS import AtomicDEVS
from pypdevs.infinity import INFINITY


class Collector(AtomicDEVS):
    def __init__(self):
        super().__init__()
        self.in_port = self.addInPort("in")
        self.out = self.addOutPort("out")
        self.state = {"sigma": INFINITY, "calls": 0, "values": []}

    def extTransition(self, inputs):
        return {"sigma": 0, "calls": self.state["calls"] + 1,
                "values": list(inputs.get(self.in_port, []))}

    def outputFnc(self):
        return {self.out: [{"calls": self.state["calls"], "values": self.state["values"]}]}

    def intTransition(self):
        return {**self.state, "sigma": INFINITY}

    def timeAdvance(self):
        return self.state["sigma"]
