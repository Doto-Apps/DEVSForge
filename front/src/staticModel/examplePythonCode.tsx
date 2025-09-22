export const examplePythonCode: string = `from DomainInterface.DomainBehavior import DomainBehavior
from DomainInterface.Object import Message

class ModelName(DomainBehavior):

    def __init__(self, param1=10, param2="default"):
        
        DomainBehavior.__init__(self)
        self.param1 = param1
        self.param2 = param2
        # Initialize any other required attributes
        self.initPhase('INITIAL_STATE', INFINITY)  # Customizable initial state and duration

    def extTransition(self, *args):
        for port in self.IPorts:
            msg = self.peek(port, *args)
            if msg:
                # State change or action logic based on the message
                current_state = self.getState()  # Example usage of getState()
                pass  # Customize based on intended behavior

    def outputFnc(self):
        # Create and return a structured message for output ports
        return self.poke(self.OPorts[0], Message("Message content", self.timeNext))

    def intTransition(self):
        current_state = self.getState()  # Example usage of getState()
        # Use self.holdIn() to change state or set an internal delay
        pass  # Customize as needed

    def timeAdvance(self):
        return self.getSigma()`;
