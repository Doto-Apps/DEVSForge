package modeling

import (
	"devsforge/simulator/shared"
	"fmt"
)

type Component interface {
	GetName() string                // returns Component's name.
	Initialize()                    // initializes the component before simulation.
	Exit()                          // performs a set of operations after simulation.
	IsInputEmpty() bool             // returns true if none of the input Ports contains any value.
	AddPorts(ports []Port)          // adds ports.
	setParent(component *Component) // sets one Component as parent of the Component.
	GetParent() *Component          // returns parent Component.
	String() string
	GetId() string                               // returns a string representation of the Component.
	GetPortByName(portName string) (Port, error) // returns a string representation of the Component.
	GetPorts(portType *string) []Port            // returns a string representation of the Component.
	// returns a string representation of the Component.
	// GetPorts() []Port // returns a string representation of the Component.
}

// NewComponent returns a pointer to a structure that complies the Component interface.
func NewComponent(cfg shared.RunnableModel) Component {
	ports := make([]Port, 0)
	for _, port := range cfg.Ports {
		ports = append(ports, NewPort(port.ID, port.ID, string(port.Type), []string{}))
	}
	c := component{name: cfg.Name, id: cfg.ID, parent: nil, ports: ports}
	return &c
}

type component struct {
	id     string
	name   string     // component's name.
	parent *Component // parent Component of the component.
	ports  []Port     // set of input ports. TODO map?
}

func (c *component) GetPortByName(portName string) (Port, error) {
	for _, p := range c.ports {
		if p.GetName() == portName {
			return p, nil
		}
	}
	return nil, fmt.Errorf("Cant find port")
}

func (c *component) GetPorts(portType *string) []Port {
	if portType == nil {
		return c.ports
	}
	ports := make([]Port, 0)
	for _, p := range c.ports {
		if p.GetPortType() == *portType {
			ports = append(ports, p)
		}
	}
	return ports
}

// GetName returns the component's name.
func (c *component) GetName() string {
	return c.name
}

func (c *component) GetId() string {
	return c.id
}

// Initialize performs all the required operations before starting a simulation.
func (c *component) Initialize() {
	panic("This method is abstract and must be implemented")
}

// Exit performs all the required operations to exit after a simulation.
func (c *component) Exit() {
	panic("Components must implement the Exit function to be valid")
}

// IsInputEmpty returns true if none of the input ports has messages.
func (c *component) IsInputEmpty() bool {
	for _, port := range c.ports {
		if port.GetPortType() == "in" && !port.IsEmpty() {
			return false
		}
	}
	return true
}

// AddPorts adds new Port to the Port list of the component.
func (c *component) AddPorts(ports []Port) {
	for _, port := range ports {
		c.ports = append(c.ports, NewPort(port.GetId(), port.GetName(), port.GetPortType(), ""))
	}
}

// setParent sets c as the parent DEVS component of component.
func (c *component) setParent(component *Component) {
	c.parent = component
}

// GetParent returns the parent DEVS component of the component.
func (c *component) GetParent() *Component {
	return c.parent
}

// String returns a string representation of the component.
func (c *component) String() string {
	name := c.name + ": "
	name += "Ports [ "
	for _, port := range c.ports {
		name += port.GetName() + " " + port.GetPortType() + ", "
	}
	return name
}
