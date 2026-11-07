package com.devsforge.runner.modeling;

import java.util.List;

public class RunnableModel {
    private String id;
    private String name;
    private List<RunnableModelPort> ports;
    private List<RunnableModelParameter> parameters;

    public RunnableModel() {
    }

    public RunnableModel(String id, String name, List<RunnableModelPort> ports, List<RunnableModelParameter> parameters) {
        this.id = id;
        this.name = name;
        this.ports = ports;
        this.parameters = parameters;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public List<RunnableModelPort> getPorts() {
        return ports;
    }

    public void setPorts(List<RunnableModelPort> ports) {
        this.ports = ports;
    }

    public List<RunnableModelParameter> getParameters() {
        return parameters;
    }

    public void setParameters(List<RunnableModelParameter> parameters) {
        this.parameters = parameters;
    }
}
