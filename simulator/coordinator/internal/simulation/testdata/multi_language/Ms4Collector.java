package example.ms4;

import com.ms4systems.devs.core.model.impl.Atomic;
import com.ms4systems.devs.core.message.impl.Message;
import com.ms4systems.devs.core.message.impl.MessageBag;
import com.ms4systems.devs.core.message.impl.Port;
import java.io.Serializable;
import java.util.Map;

// Runs after the xDEVS Go -> Python -> Java chain. Tests a second Java framework,
// per-instance parameter injection, JSON interoperability and zero-delay output.
public class Ms4Collector extends Atomic {
    public final Port in = addInputPort("in", Serializable.class);
    public final Port out = addOutputPort("out", Serializable.class);
    private double factor = 1.0;
    private double value;
    private double sigma;

    public Ms4Collector() { super("Ms4Collector"); }

    @Override
    public void initialize() {
        super.initialize();
        value = 0;
        sigma = Double.POSITIVE_INFINITY;
    }

    @Override
    public Double getTimeAdvance() { return sigma; }

    @Override
    public void internalTransition() { sigma = Double.POSITIVE_INFINITY; }

    @Override
    public void externalTransition(double elapsed, MessageBag input) {
        for (Message message : input.getMessages(in)) {
            Map<?, ?> payload = (Map<?, ?>) message.getData();
            value = ((Number) payload.get("value")).doubleValue() * factor;
            sigma = 0;
        }
    }

    @Override
    public void confluentTransition(MessageBag input) {
        internalTransition();
        externalTransition(0, input);
    }

    @Override
    public MessageBag getOutput() {
        MessageBag output = new MessageBag();
        output.add(out, Map.of("value", value));
        return output;
    }
}
