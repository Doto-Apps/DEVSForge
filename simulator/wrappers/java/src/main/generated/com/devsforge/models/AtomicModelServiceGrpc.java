package com.devsforge.models;

import static io.grpc.MethodDescriptor.generateFullMethodName;

/**
 */
@javax.annotation.Generated(
    value = "by gRPC proto compiler (version 1.60.0)",
    comments = "Source: devs.proto")
@io.grpc.stub.annotations.GrpcGenerated
public final class AtomicModelServiceGrpc {

  private AtomicModelServiceGrpc() {}

  public static final java.lang.String SERVICE_NAME = "devsforge.devs.AtomicModelService";

  // Static method descriptors that strictly reflect the proto.
  private static volatile io.grpc.MethodDescriptor<com.google.protobuf.Empty,
      com.google.protobuf.Empty> getInitializeMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "Initialize",
      requestType = com.google.protobuf.Empty.class,
      responseType = com.google.protobuf.Empty.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<com.google.protobuf.Empty,
      com.google.protobuf.Empty> getInitializeMethod() {
    io.grpc.MethodDescriptor<com.google.protobuf.Empty, com.google.protobuf.Empty> getInitializeMethod;
    if ((getInitializeMethod = AtomicModelServiceGrpc.getInitializeMethod) == null) {
      synchronized (AtomicModelServiceGrpc.class) {
        if ((getInitializeMethod = AtomicModelServiceGrpc.getInitializeMethod) == null) {
          AtomicModelServiceGrpc.getInitializeMethod = getInitializeMethod =
              io.grpc.MethodDescriptor.<com.google.protobuf.Empty, com.google.protobuf.Empty>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "Initialize"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  com.google.protobuf.Empty.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  com.google.protobuf.Empty.getDefaultInstance()))
              .setSchemaDescriptor(new AtomicModelServiceMethodDescriptorSupplier("Initialize"))
              .build();
        }
      }
    }
    return getInitializeMethod;
  }

  private static volatile io.grpc.MethodDescriptor<com.google.protobuf.Empty,
      com.google.protobuf.Empty> getFinalizeMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "Finalize",
      requestType = com.google.protobuf.Empty.class,
      responseType = com.google.protobuf.Empty.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<com.google.protobuf.Empty,
      com.google.protobuf.Empty> getFinalizeMethod() {
    io.grpc.MethodDescriptor<com.google.protobuf.Empty, com.google.protobuf.Empty> getFinalizeMethod;
    if ((getFinalizeMethod = AtomicModelServiceGrpc.getFinalizeMethod) == null) {
      synchronized (AtomicModelServiceGrpc.class) {
        if ((getFinalizeMethod = AtomicModelServiceGrpc.getFinalizeMethod) == null) {
          AtomicModelServiceGrpc.getFinalizeMethod = getFinalizeMethod =
              io.grpc.MethodDescriptor.<com.google.protobuf.Empty, com.google.protobuf.Empty>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "Finalize"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  com.google.protobuf.Empty.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  com.google.protobuf.Empty.getDefaultInstance()))
              .setSchemaDescriptor(new AtomicModelServiceMethodDescriptorSupplier("Finalize"))
              .build();
        }
      }
    }
    return getFinalizeMethod;
  }

  private static volatile io.grpc.MethodDescriptor<com.google.protobuf.Empty,
      com.devsforge.models.TimeAdvanceResponse> getTimeAdvanceMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "TimeAdvance",
      requestType = com.google.protobuf.Empty.class,
      responseType = com.devsforge.models.TimeAdvanceResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<com.google.protobuf.Empty,
      com.devsforge.models.TimeAdvanceResponse> getTimeAdvanceMethod() {
    io.grpc.MethodDescriptor<com.google.protobuf.Empty, com.devsforge.models.TimeAdvanceResponse> getTimeAdvanceMethod;
    if ((getTimeAdvanceMethod = AtomicModelServiceGrpc.getTimeAdvanceMethod) == null) {
      synchronized (AtomicModelServiceGrpc.class) {
        if ((getTimeAdvanceMethod = AtomicModelServiceGrpc.getTimeAdvanceMethod) == null) {
          AtomicModelServiceGrpc.getTimeAdvanceMethod = getTimeAdvanceMethod =
              io.grpc.MethodDescriptor.<com.google.protobuf.Empty, com.devsforge.models.TimeAdvanceResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "TimeAdvance"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  com.google.protobuf.Empty.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  com.devsforge.models.TimeAdvanceResponse.getDefaultInstance()))
              .setSchemaDescriptor(new AtomicModelServiceMethodDescriptorSupplier("TimeAdvance"))
              .build();
        }
      }
    }
    return getTimeAdvanceMethod;
  }

  private static volatile io.grpc.MethodDescriptor<com.google.protobuf.Empty,
      com.google.protobuf.Empty> getInternalTransitionMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "InternalTransition",
      requestType = com.google.protobuf.Empty.class,
      responseType = com.google.protobuf.Empty.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<com.google.protobuf.Empty,
      com.google.protobuf.Empty> getInternalTransitionMethod() {
    io.grpc.MethodDescriptor<com.google.protobuf.Empty, com.google.protobuf.Empty> getInternalTransitionMethod;
    if ((getInternalTransitionMethod = AtomicModelServiceGrpc.getInternalTransitionMethod) == null) {
      synchronized (AtomicModelServiceGrpc.class) {
        if ((getInternalTransitionMethod = AtomicModelServiceGrpc.getInternalTransitionMethod) == null) {
          AtomicModelServiceGrpc.getInternalTransitionMethod = getInternalTransitionMethod =
              io.grpc.MethodDescriptor.<com.google.protobuf.Empty, com.google.protobuf.Empty>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "InternalTransition"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  com.google.protobuf.Empty.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  com.google.protobuf.Empty.getDefaultInstance()))
              .setSchemaDescriptor(new AtomicModelServiceMethodDescriptorSupplier("InternalTransition"))
              .build();
        }
      }
    }
    return getInternalTransitionMethod;
  }

  private static volatile io.grpc.MethodDescriptor<com.devsforge.models.ElapsedTime,
      com.google.protobuf.Empty> getExternalTransitionMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "ExternalTransition",
      requestType = com.devsforge.models.ElapsedTime.class,
      responseType = com.google.protobuf.Empty.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<com.devsforge.models.ElapsedTime,
      com.google.protobuf.Empty> getExternalTransitionMethod() {
    io.grpc.MethodDescriptor<com.devsforge.models.ElapsedTime, com.google.protobuf.Empty> getExternalTransitionMethod;
    if ((getExternalTransitionMethod = AtomicModelServiceGrpc.getExternalTransitionMethod) == null) {
      synchronized (AtomicModelServiceGrpc.class) {
        if ((getExternalTransitionMethod = AtomicModelServiceGrpc.getExternalTransitionMethod) == null) {
          AtomicModelServiceGrpc.getExternalTransitionMethod = getExternalTransitionMethod =
              io.grpc.MethodDescriptor.<com.devsforge.models.ElapsedTime, com.google.protobuf.Empty>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "ExternalTransition"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  com.devsforge.models.ElapsedTime.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  com.google.protobuf.Empty.getDefaultInstance()))
              .setSchemaDescriptor(new AtomicModelServiceMethodDescriptorSupplier("ExternalTransition"))
              .build();
        }
      }
    }
    return getExternalTransitionMethod;
  }

  private static volatile io.grpc.MethodDescriptor<com.devsforge.models.ElapsedTime,
      com.google.protobuf.Empty> getConfluentTransitionMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "ConfluentTransition",
      requestType = com.devsforge.models.ElapsedTime.class,
      responseType = com.google.protobuf.Empty.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<com.devsforge.models.ElapsedTime,
      com.google.protobuf.Empty> getConfluentTransitionMethod() {
    io.grpc.MethodDescriptor<com.devsforge.models.ElapsedTime, com.google.protobuf.Empty> getConfluentTransitionMethod;
    if ((getConfluentTransitionMethod = AtomicModelServiceGrpc.getConfluentTransitionMethod) == null) {
      synchronized (AtomicModelServiceGrpc.class) {
        if ((getConfluentTransitionMethod = AtomicModelServiceGrpc.getConfluentTransitionMethod) == null) {
          AtomicModelServiceGrpc.getConfluentTransitionMethod = getConfluentTransitionMethod =
              io.grpc.MethodDescriptor.<com.devsforge.models.ElapsedTime, com.google.protobuf.Empty>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "ConfluentTransition"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  com.devsforge.models.ElapsedTime.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  com.google.protobuf.Empty.getDefaultInstance()))
              .setSchemaDescriptor(new AtomicModelServiceMethodDescriptorSupplier("ConfluentTransition"))
              .build();
        }
      }
    }
    return getConfluentTransitionMethod;
  }

  private static volatile io.grpc.MethodDescriptor<com.google.protobuf.Empty,
      com.devsforge.models.OutputResponse> getOutputMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "Output",
      requestType = com.google.protobuf.Empty.class,
      responseType = com.devsforge.models.OutputResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<com.google.protobuf.Empty,
      com.devsforge.models.OutputResponse> getOutputMethod() {
    io.grpc.MethodDescriptor<com.google.protobuf.Empty, com.devsforge.models.OutputResponse> getOutputMethod;
    if ((getOutputMethod = AtomicModelServiceGrpc.getOutputMethod) == null) {
      synchronized (AtomicModelServiceGrpc.class) {
        if ((getOutputMethod = AtomicModelServiceGrpc.getOutputMethod) == null) {
          AtomicModelServiceGrpc.getOutputMethod = getOutputMethod =
              io.grpc.MethodDescriptor.<com.google.protobuf.Empty, com.devsforge.models.OutputResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "Output"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  com.google.protobuf.Empty.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  com.devsforge.models.OutputResponse.getDefaultInstance()))
              .setSchemaDescriptor(new AtomicModelServiceMethodDescriptorSupplier("Output"))
              .build();
        }
      }
    }
    return getOutputMethod;
  }

  private static volatile io.grpc.MethodDescriptor<com.devsforge.models.InputMessage,
      com.google.protobuf.Empty> getAddInputMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "AddInput",
      requestType = com.devsforge.models.InputMessage.class,
      responseType = com.google.protobuf.Empty.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<com.devsforge.models.InputMessage,
      com.google.protobuf.Empty> getAddInputMethod() {
    io.grpc.MethodDescriptor<com.devsforge.models.InputMessage, com.google.protobuf.Empty> getAddInputMethod;
    if ((getAddInputMethod = AtomicModelServiceGrpc.getAddInputMethod) == null) {
      synchronized (AtomicModelServiceGrpc.class) {
        if ((getAddInputMethod = AtomicModelServiceGrpc.getAddInputMethod) == null) {
          AtomicModelServiceGrpc.getAddInputMethod = getAddInputMethod =
              io.grpc.MethodDescriptor.<com.devsforge.models.InputMessage, com.google.protobuf.Empty>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "AddInput"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  com.devsforge.models.InputMessage.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  com.google.protobuf.Empty.getDefaultInstance()))
              .setSchemaDescriptor(new AtomicModelServiceMethodDescriptorSupplier("AddInput"))
              .build();
        }
      }
    }
    return getAddInputMethod;
  }

  /**
   * Creates a new async stub that supports all call types for the service
   */
  public static AtomicModelServiceStub newStub(io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<AtomicModelServiceStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<AtomicModelServiceStub>() {
        @java.lang.Override
        public AtomicModelServiceStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new AtomicModelServiceStub(channel, callOptions);
        }
      };
    return AtomicModelServiceStub.newStub(factory, channel);
  }

  /**
   * Creates a new blocking-style stub that supports unary and streaming output calls on the service
   */
  public static AtomicModelServiceBlockingStub newBlockingStub(
      io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<AtomicModelServiceBlockingStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<AtomicModelServiceBlockingStub>() {
        @java.lang.Override
        public AtomicModelServiceBlockingStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new AtomicModelServiceBlockingStub(channel, callOptions);
        }
      };
    return AtomicModelServiceBlockingStub.newStub(factory, channel);
  }

  /**
   * Creates a new ListenableFuture-style stub that supports unary calls on the service
   */
  public static AtomicModelServiceFutureStub newFutureStub(
      io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<AtomicModelServiceFutureStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<AtomicModelServiceFutureStub>() {
        @java.lang.Override
        public AtomicModelServiceFutureStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new AtomicModelServiceFutureStub(channel, callOptions);
        }
      };
    return AtomicModelServiceFutureStub.newStub(factory, channel);
  }

  /**
   */
  public interface AsyncService {

    /**
     * <pre>
     * Initialisation du modèle (Component.Initialize)
     * </pre>
     */
    default void initialize(com.google.protobuf.Empty request,
        io.grpc.stub.StreamObserver<com.google.protobuf.Empty> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getInitializeMethod(), responseObserver);
    }

    /**
     * <pre>
     * Fin de simulation / nettoyage (Component.Exit)
     * </pre>
     */
    default void finalize(com.google.protobuf.Empty request,
        io.grpc.stub.StreamObserver<com.google.protobuf.Empty> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getFinalizeMethod(), responseObserver);
    }

    /**
     * <pre>
     * TimeAdvance() : renvoie sigma (TA)
     * </pre>
     */
    default void timeAdvance(com.google.protobuf.Empty request,
        io.grpc.stub.StreamObserver<com.devsforge.models.TimeAdvanceResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getTimeAdvanceMethod(), responseObserver);
    }

    /**
     * <pre>
     * InternalTransition() : DeltInt
     * </pre>
     */
    default void internalTransition(com.google.protobuf.Empty request,
        io.grpc.stub.StreamObserver<com.google.protobuf.Empty> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getInternalTransitionMethod(), responseObserver);
    }

    /**
     * <pre>
     * ExternalTransition(e) : DeltExt
     * </pre>
     */
    default void externalTransition(com.devsforge.models.ElapsedTime request,
        io.grpc.stub.StreamObserver<com.google.protobuf.Empty> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getExternalTransitionMethod(), responseObserver);
    }

    /**
     * <pre>
     * ConfluentTransition(e) : DeltCon
     * </pre>
     */
    default void confluentTransition(com.devsforge.models.ElapsedTime request,
        io.grpc.stub.StreamObserver<com.google.protobuf.Empty> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getConfluentTransitionMethod(), responseObserver);
    }

    /**
     * <pre>
     * Output() : Lambda
     * Le wrapper lit les ports de sortie du modèle, construit OutputResponse,
     * et peut ensuite vider les ports si c'est ta convention.
     * </pre>
     */
    default void output(com.google.protobuf.Empty request,
        io.grpc.stub.StreamObserver<com.devsforge.models.OutputResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getOutputMethod(), responseObserver);
    }

    /**
     * <pre>
     * Injection d'une valeur dans un port d'entrée (AddValue sur un inPort)
     * C'est ce que le runner va appeler quand il reçoit un message pour ce modèle.
     * </pre>
     */
    default void addInput(com.devsforge.models.InputMessage request,
        io.grpc.stub.StreamObserver<com.google.protobuf.Empty> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getAddInputMethod(), responseObserver);
    }
  }

  /**
   * Base class for the server implementation of the service AtomicModelService.
   */
  public static abstract class AtomicModelServiceImplBase
      implements io.grpc.BindableService, AsyncService {

    @java.lang.Override public final io.grpc.ServerServiceDefinition bindService() {
      return AtomicModelServiceGrpc.bindService(this);
    }
  }

  /**
   * A stub to allow clients to do asynchronous rpc calls to service AtomicModelService.
   */
  public static final class AtomicModelServiceStub
      extends io.grpc.stub.AbstractAsyncStub<AtomicModelServiceStub> {
    private AtomicModelServiceStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected AtomicModelServiceStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new AtomicModelServiceStub(channel, callOptions);
    }

    /**
     * <pre>
     * Initialisation du modèle (Component.Initialize)
     * </pre>
     */
    public void initialize(com.google.protobuf.Empty request,
        io.grpc.stub.StreamObserver<com.google.protobuf.Empty> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getInitializeMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * Fin de simulation / nettoyage (Component.Exit)
     * </pre>
     */
    public void finalize(com.google.protobuf.Empty request,
        io.grpc.stub.StreamObserver<com.google.protobuf.Empty> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getFinalizeMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * TimeAdvance() : renvoie sigma (TA)
     * </pre>
     */
    public void timeAdvance(com.google.protobuf.Empty request,
        io.grpc.stub.StreamObserver<com.devsforge.models.TimeAdvanceResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getTimeAdvanceMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * InternalTransition() : DeltInt
     * </pre>
     */
    public void internalTransition(com.google.protobuf.Empty request,
        io.grpc.stub.StreamObserver<com.google.protobuf.Empty> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getInternalTransitionMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * ExternalTransition(e) : DeltExt
     * </pre>
     */
    public void externalTransition(com.devsforge.models.ElapsedTime request,
        io.grpc.stub.StreamObserver<com.google.protobuf.Empty> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getExternalTransitionMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * ConfluentTransition(e) : DeltCon
     * </pre>
     */
    public void confluentTransition(com.devsforge.models.ElapsedTime request,
        io.grpc.stub.StreamObserver<com.google.protobuf.Empty> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getConfluentTransitionMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * Output() : Lambda
     * Le wrapper lit les ports de sortie du modèle, construit OutputResponse,
     * et peut ensuite vider les ports si c'est ta convention.
     * </pre>
     */
    public void output(com.google.protobuf.Empty request,
        io.grpc.stub.StreamObserver<com.devsforge.models.OutputResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getOutputMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * Injection d'une valeur dans un port d'entrée (AddValue sur un inPort)
     * C'est ce que le runner va appeler quand il reçoit un message pour ce modèle.
     * </pre>
     */
    public void addInput(com.devsforge.models.InputMessage request,
        io.grpc.stub.StreamObserver<com.google.protobuf.Empty> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getAddInputMethod(), getCallOptions()), request, responseObserver);
    }
  }

  /**
   * A stub to allow clients to do synchronous rpc calls to service AtomicModelService.
   */
  public static final class AtomicModelServiceBlockingStub
      extends io.grpc.stub.AbstractBlockingStub<AtomicModelServiceBlockingStub> {
    private AtomicModelServiceBlockingStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected AtomicModelServiceBlockingStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new AtomicModelServiceBlockingStub(channel, callOptions);
    }

    /**
     * <pre>
     * Initialisation du modèle (Component.Initialize)
     * </pre>
     */
    public com.google.protobuf.Empty initialize(com.google.protobuf.Empty request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getInitializeMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * Fin de simulation / nettoyage (Component.Exit)
     * </pre>
     */
    public com.google.protobuf.Empty finalize(com.google.protobuf.Empty request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getFinalizeMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * TimeAdvance() : renvoie sigma (TA)
     * </pre>
     */
    public com.devsforge.models.TimeAdvanceResponse timeAdvance(com.google.protobuf.Empty request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getTimeAdvanceMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * InternalTransition() : DeltInt
     * </pre>
     */
    public com.google.protobuf.Empty internalTransition(com.google.protobuf.Empty request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getInternalTransitionMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * ExternalTransition(e) : DeltExt
     * </pre>
     */
    public com.google.protobuf.Empty externalTransition(com.devsforge.models.ElapsedTime request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getExternalTransitionMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * ConfluentTransition(e) : DeltCon
     * </pre>
     */
    public com.google.protobuf.Empty confluentTransition(com.devsforge.models.ElapsedTime request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getConfluentTransitionMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * Output() : Lambda
     * Le wrapper lit les ports de sortie du modèle, construit OutputResponse,
     * et peut ensuite vider les ports si c'est ta convention.
     * </pre>
     */
    public com.devsforge.models.OutputResponse output(com.google.protobuf.Empty request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getOutputMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * Injection d'une valeur dans un port d'entrée (AddValue sur un inPort)
     * C'est ce que le runner va appeler quand il reçoit un message pour ce modèle.
     * </pre>
     */
    public com.google.protobuf.Empty addInput(com.devsforge.models.InputMessage request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getAddInputMethod(), getCallOptions(), request);
    }
  }

  /**
   * A stub to allow clients to do ListenableFuture-style rpc calls to service AtomicModelService.
   */
  public static final class AtomicModelServiceFutureStub
      extends io.grpc.stub.AbstractFutureStub<AtomicModelServiceFutureStub> {
    private AtomicModelServiceFutureStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected AtomicModelServiceFutureStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new AtomicModelServiceFutureStub(channel, callOptions);
    }

    /**
     * <pre>
     * Initialisation du modèle (Component.Initialize)
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<com.google.protobuf.Empty> initialize(
        com.google.protobuf.Empty request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getInitializeMethod(), getCallOptions()), request);
    }

    /**
     * <pre>
     * Fin de simulation / nettoyage (Component.Exit)
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<com.google.protobuf.Empty> finalize(
        com.google.protobuf.Empty request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getFinalizeMethod(), getCallOptions()), request);
    }

    /**
     * <pre>
     * TimeAdvance() : renvoie sigma (TA)
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<com.devsforge.models.TimeAdvanceResponse> timeAdvance(
        com.google.protobuf.Empty request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getTimeAdvanceMethod(), getCallOptions()), request);
    }

    /**
     * <pre>
     * InternalTransition() : DeltInt
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<com.google.protobuf.Empty> internalTransition(
        com.google.protobuf.Empty request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getInternalTransitionMethod(), getCallOptions()), request);
    }

    /**
     * <pre>
     * ExternalTransition(e) : DeltExt
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<com.google.protobuf.Empty> externalTransition(
        com.devsforge.models.ElapsedTime request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getExternalTransitionMethod(), getCallOptions()), request);
    }

    /**
     * <pre>
     * ConfluentTransition(e) : DeltCon
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<com.google.protobuf.Empty> confluentTransition(
        com.devsforge.models.ElapsedTime request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getConfluentTransitionMethod(), getCallOptions()), request);
    }

    /**
     * <pre>
     * Output() : Lambda
     * Le wrapper lit les ports de sortie du modèle, construit OutputResponse,
     * et peut ensuite vider les ports si c'est ta convention.
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<com.devsforge.models.OutputResponse> output(
        com.google.protobuf.Empty request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getOutputMethod(), getCallOptions()), request);
    }

    /**
     * <pre>
     * Injection d'une valeur dans un port d'entrée (AddValue sur un inPort)
     * C'est ce que le runner va appeler quand il reçoit un message pour ce modèle.
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<com.google.protobuf.Empty> addInput(
        com.devsforge.models.InputMessage request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getAddInputMethod(), getCallOptions()), request);
    }
  }

  private static final int METHODID_INITIALIZE = 0;
  private static final int METHODID_FINALIZE = 1;
  private static final int METHODID_TIME_ADVANCE = 2;
  private static final int METHODID_INTERNAL_TRANSITION = 3;
  private static final int METHODID_EXTERNAL_TRANSITION = 4;
  private static final int METHODID_CONFLUENT_TRANSITION = 5;
  private static final int METHODID_OUTPUT = 6;
  private static final int METHODID_ADD_INPUT = 7;

  private static final class MethodHandlers<Req, Resp> implements
      io.grpc.stub.ServerCalls.UnaryMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ServerStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ClientStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.BidiStreamingMethod<Req, Resp> {
    private final AsyncService serviceImpl;
    private final int methodId;

    MethodHandlers(AsyncService serviceImpl, int methodId) {
      this.serviceImpl = serviceImpl;
      this.methodId = methodId;
    }

    @java.lang.Override
    @java.lang.SuppressWarnings("unchecked")
    public void invoke(Req request, io.grpc.stub.StreamObserver<Resp> responseObserver) {
      switch (methodId) {
        case METHODID_INITIALIZE:
          serviceImpl.initialize((com.google.protobuf.Empty) request,
              (io.grpc.stub.StreamObserver<com.google.protobuf.Empty>) responseObserver);
          break;
        case METHODID_FINALIZE:
          serviceImpl.finalize((com.google.protobuf.Empty) request,
              (io.grpc.stub.StreamObserver<com.google.protobuf.Empty>) responseObserver);
          break;
        case METHODID_TIME_ADVANCE:
          serviceImpl.timeAdvance((com.google.protobuf.Empty) request,
              (io.grpc.stub.StreamObserver<com.devsforge.models.TimeAdvanceResponse>) responseObserver);
          break;
        case METHODID_INTERNAL_TRANSITION:
          serviceImpl.internalTransition((com.google.protobuf.Empty) request,
              (io.grpc.stub.StreamObserver<com.google.protobuf.Empty>) responseObserver);
          break;
        case METHODID_EXTERNAL_TRANSITION:
          serviceImpl.externalTransition((com.devsforge.models.ElapsedTime) request,
              (io.grpc.stub.StreamObserver<com.google.protobuf.Empty>) responseObserver);
          break;
        case METHODID_CONFLUENT_TRANSITION:
          serviceImpl.confluentTransition((com.devsforge.models.ElapsedTime) request,
              (io.grpc.stub.StreamObserver<com.google.protobuf.Empty>) responseObserver);
          break;
        case METHODID_OUTPUT:
          serviceImpl.output((com.google.protobuf.Empty) request,
              (io.grpc.stub.StreamObserver<com.devsforge.models.OutputResponse>) responseObserver);
          break;
        case METHODID_ADD_INPUT:
          serviceImpl.addInput((com.devsforge.models.InputMessage) request,
              (io.grpc.stub.StreamObserver<com.google.protobuf.Empty>) responseObserver);
          break;
        default:
          throw new AssertionError();
      }
    }

    @java.lang.Override
    @java.lang.SuppressWarnings("unchecked")
    public io.grpc.stub.StreamObserver<Req> invoke(
        io.grpc.stub.StreamObserver<Resp> responseObserver) {
      switch (methodId) {
        default:
          throw new AssertionError();
      }
    }
  }

  public static final io.grpc.ServerServiceDefinition bindService(AsyncService service) {
    return io.grpc.ServerServiceDefinition.builder(getServiceDescriptor())
        .addMethod(
          getInitializeMethod(),
          io.grpc.stub.ServerCalls.asyncUnaryCall(
            new MethodHandlers<
              com.google.protobuf.Empty,
              com.google.protobuf.Empty>(
                service, METHODID_INITIALIZE)))
        .addMethod(
          getFinalizeMethod(),
          io.grpc.stub.ServerCalls.asyncUnaryCall(
            new MethodHandlers<
              com.google.protobuf.Empty,
              com.google.protobuf.Empty>(
                service, METHODID_FINALIZE)))
        .addMethod(
          getTimeAdvanceMethod(),
          io.grpc.stub.ServerCalls.asyncUnaryCall(
            new MethodHandlers<
              com.google.protobuf.Empty,
              com.devsforge.models.TimeAdvanceResponse>(
                service, METHODID_TIME_ADVANCE)))
        .addMethod(
          getInternalTransitionMethod(),
          io.grpc.stub.ServerCalls.asyncUnaryCall(
            new MethodHandlers<
              com.google.protobuf.Empty,
              com.google.protobuf.Empty>(
                service, METHODID_INTERNAL_TRANSITION)))
        .addMethod(
          getExternalTransitionMethod(),
          io.grpc.stub.ServerCalls.asyncUnaryCall(
            new MethodHandlers<
              com.devsforge.models.ElapsedTime,
              com.google.protobuf.Empty>(
                service, METHODID_EXTERNAL_TRANSITION)))
        .addMethod(
          getConfluentTransitionMethod(),
          io.grpc.stub.ServerCalls.asyncUnaryCall(
            new MethodHandlers<
              com.devsforge.models.ElapsedTime,
              com.google.protobuf.Empty>(
                service, METHODID_CONFLUENT_TRANSITION)))
        .addMethod(
          getOutputMethod(),
          io.grpc.stub.ServerCalls.asyncUnaryCall(
            new MethodHandlers<
              com.google.protobuf.Empty,
              com.devsforge.models.OutputResponse>(
                service, METHODID_OUTPUT)))
        .addMethod(
          getAddInputMethod(),
          io.grpc.stub.ServerCalls.asyncUnaryCall(
            new MethodHandlers<
              com.devsforge.models.InputMessage,
              com.google.protobuf.Empty>(
                service, METHODID_ADD_INPUT)))
        .build();
  }

  private static abstract class AtomicModelServiceBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoFileDescriptorSupplier, io.grpc.protobuf.ProtoServiceDescriptorSupplier {
    AtomicModelServiceBaseDescriptorSupplier() {}

    @java.lang.Override
    public com.google.protobuf.Descriptors.FileDescriptor getFileDescriptor() {
      return com.devsforge.models.DEVSForge.getDescriptor();
    }

    @java.lang.Override
    public com.google.protobuf.Descriptors.ServiceDescriptor getServiceDescriptor() {
      return getFileDescriptor().findServiceByName("AtomicModelService");
    }
  }

  private static final class AtomicModelServiceFileDescriptorSupplier
      extends AtomicModelServiceBaseDescriptorSupplier {
    AtomicModelServiceFileDescriptorSupplier() {}
  }

  private static final class AtomicModelServiceMethodDescriptorSupplier
      extends AtomicModelServiceBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoMethodDescriptorSupplier {
    private final java.lang.String methodName;

    AtomicModelServiceMethodDescriptorSupplier(java.lang.String methodName) {
      this.methodName = methodName;
    }

    @java.lang.Override
    public com.google.protobuf.Descriptors.MethodDescriptor getMethodDescriptor() {
      return getServiceDescriptor().findMethodByName(methodName);
    }
  }

  private static volatile io.grpc.ServiceDescriptor serviceDescriptor;

  public static io.grpc.ServiceDescriptor getServiceDescriptor() {
    io.grpc.ServiceDescriptor result = serviceDescriptor;
    if (result == null) {
      synchronized (AtomicModelServiceGrpc.class) {
        result = serviceDescriptor;
        if (result == null) {
          serviceDescriptor = result = io.grpc.ServiceDescriptor.newBuilder(SERVICE_NAME)
              .setSchemaDescriptor(new AtomicModelServiceFileDescriptorSupplier())
              .addMethod(getInitializeMethod())
              .addMethod(getFinalizeMethod())
              .addMethod(getTimeAdvanceMethod())
              .addMethod(getInternalTransitionMethod())
              .addMethod(getExternalTransitionMethod())
              .addMethod(getConfluentTransitionMethod())
              .addMethod(getOutputMethod())
              .addMethod(getAddInputMethod())
              .build();
        }
      }
    }
    return result;
  }
}
