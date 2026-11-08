package com.devsforge.runner.rpc;

import com.devsforge.models.*;
import com.devsforge.runner.modeling.Atomic;
import com.devsforge.runner.modeling.Port;
import com.google.protobuf.Empty;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;

import java.util.List;

public class DevsModelServer extends AtomicModelServiceGrpc.AtomicModelServiceImplBase {
    private final Atomic model;

    public DevsModelServer(Atomic model) {
        this.model = model;
    }

    @Override
    public void initialize(Empty request, StreamObserver<Empty> responseObserver) {
        model.initialize();
        responseObserver.onNext(Empty.getDefaultInstance());
        responseObserver.onCompleted();
    }

    @Override
    public void finalize(Empty request, StreamObserver<Empty> responseObserver) {
        model.exit();
        responseObserver.onNext(Empty.getDefaultInstance());
        responseObserver.onCompleted();
    }

    @Override
    public void timeAdvance(Empty request, StreamObserver<TimeAdvanceResponse> responseObserver) {
        double sigma = model.ta();
        TimeAdvanceResponse response = TimeAdvanceResponse.newBuilder()
                .setSigma(sigma)
                .build();
        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void internalTransition(Empty request, StreamObserver<Empty> responseObserver) {
        model.deltInt();
        responseObserver.onNext(Empty.getDefaultInstance());
        responseObserver.onCompleted();
    }

    @Override
    public void externalTransition(ElapsedTime request, StreamObserver<Empty> responseObserver) {
        model.deltExt(request.getValue());
        responseObserver.onNext(Empty.getDefaultInstance());
        responseObserver.onCompleted();
    }

    @Override
    public void confluentTransition(ElapsedTime request, StreamObserver<Empty> responseObserver) {
        model.deltCon(request.getValue());
        responseObserver.onNext(Empty.getDefaultInstance());
        responseObserver.onCompleted();
    }

    @Override
    public void output(Empty request, StreamObserver<OutputResponse> responseObserver) {
        model.lambda();

        OutputResponse.Builder responseBuilder = OutputResponse.newBuilder();
        String portType = "out";

        for (Port port : model.getPorts(portType)) {
            String portName = port.getName();
            List<Object> values = (List<Object>) port.getValues();

            PortOutput.Builder portBuilder = PortOutput.newBuilder()
                    .setPortName(portName);

            for (Object value : values) {
                try {
                    String jsonValue = JsonUtil.toJson(value);
                    portBuilder.addValuesJson(jsonValue);
                } catch (Exception e) {
                    responseObserver.onError(
                            Status.INTERNAL
                                    .withDescription(
                                            "Cannot JSON-encode value for port " + portName + ": " + e.getMessage())
                                    .asRuntimeException());
                    return;
                }
            }

            responseBuilder.addOutputs(portBuilder.build());
            port.clear();
        }

        responseObserver.onNext(responseBuilder.build());
        responseObserver.onCompleted();
    }

    @Override
    public void addInput(InputMessage request, StreamObserver<Empty> responseObserver) {
        String portName = request.getPortName();
        String valueJson = request.getValueJson();

        try {
            Object value = JsonUtil.fromJson(valueJson, Object.class);
            Port inPort = model.getPortByName(portName);
            inPort.addValue(value);

            responseObserver.onNext(Empty.getDefaultInstance());
            responseObserver.onCompleted();
        } catch (Exception e) {
            responseObserver.onError(
                    Status.NOT_FOUND
                            .withDescription("input port " + portName + " not found: " + e.getMessage())
                            .asRuntimeException());
        }
    }
}