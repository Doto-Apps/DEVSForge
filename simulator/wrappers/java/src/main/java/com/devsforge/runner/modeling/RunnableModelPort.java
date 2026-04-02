package com.devsforge.runner.modeling;

public class RunnableModelPort {
    private String id;
    private String name;
    private ModelPortDirection type;

    public RunnableModelPort() {
    }

    public RunnableModelPort(String id, String name, ModelPortDirection type) {
        this.id = id;
        this.name = name;
        this.type = type;
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

    public ModelPortDirection getType() {
        return type;
    }

    public void setType(ModelPortDirection type) {
        this.type = type;
    }
}
