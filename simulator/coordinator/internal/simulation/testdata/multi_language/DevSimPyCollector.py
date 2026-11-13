from pypdevs.DEVS import AtomicDEVS
from pypdevs.infinity import INFINITY


class Collector(AtomicDEVS):
    def __init__(self, factor=2):
        super().__init__()
        self.in_port = self.addInPort("in")
        self.out = self.addOutPort("out")
        self.factor = factor
        self.state = {"sigma": INFINITY, "values": []}

    def extTransition(self, inputs):
        values = [{"value": message["value"] * self.factor}
                  for message in inputs.get(self.in_port, [])]
        return {"sigma": 0, "values": values}

    def outputFnc(self):
        return {self.out: self.state["values"]}

    def intTransition(self):
        return {"sigma": INFINITY, "values": []}

    def timeAdvance(self):
        return self.state["sigma"]
