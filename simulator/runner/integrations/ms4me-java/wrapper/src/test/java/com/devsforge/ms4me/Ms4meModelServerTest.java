package com.devsforge.ms4me;

import com.devsforge.models.AtomicModelServiceGrpc;
import com.devsforge.models.ElapsedTime;
import com.devsforge.models.InputMessage;
import com.devsforge.models.OutputResponse;
import com.google.protobuf.Empty;
import com.ms4systems.devs.core.message.impl.MessageBag;
import com.ms4systems.devs.core.model.impl.Atomic;
import com.ms4systems.devs.core.simulation.impl.AtomicSimulator;
import io.grpc.ManagedChannel;
import io.grpc.Server;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import io.grpc.inprocess.InProcessChannelBuilder;
import io.grpc.inprocess.InProcessServerBuilder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class Ms4meModelServerTest {
    private static final Empty EMPTY = Empty.getDefaultInstance();

    private Server server;
    private ManagedChannel channel;

    /** Model whose internal transition throws, to check the error mapping. */
    public static class Exploding extends Atomic {
        private static final long serialVersionUID = 1L;

        public Exploding() {
            super("Exploding");
        }

        @Override
        public Double getTimeAdvance() {
            return 1.0;
        }

        @Override
        public void internalTransition() {
            throw new IllegalStateException("boom");
        }
    }

    private AtomicModelServiceGrpc.AtomicModelServiceBlockingStub serve(String className, String... ports)
            throws Exception {
        ModelHost host = ModelHost.load(className, ModelHostTest.cfg("m-1", ports));
        String name = InProcessServerBuilder.generateName();
        server = InProcessServerBuilder.forName(name).directExecutor()
                .addService(new Ms4meModelServer(host, new PortCodec())).build().start();
        channel = InProcessChannelBuilder.forName(name).directExecutor().build();
        return AtomicModelServiceGrpc.newBlockingStub(channel);
    }

    @AfterEach
    void stop() {
        if (channel != null) {
            channel.shutdownNow();
        }
        if (server != null) {
            server.shutdownNow();
        }
    }

    private static InputMessage input(String port, String json) {
        return InputMessage.newBuilder().setPortName(port).setValueJson(json).build();
    }

    private static ElapsedTime elapsed(double e) {
        return ElapsedTime.newBuilder().setValue(e).build();
    }

    private static String singleOutput(OutputResponse response, String port) {
        assertEquals(1, response.getOutputsCount());
        assertEquals(port, response.getOutputs(0).getPortName());
        assertEquals(1, response.getOutputs(0).getValuesJsonCount());
        return response.getOutputs(0).getValuesJson(0);
    }

    @Test
    void followsTheAtomicSimulatorTrajectory() throws Exception {
        AtomicModelServiceGrpc.AtomicModelServiceBlockingStub stub =
                serve(SampleGenerator.class.getName(), ModelHostTest.GENERATOR_PORTS);
        AtomicSimulator reference = new AtomicSimulator(new SampleGenerator());
        reference.initialize(0);
        stub.initialize(EMPTY);

        for (int step = 0; step < 3; step++) {
            double referenceSigma = reference.getNextEventTime() - reference.getLastEventTime();
            assertEquals(referenceSigma, stub.timeAdvance(EMPTY).getSigma(), "sigma at step " + step);

            MessageBag referenceOutput = reference.computeOutput();
            Object referenceCount = ((Map<?, ?>) referenceOutput.get(0).getData()).get("count");
            assertEquals("{\"count\":" + referenceCount + "}", singleOutput(stub.output(EMPTY), "out"));

            reference.executeNextEvent(reference.getNextEventTime());
            stub.internalTransition(EMPTY);
        }
    }

    @Test
    void routesInputsThroughExternalAndConfluentTransitions() throws Exception {
        AtomicModelServiceGrpc.AtomicModelServiceBlockingStub stub =
                serve(SampleGenerator.class.getName(), ModelHostTest.GENERATOR_PORTS);
        stub.initialize(EMPTY);
        assertEquals(1.0, stub.timeAdvance(EMPTY).getSigma());

        // typed port: "3" becomes a Double for the model
        stub.addInput(input("setPeriod", "3"));
        stub.externalTransition(elapsed(0.5));
        assertEquals(3.0, stub.timeAdvance(EMPTY).getSigma());

        // confluent: default Closure-DEVS order is internal then external(0, bag)
        stub.addInput(input("setPeriod", "2"));
        stub.confluentTransition(elapsed(3.0));
        assertEquals(2.0, stub.timeAdvance(EMPTY).getSigma());
        assertEquals("{\"count\":1}", singleOutput(stub.output(EMPTY), "out"));

        // generic port: JSON object arrives as a Map; passivating yields Double.MAX_VALUE, not +Inf
        stub.addInput(input("stop", "{\"reason\": \"done\"}"));
        stub.externalTransition(elapsed(0.25));
        assertEquals(Double.MAX_VALUE, stub.timeAdvance(EMPTY).getSigma());

        // Initialize is re-entrant and drops pending inputs
        stub.addInput(input("stop", "null"));
        stub.initialize(EMPTY);
        assertEquals(2.0, stub.timeAdvance(EMPTY).getSigma());
        stub.internalTransition(EMPTY);
        assertEquals(2.0, stub.timeAdvance(EMPTY).getSigma());
    }

    @Test
    void reportsUnknownPortsAndModelExceptionsAsGrpcErrors() throws Exception {
        AtomicModelServiceGrpc.AtomicModelServiceBlockingStub stub = serve(Exploding.class.getName());
        stub.initialize(EMPTY);

        StatusRuntimeException notFound = assertThrows(StatusRuntimeException.class,
                () -> stub.addInput(input("nope", "1")));
        assertEquals(Status.Code.NOT_FOUND, notFound.getStatus().getCode());

        StatusRuntimeException internal = assertThrows(StatusRuntimeException.class,
                () -> stub.internalTransition(EMPTY));
        assertEquals(Status.Code.INTERNAL, internal.getStatus().getCode());
        assertTrue(internal.getStatus().getDescription().contains("boom"), internal.getStatus().getDescription());
        assertTrue(internal.getStatus().getDescription().contains("InternalTransition failed in model m-1"),
                internal.getStatus().getDescription());
    }
}
