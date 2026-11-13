package com.devsforge.ms4me;

import com.ms4systems.devs.core.message.impl.MessageBag;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ModelHostTest {

    static RunnableModel cfg(String id, String[] ports, RunnableModel.Parameter... parameters) {
        RunnableModel cfg = new RunnableModel();
        cfg.id = id;
        cfg.name = "Sample";
        cfg.ports = new ArrayList<>();
        for (int i = 0; i + 1 < ports.length; i += 2) {
            RunnableModel.Port port = new RunnableModel.Port();
            port.id = ports[i];
            port.name = ports[i];
            port.type = ports[i + 1];
            cfg.ports.add(port);
        }
        cfg.parameters = List.of(parameters);
        return cfg;
    }

    static RunnableModel.Parameter param(String name, String type, Object value) {
        RunnableModel.Parameter parameter = new RunnableModel.Parameter();
        parameter.name = name;
        parameter.type = type;
        parameter.value = value;
        return parameter;
    }

    static final String[] GENERATOR_PORTS = {"stop", "in", "setPeriod", "in", "out", "out"};

    @Test
    void loadsAtomicInjectsParametersAndExposesPorts() throws Exception {
        ModelHost host = ModelHost.load(SampleGenerator.class.getName(),
                cfg("gen-1", GENERATOR_PORTS, param("period", "float", 2.5), param("count", "int", 7)));

        SampleGenerator generator = assertInstanceOf(SampleGenerator.class, host.atomic());
        assertEquals("gen-1", generator.getName());
        assertEquals(2.5, generator.getPeriod(), "setter-based parameter");
        assertEquals(7, generator.getCount(), "field-based parameter");
        generator.initialize();
        assertEquals(2.5, generator.getTimeAdvance());

        assertNotNull(host.inputPort("stop"));
        assertNotNull(host.inputPort("setPeriod"));
        assertNull(host.inputPort("out"), "output ports are not inputs");
        assertNull(host.inputPort("nope"));
    }

    @Test
    void rejectsPortsMissingOnTheModel() {
        ModelLoadException e = assertThrows(ModelLoadException.class, () -> ModelHost.load(
                SampleGenerator.class.getName(), cfg("g", new String[] {"nope", "in", "out", "in"})));
        assertTrue(e.getMessage().contains("input port 'nope'"), e.getMessage());
        assertTrue(e.getMessage().contains("input port 'out'"), e.getMessage());
        assertTrue(e.getMessage().contains("declared inputs: [stop, setPeriod]"), e.getMessage());
    }

    @Test
    void rejectsUnknownParameter() {
        ModelLoadException e = assertThrows(ModelLoadException.class, () -> ModelHost.load(
                SampleGenerator.class.getName(), cfg("g", GENERATOR_PORTS, param("speed", "float", 1))));
        assertTrue(e.getMessage().contains("'speed'"), e.getMessage());
        assertTrue(e.getMessage().contains("setSpeed"), e.getMessage());
    }

    @Test
    void rejectsClassesThatAreNotDevsModels() {
        assertThrows(ModelLoadException.class, () -> ModelHost.load("java.lang.String", cfg("g", new String[0])));
        ModelLoadException e = assertThrows(ModelLoadException.class,
                () -> ModelHost.load("no.such.Model", cfg("g", new String[0])));
        assertTrue(e.getMessage().contains("no.such.Model"), e.getMessage());
    }

    @Test
    void rejectsCoupledModelsBecauseTheCoordinatorFlattensTheSimulation() {
        ModelLoadException e = assertThrows(ModelLoadException.class,
                () -> ModelHost.load(SampleCoupled.class.getName(), cfg("c-1", new String[] {"out", "out"})));
        assertTrue(e.getMessage().contains("flattened"));
    }
}
