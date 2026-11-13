package com.devsforge.ms4me;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.Serializable;
import java.lang.reflect.Modifier;
import java.util.Collection;
import java.util.Map;

/**
 * JSON to port value and back.
 *
 * Inputs are decoded to the port's declared class when it is concrete enough for Jackson
 * (POJO, Map, List, Number, String, Boolean); for Serializable/Object ports they become the
 * generic JSON shapes (Map, List, Integer/Long/Double, String, Boolean, null).
 * Outputs must be JSON-serializable; unsupported values fail explicitly.
 */
public final class PortCodec {
    private final ObjectMapper mapper = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    public ObjectMapper mapper() {
        return mapper;
    }

    public Object decode(String json, Class<?> portType) throws IOException {
        Class<?> target = isGeneric(portType) ? Object.class : portType;
        return mapper.readValue(json, target);
    }

    public String encode(Object value) throws JsonProcessingException {
        return mapper.writeValueAsString(value);
    }

    /** True when the declared port type carries no usable shape for Jackson. */
    static boolean isGeneric(Class<?> type) {
        if (type == null || type == Object.class || type == Serializable.class) {
            return true;
        }
        if (Map.class.isAssignableFrom(type) || Collection.class.isAssignableFrom(type)
                || Number.class.isAssignableFrom(type) || type == String.class || type == Boolean.class
                || type.isPrimitive()) {
            return false;
        }
        return type.isInterface() || Modifier.isAbstract(type.getModifiers());
    }
}
