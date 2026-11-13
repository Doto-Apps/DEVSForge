from pypdevs.DEVS import AtomicDEVS
from pypdevs.infinity import INFINITY


class Source(AtomicDEVS):
    def __init__(self):
        super().__init__()
        self.out = self.addOutPort("out")
        self.state = True

    def timeAdvance(self):
        return 0 if self.state else INFINITY

    def outputFnc(self):
        return {self.out: [{"value": 2}, {"value": 2}, [4, 5]]}

    def intTransition(self):
        return False
