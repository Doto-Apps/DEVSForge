package com.devsforge.runner.modeling;

import java.util.List;

public interface ComponentInterface {
    String getName();
    String getId();
    void initialize();
    void exit();
    boolean isInputEmpty();
    void addPorts(List<Port> ports);
    void setParent(Object component);
    Object getParent();
    String toString();
    Port getPortByName(String portName) throws Exception;
    List<Port> getPorts(String portType);
}
