package com.devsforge.ms4me;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ms4systems.devs.core.message.impl.Port;
import com.ms4systems.devs.core.model.impl.Atomic;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Loads the user's Closure-DEVS class and adapts it to the manifest:
 * instantiates an Atomic, names it after the manifest id,
 * injects the manifest parameters and checks the manifest ports exist on the model.
 */
public final class ModelHost {
    private final Atomic atomic;
    private final Map<String, Port> inputPorts = new LinkedHashMap<>();

    private ModelHost(Atomic atomic) {
        this.atomic = atomic;
        for (Port port : atomic.getInputPorts()) {
            inputPorts.put(port.getName(), port);
        }
    }

    public static ModelHost load(String className, RunnableModel cfg) throws ModelLoadException {
        Object instance = instantiate(className);
        injectParameters(instance, cfg);

        if (!(instance instanceof Atomic)) {
            throw new ModelLoadException(className + " must extend " + Atomic.class.getName()
                    + "; coupled models must be flattened by DEVSForge before execution");
        }
        Atomic atomic = (Atomic) instance;
        if (cfg.id != null && !cfg.id.isEmpty()) {
            atomic.setName(cfg.id);
        }

        ModelHost host = new ModelHost(atomic);
        host.validatePorts(className, cfg);
        return host;
    }

    public Atomic atomic() {
        return atomic;
    }

    /** The model's input port with this exact name, or null. */
    public Port inputPort(String name) {
        return inputPorts.get(name);
    }

    private static Object instantiate(String className) throws ModelLoadException {
        Class<?> cls;
        try {
            cls = Class.forName(className);
        } catch (ClassNotFoundException e) {
            throw new ModelLoadException("model class " + className
                    + " not found (check the package line and the public class name of the model source)", e);
        }
        Constructor<?> ctor;
        try {
            ctor = cls.getDeclaredConstructor();
        } catch (NoSuchMethodException e) {
            throw new ModelLoadException("model class " + className + " needs a no-arg constructor", e);
        }
        try {
            ctor.setAccessible(true);
            return ctor.newInstance();
        } catch (InvocationTargetException e) {
            throw new ModelLoadException("constructor of " + className + " threw: " + e.getCause(), e.getCause());
        } catch (ReflectiveOperationException | RuntimeException e) {
            throw new ModelLoadException("cannot instantiate " + className + ": " + e, e);
        }
    }

    /**
     * Each manifest parameter is applied by name: through a public set&lt;Name&gt;(...) method when the
     * model has one (the MS4 Me / SimulateModel.setValue convention), else straight into the field
     * of that name, searching up the class hierarchy. The value is converted to the target type with Jackson.
     */
    private static void injectParameters(Object model, RunnableModel cfg) throws ModelLoadException {
        if (cfg.parameters == null) {
            return;
        }
        ObjectMapper mapper = new ObjectMapper();
        for (RunnableModel.Parameter parameter : cfg.parameters) {
            if (parameter.name == null || parameter.name.isEmpty()) {
                continue;
            }
            injectParameter(model, parameter, mapper);
        }
    }

    private static void injectParameter(Object model, RunnableModel.Parameter parameter, ObjectMapper mapper)
            throws ModelLoadException {
        String name = parameter.name;
        String setterName = "set" + Character.toUpperCase(name.charAt(0)) + name.substring(1);
        try {
            for (Method method : model.getClass().getMethods()) {
                if (method.getName().equals(setterName) && method.getParameterCount() == 1) {
                    Object converted = mapper.convertValue(parameter.value, method.getParameterTypes()[0]);
                    method.invoke(model, converted);
                    return;
                }
            }
            for (Class<?> cls = model.getClass(); cls != null && cls != Object.class; cls = cls.getSuperclass()) {
                Field field;
                try {
                    field = cls.getDeclaredField(name);
                } catch (NoSuchFieldException e) {
                    continue;
                }
                field.setAccessible(true);
                field.set(model, mapper.convertValue(parameter.value, field.getType()));
                return;
            }
        } catch (InvocationTargetException e) {
            throw new ModelLoadException("parameter '" + name + "': " + setterName + " threw " + e.getCause(), e.getCause());
        } catch (IllegalArgumentException | IllegalAccessException e) {
            throw new ModelLoadException("parameter '" + name + "': cannot apply value " + parameter.value + " ("
                    + e.getMessage() + ")", e);
        }
        throw new ModelLoadException("parameter '" + name + "' has neither a " + setterName
                + "(...) method nor a field named '" + name + "' on " + model.getClass().getName());
    }

    private void validatePorts(String className, RunnableModel cfg) throws ModelLoadException {
        if (cfg.ports == null) {
            return;
        }
        List<String> missing = new ArrayList<>();
        for (RunnableModel.Port port : cfg.ports) {
            boolean input = "in".equals(port.type);
            List<Port> declared = input ? atomic.getInputPorts() : atomic.getOutputPorts();
            if (declared.stream().noneMatch(p -> p.getName().equals(port.name))) {
                missing.add((input ? "input" : "output") + " port '" + port.name + "'");
            }
        }
        if (!missing.isEmpty()) {
            throw new ModelLoadException("model " + className + " does not declare " + String.join(", ", missing)
                    + " (declared inputs: " + names(atomic.getInputPorts()) + ", outputs: "
                    + names(atomic.getOutputPorts()) + ")");
        }
    }

    private static String names(List<Port> ports) {
        return ports.stream().map(Port::getName).collect(Collectors.joining(", ", "[", "]"));
    }
}
