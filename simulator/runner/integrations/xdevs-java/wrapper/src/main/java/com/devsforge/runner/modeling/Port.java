package com.devsforge.runner.modeling;

import java.util.ArrayList;
import java.util.List;

public class Port implements PortInterface {
    private String id;
    private String portType;
    private String name;
    private Object parent;
    private List<Object> values;

    public Port(String id, String name, String portType, List<Object> values) {
        this.id = id;
        this.name = name;
        this.portType = portType;
        this.values = values != null ? values : new ArrayList<>();
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
    public String getPortType() {
        return portType;
    }

    @Override
    public int length() {
        return values.size();
    }

    @Override
    public boolean isEmpty() {
        return values.isEmpty();
    }

    @Override
    public void clear() {
        values.clear();
    }

    @Override
    public void addValue(Object val) {
        values.add(val);
    }

    @Override
    public void addValues(Object val) {
        if (val instanceof List<?>) {
            values.addAll((List<?>) val);
        } else if (val.getClass().isArray()) {
            Object[] array = (Object[]) val;
            for (Object item : array) {
                values.add(item);
            }
        }
    }

    @Override
    public Object getSingleValue() {
        if (values.isEmpty()) {
            throw new IllegalStateException("Port is empty");
        }
        return values.get(0);
    }

    @Override
    public Object getValues() {
        return values;
    }

    @Override
    public void setParent(Object c) {
        this.parent = c;
    }

    @Override
    public Object getParent() {
        return parent;
    }

    @Override
    public String toString() {
        return "{\"Name\": \"" + name + "\", \"Values\": " + values + "}";
    }
}
