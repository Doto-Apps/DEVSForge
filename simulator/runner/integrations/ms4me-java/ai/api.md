# API reference: bundled MS4 Me / Closure-DEVS 1.0.0

These signatures were checked against the bundled JAR with `javap`. This is a reference for generation, not a replacement implementation or a source JAR. The same binary is used for execution and JDT LS analysis.

```java
// com.ms4systems.devs.core.model.impl.Atomic
public class Atomic extends DEVS {
    public double elapsedTime;
    public MessageBag inputBag;
    public Atomic();
    public Atomic(String name);
    public void initialize();
    public void internalTransition();
    public void externalTransition(double elapsed, MessageBag input);
    public void confluentTransition(MessageBag input);
    public Double getTimeAdvance();
    public MessageBag getOutput();
}

// Selected methods inherited from com.ms4systems.devs.core.model.impl.DEVS
public Port addInputPort(String name, Class type);
public Port addOutputPort(String name, Class type);
public Port getInputPort(String name);
public Port getOutputPort(String name);
public ArrayList<Port> getInputPorts();
public ArrayList<Port> getOutputPorts();
public String getName();
public void setName(String name);

// com.ms4systems.devs.core.message.impl.MessageBag
public class MessageBag extends ArrayList<Message> {
    public MessageBag();
    public void add(Port port, Object value);
    public MessageBag getMessages(Port port);
    public boolean hasMessages(Port port);
}

// com.ms4systems.devs.core.message.impl.Message
public Port getPort();
public Object getData();

// com.ms4systems.devs.core.message.impl.Port
public String getName();
public Class getType();
```

An input bag can contain multiple messages on one port. Preserve DEVS bag semantics: iterate over every relevant message. Numbers received through a generic JSON port implement Number; use doubleValue()/intValue() rather than assuming a specific boxed numeric type. Typed ports such as Double.class are decoded by Jackson before external/confluent transition calls.
