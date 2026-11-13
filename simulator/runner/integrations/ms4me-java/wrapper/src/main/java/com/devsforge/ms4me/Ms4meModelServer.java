package com.devsforge.ms4me;

import com.devsforge.models.AtomicModelServiceGrpc;
import com.devsforge.models.ElapsedTime;
import com.devsforge.models.InputMessage;
import com.devsforge.models.OutputResponse;
import com.devsforge.models.PortOutput;
import com.devsforge.models.TimeAdvanceResponse;
import com.google.protobuf.Empty;
import com.ms4systems.devs.core.message.impl.Message;
import com.ms4systems.devs.core.message.impl.MessageBag;
import com.ms4systems.devs.core.message.impl.Port;
import com.ms4systems.devs.core.model.impl.Atomic;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Maps the runner's AtomicModelService calls onto a Closure-DEVS Atomic.
 *
 * Inputs delivered with AddInput are kept in a pending MessageBag and handed to the next
 * external or confluent transition. Initialize is re-entrant: the runner calls it while
 * probing readiness and again on SimulationInit.
 */
public final class Ms4meModelServer extends AtomicModelServiceGrpc.AtomicModelServiceImplBase {
    private static final Logger LOG = Logger.getLogger(Ms4meModelServer.class.getName());

    private final ModelHost host;
    private final PortCodec codec;
    private MessageBag pending = new MessageBag();

    public Ms4meModelServer(ModelHost host, PortCodec codec) {
        this.host = host;
        this.codec = codec;
    }

    @Override
    public synchronized void initialize(Empty request, StreamObserver<Empty> responseObserver) {
        guard(responseObserver, "Initialize", () -> {
            pending = new MessageBag();
            model().initialize();
            return Empty.getDefaultInstance();
        });
    }

    @Override
    public synchronized void finalize(Empty request, StreamObserver<Empty> responseObserver) {
        responseObserver.onNext(Empty.getDefaultInstance());
        responseObserver.onCompleted();
    }

    @Override
    public synchronized void timeAdvance(Empty request, StreamObserver<TimeAdvanceResponse> responseObserver) {
        guard(responseObserver, "TimeAdvance", () -> {
            Double ta = model().getTimeAdvance();
            double sigma = (ta == null || (ta.isInfinite() && ta > 0)) ? Double.MAX_VALUE : ta;
            return TimeAdvanceResponse.newBuilder().setSigma(sigma).build();
        });
    }

    @Override
    public synchronized void internalTransition(Empty request, StreamObserver<Empty> responseObserver) {
        guard(responseObserver, "InternalTransition", () -> {
            model().internalTransition();
            return Empty.getDefaultInstance();
        });
    }

    @Override
    public synchronized void externalTransition(ElapsedTime request, StreamObserver<Empty> responseObserver) {
        guard(responseObserver, "ExternalTransition", () -> {
            MessageBag input = takePending();
            model().elapsedTime = request.getValue();
            model().externalTransition(request.getValue(), input);
            return Empty.getDefaultInstance();
        });
    }

    @Override
    public synchronized void confluentTransition(ElapsedTime request, StreamObserver<Empty> responseObserver) {
        guard(responseObserver, "ConfluentTransition", () -> {
            MessageBag input = takePending();
            model().elapsedTime = request.getValue();
            model().confluentTransition(input);
            return Empty.getDefaultInstance();
        });
    }

    @Override
    public synchronized void output(Empty request, StreamObserver<OutputResponse> responseObserver) {
        guard(responseObserver, "Output", () -> {
            MessageBag bag = model().getOutput();
            Map<String, PortOutput.Builder> byPort = new LinkedHashMap<>();
            if (bag != null) {
                for (Message message : bag) {
                    Port port = message.getPort();
                    if (port == null) {
                        continue;
                    }
                    byPort.computeIfAbsent(port.getName(), name -> PortOutput.newBuilder().setPortName(name))
                            .addValuesJson(codec.encode(message.getData()));
                }
            }
            OutputResponse.Builder response = OutputResponse.newBuilder();
            for (PortOutput.Builder portOutput : byPort.values()) {
                response.addOutputs(portOutput.build());
            }
            return response.build();
        });
    }

    @Override
    public synchronized void addInput(InputMessage request, StreamObserver<Empty> responseObserver) {
        Port port = host.inputPort(request.getPortName());
        if (port == null) {
            responseObserver.onError(Status.NOT_FOUND
                    .withDescription("input port " + request.getPortName() + " not found on model " + model().getName())
                    .asRuntimeException());
            return;
        }
        guard(responseObserver, "AddInput", () -> {
            pending.add(port, codec.decode(request.getValueJson(), port.getType()));
            return Empty.getDefaultInstance();
        });
    }

    private Atomic model() {
        return host.atomic();
    }

    private MessageBag takePending() {
        MessageBag input = pending;
        pending = new MessageBag();
        return input;
    }

    private interface Call<T> {
        T run() throws Exception;
    }

    private <T> void guard(StreamObserver<T> responseObserver, String rpc, Call<T> body) {
        try {
            responseObserver.onNext(body.run());
            responseObserver.onCompleted();
        } catch (Throwable t) {
            String description = rpc + " failed in model " + model().getName() + ": " + t;
            LOG.log(Level.SEVERE, description, t);
            responseObserver.onError(Status.INTERNAL.withDescription(description).withCause(t).asRuntimeException());
        }
    }
}
