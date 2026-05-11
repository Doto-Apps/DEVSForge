package com.devsforge.runner.modeling;

public class RunnableModelPort {
    private String id;
    private String name;
    private String type;

    public RunnableModelPort() {
    }

    public RunnableModelPort(String id, String name, ModelPortDirection type) {
        this.id = id;
        this.name = name;
        this.type = type != null ? type.getValue() : null;
    }

    public RunnableModelPort(String id, String name, String type) {
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
        if (this.type == null) {
            return null;
        }
        return "in".equals(this.type) ? ModelPortDirection.IN : ModelPortDirection.OUT;
    }

    public void setType(String type) {
        this.type = type;
    }

    public void setType(ModelPortDirection type) {
        this.type = type != null ? type.getValue() : null;
    }
}
