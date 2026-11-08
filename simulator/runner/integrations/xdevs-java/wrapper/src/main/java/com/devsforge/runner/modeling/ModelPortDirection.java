package com.devsforge.runner.modeling;

public enum ModelPortDirection {
    IN("in"),
    OUT("out");

    private final String value;

    ModelPortDirection(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }
}
