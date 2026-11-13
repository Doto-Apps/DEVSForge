package com.devsforge.ms4me;

import com.ms4systems.devs.core.message.impl.Message;
import com.ms4systems.devs.core.message.impl.MessageBag;
import com.ms4systems.devs.core.message.impl.Port;
import com.ms4systems.devs.core.model.impl.Atomic;

import java.io.Serializable;
import java.util.HashMap;
import java.util.Map;

/** Plain Closure-DEVS atomic used by the wrapper tests: emits {"count": n} every period. */
public class SampleGenerator extends Atomic {
    private static final long serialVersionUID = 1L;

    public final Port stop = addInputPort("stop", Serializable.class);
    public final Port setPeriod = addInputPort("setPeriod", Double.class);
    public final Port out = addOutputPort("out", Serializable.class);

    private double period = 1.0;
    private int count;
    private double sigma;

    public SampleGenerator() {
        super("SampleGenerator");
    }

    public void setPeriod(double period) {
        this.period = period;
    }

    public double getPeriod() {
        return period;
    }

    public int getCount() {
        return count;
    }

    @Override
    public void initialize() {
        super.initialize();
        count = 0;
        sigma = period;
    }

    @Override
    public void internalTransition() {
        count++;
        sigma = period;
    }

    @Override
    public void externalTransition(double timeElapsed, MessageBag input) {
        sigma -= timeElapsed;
        for (Message message : input.getMessages(setPeriod)) {
            period = (Double) message.getData();
            sigma = period;
        }
        if (!input.getMessages(stop).isEmpty()) {
            sigma = Double.POSITIVE_INFINITY;
        }
    }

    @Override
    public MessageBag getOutput() {
        MessageBag output = new MessageBag();
        Map<String, Object> payload = new HashMap<>();
        payload.put("count", count);
        output.add(out, payload);
        return output;
    }

    @Override
    public Double getTimeAdvance() {
        return sigma;
    }
}
