package com.devsforge.runner.modeling;

import java.util.List;
import java.util.ArrayList;

public class Component implements ComponentInterface {
    protected String id;
    protected String name;
    protected Object parent;
    protected List<Port> ports;

    public Component(RunnableModel cfg) {
        this.id = cfg.getId();
        this.name = cfg.getName();
        this.parent = null;
        this.ports = new ArrayList<>();
        if (cfg.getPorts() != null) {
            for (RunnableModelPort port : cfg.getPorts()) {
                this.ports.add(new Port(port.getId(), port.getName(), port.getType().getValue(), new ArrayList<>()));
            }
        }
    }

    @Override
    public String getName() {
        return name;
    }

    @Override
    public String getId() {
        return id;
    }

    @Override
    public void initialize() {
        throw new UnsupportedOperationException("This method is abstract and must be implemented");
    }

    @Override
    public void exit() {
        throw new UnsupportedOperationException("Components must implement the Exit function to be valid");
    }

    @Override
    public boolean isInputEmpty() {
        for (Port port : ports) {
            if (port.getPortType().equals("in") && !port.isEmpty()) {
                return false;
            }
        }
        return true;
    }

    @Override
    public void addPorts(List<Port> ports) {
        for (Port port : ports) {
            this.ports.add(new Port(port.getId(), port.getName(), port.getPortType(), new ArrayList<>()));
        }
    }

    @Override
    public void setParent(Object component) {
        this.parent = component;
    }

    @Override
    public Object getParent() {
        return parent;
    }

    @Override
    public Port getPortByName(String portName) throws Exception {
        for (Port p : ports) {
            if (p.getName().equals(portName)) {
                return p;
            }
        }
        throw new Exception("Cannot find port");
    }

    @Override
    public List<Port> getPorts(String portType) {
        if (portType == null) {
            return ports;
        }
        List<Port> filteredPorts = new ArrayList<>();
        for (Port p : ports) {
            if (p.getPortType().equals(portType)) {
                filteredPorts.add(p);
            }
        }
        return filteredPorts;
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        sb.append(name).append(": Ports [ ");
        for (Port port : ports) {
            sb.append(port.getName()).append(" ").append(port.getPortType()).append(", ");
        }
        return sb.toString();
    }
}
