package com.devsforge.ms4me;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.ArrayList;
import java.util.List;

/** The manifest entry the runner passes with --json (same shape as the Java wrapper's RunnableModel). */
@JsonIgnoreProperties(ignoreUnknown = true)
public class RunnableModel {
    public String id;
    public String name;
    public List<Port> ports = new ArrayList<>();
    public List<Parameter> parameters = new ArrayList<>();

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Port {
        public String id;
        public String name;
        /** "in" or "out". */
        public String type;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Parameter {
        public String name;
        /** int, float, bool, string or object. */
        public String type;
        public Object value;
        public String description;
    }
}
