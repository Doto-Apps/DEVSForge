package com.devsforge.runner.modeling;

public class RunnableModelParameter {
    private String name;
    private ParameterType type;
    private Object value;
    private String description;

    public RunnableModelParameter() {
    }

    public RunnableModelParameter(String name, ParameterType type, Object value, String description) {
        this.name = name;
        this.type = type;
        this.value = value;
        this.description = description;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public ParameterType getType() {
        return type;
    }

    public void setType(ParameterType type) {
        this.type = type;
    }

    public Object getValue() {
        return value;
    }

    public void setValue(Object value) {
        this.value = value;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
