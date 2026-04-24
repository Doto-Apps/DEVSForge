package com.devsforge.runner;

import com.devsforge.runner.modeling.*;
import com.devsforge.runner.rpc.JsonUtil;
import java.util.logging.Logger;

public class JavaCollector extends Atomic {
    private static final Logger LOGGER = Logger.getLogger(JavaCollector.class.getName());
    private double result;
    private double multiplyFactor;
    private boolean hasResult;

    public JavaCollector(RunnableModel cfg) {
        super(cfg);
        this.result = 0;
        this.multiplyFactor = 2.0;
        this.hasResult = false;
    }

    @Override
    public void initialize() {
        this.hasResult = false;
        passivate();
    }

    @Override
    public void exit() {
    }

    @Override
    public void deltInt() {
        passivate();
    }

    @Override
    public void deltExt(double e) {
        try {
            Port inPort = getPortByName("in");
            String[] values = inPort.getValues();
            if (values != null && values.length > 0) {
                String json = values[0];
                Object obj = JsonUtil.fromJson(json, Object.class);
                if (obj instanceof java.util.Map) {
                    java.util.Map<?, ?> map = (java.util.Map<?, ?>) obj;
                    Object valueObj = map.get("value");
                    if (valueObj instanceof Number) {
                        double inputValue = ((Number) valueObj).doubleValue();
                        this.result = inputValue * this.multiplyFactor;
                        this.hasResult = true;
                        LOGGER.info("JavaCollector: received " + inputValue + ", multiplied by " + this.multiplyFactor + " = " + this.result);
                    }
                }
            }
        } catch (Exception ex) {
            LOGGER.warning("JavaCollector error: " + ex.getMessage());
        }
        passivate();
    }

    @Override
    public void deltCon(double e) {
        deltExt(e);
    }

    @Override
    public void lambda() {
    }
}
