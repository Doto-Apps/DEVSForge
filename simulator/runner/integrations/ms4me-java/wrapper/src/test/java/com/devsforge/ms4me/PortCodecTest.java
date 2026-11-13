package com.devsforge.ms4me;

import org.junit.jupiter.api.Test;

import java.io.Serializable;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import com.fasterxml.jackson.core.JsonProcessingException;

class PortCodecTest {
    private final PortCodec codec = new PortCodec();

    public static class Job {
        public int id;
        public String kind;
    }

    /** No Jackson-visible properties: reject rather than silently losing structure. */
    public static class Opaque {
        @Override
        public String toString() {
            return "opaque-42";
        }
    }

    @Test
    void decodesGenericShapesForSerializablePorts() throws Exception {
        Object map = codec.decode("{\"value\": 5, \"tags\": [\"a\"]}", Serializable.class);
        assertInstanceOf(Map.class, map);
        assertEquals(5, ((Map<?, ?>) map).get("value"));
        assertInstanceOf(List.class, ((Map<?, ?>) map).get("tags"));

        assertEquals(5, codec.decode("5", Object.class));
        assertEquals(2.5, codec.decode("2.5", null));
        assertEquals("hi", codec.decode("\"hi\"", Serializable.class));
        assertEquals(Boolean.TRUE, codec.decode("true", Serializable.class));
    }

    @Test
    void decodesTypedPorts() throws Exception {
        assertEquals(3.0, codec.decode("3", Double.class));
        assertEquals(7, codec.decode("7", int.class));
        Job job = (Job) codec.decode("{\"id\": 1, \"kind\": \"x\", \"extra\": true}", Job.class);
        assertEquals(1, job.id);
        assertEquals("x", job.kind);
    }

    @Test
    void encodesValuesAndRejectsUnsupportedObjects() throws Exception {
        assertEquals("{\"count\":3}", codec.encode(Map.of("count", 3)));
        assertEquals("[1,2]", codec.encode(List.of(1, 2)));
        assertEquals("\"s\"", codec.encode("s"));
        assertEquals("null", codec.encode(null));
        assertThrows(JsonProcessingException.class, () -> codec.encode(new Opaque()));
    }

    @Test
    void genericDetection() {
        assertTrue(PortCodec.isGeneric(Serializable.class));
        assertTrue(PortCodec.isGeneric(Object.class));
        assertTrue(PortCodec.isGeneric(Comparable.class));
        assertTrue(!PortCodec.isGeneric(Map.class));
        assertTrue(!PortCodec.isGeneric(List.class));
        assertTrue(!PortCodec.isGeneric(Number.class));
        assertTrue(!PortCodec.isGeneric(Job.class));
    }
}
