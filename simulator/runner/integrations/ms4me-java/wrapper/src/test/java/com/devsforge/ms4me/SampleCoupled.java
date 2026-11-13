package com.devsforge.ms4me;

import com.ms4systems.devs.core.message.impl.Port;
import com.ms4systems.devs.core.model.impl.Coupled;

import java.io.Serializable;

/** A coupled model with one SampleGenerator whose "out" is routed to the coupled "out". */
public class SampleCoupled extends Coupled {
    private static final long serialVersionUID = 1L;

    public final SampleGenerator gen = new SampleGenerator();
    public final Port out = addOutputPort("out", Serializable.class);

    public SampleCoupled() {
        super("SampleCoupled");
        addChildModel(gen);
        addCoupling(gen.out, out);
    }
}
