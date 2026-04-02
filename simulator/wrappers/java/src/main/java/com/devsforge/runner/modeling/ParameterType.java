package com.devsforge.runner.modeling;

public enum ParameterType {
    INT("int"),
    FLOAT("float"),
    BOOL("bool"),
    STRING("string"),
    OBJECT("object");

    private final String value;

    ParameterType(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }
}
