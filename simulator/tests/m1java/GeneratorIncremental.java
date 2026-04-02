package com.devsforge.runner;

import com.devsforge.runner.modeling.*;
import com.devsforge.runner.rpc.JsonUtil;
import java.util.HashMap;
import java.util.Map;

public class GeneratorIncremental extends Atomic {
    private int value;
    private String color;
    private String storage;

    public GeneratorIncremental(RunnableModel cfg) {
        super(cfg);
        this.value = 0;
        this.color = "";
        this.storage = "";
    }

    @Override
    public void initialize() {
        this.value = 0;
        this.storage = "base";
        holdIn("active", 1.0);
    }

    @Override
    public void exit() {
        // no-op for now
    }

    @Override
    public void deltInt() {
        this.value++;

        if (this.value >= 3) {
            passivate();
            this.storage = "gt 3";
        } else {
            holdIn("active", 1.0);
        }
    }

    @Override
    public void deltExt(double e) {
        continueSim(e);
    }

    @Override
    public void deltCon(double e) {
        deltInt();
    }

    @Override
    public void lambda() {
        try {
            Port outPort = getPortByName("out");
            Map<String, Object> payload = new HashMap<>();
            payload.put("value", this.value);
            String json = JsonUtil.toJson(payload);
            outPort.addValue(json);
        } catch (Exception e) {
            // ignore
        }
    }
}
