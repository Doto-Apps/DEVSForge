package com.devsforge.runner.modeling;

public interface PortInterface {
    String getName();

    String getId();

    String getPortType();

    int length();

    boolean isEmpty();

    void clear();

    void addValue(Object val);

    void addValues(Object val);

    Object getSingleValue();

    Object getValues();

    void setParent(Object c);

    Object getParent();

    String toString();
}