package com.devsforge.runner;

import com.devsforge.runner.modeling.*;
import com.devsforge.runner.rpc.JsonUtil;
import java.util.List;
import java.util.Map;
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
            List<Object> values = (List<Object>) inPort.getValues();
            if (values != null && !values.isEmpty()) {
                String json = JsonUtil.toJson(values.get(0));
                Object obj = JsonUtil.fromJson(json, Object.class);
                if (obj instanceof java.util.Map) {
                    java.util.Map<?, ?> map = (java.util.Map<?, ?>) obj;
                    Object valueObj = map.get("value");
                    if (valueObj instanceof Number) {
                        double inputValue = ((Number) valueObj).doubleValue();
                        this.result = inputValue * this.multiplyFactor;
                        this.hasResult = true;
                        LOGGER.info("JavaCollector: received " + inputValue + ", multiplied by " + this.multiplyFactor
                                + " = " + this.result);
                    }
                }
            }
        } catch (Exception ex) {
            LOGGER.warning("JavaCollector error: " + ex.getMessage());
        }
        this.holdIn(Constants.ACTIVE, 0);
    }

    @Override
    public void deltCon(double e) {
        deltExt(e);
    }

    @Override
    public void lambda() {
        if (!this.hasResult) {
            return;
        }
        try {
            Port outPort = this.getPortByName("out");
            Map<String, Object> payload = new java.util.HashMap<>();
            payload.put("value", this.result);
            outPort.addValue(payload);
        } catch (Exception ex) {
            LOGGER.warning("JavaCollector lambda() error: " + ex.getMessage());
        }
    }
}
