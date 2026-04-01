package com.devsforge.runner.rpc;

import com.devsforge.runner.modeling.Atomic;
import com.devsforge.runner.modeling.RunnableModel;
import com.google.gson.Gson;
import io.grpc.Server;
import io.grpc.ServerBuilder;

import java.io.IOException;
import java.util.logging.Logger;

public class ServerRunner {
    private static final Logger logger = Logger.getLogger(ServerRunner.class.getName());
    private static final Gson gson = new Gson();

    public static void main(String[] args) throws IOException, InterruptedException {
        logger.info("[WRAPPER] Model wrapper starting...");

        if (args.length < 2 || !args[0].startsWith("--json")) {
            logger.severe("Please provide --json argument");
            System.exit(1);
        }

        String jsonStr = null;
        for (int i = 0; i < args.length; i++) {
            if ("--json".equals(args[i]) && i + 1 < args.length) {
                jsonStr = args[i + 1];
                break;
            }
        }

        if (jsonStr == null || jsonStr.isEmpty()) {
            logger.severe("Please provide --json argument with model configuration");
            System.exit(1);
        }

        RunnableModel config = gson.fromJson(jsonStr, RunnableModel.class);
        Atomic model = createModel(config);

        int port = getGrpcPort();

        Server server = ServerBuilder.forPort(port)
                .addService(new DevsModelServer(model))
                .build()
                .start();

        logger.info("DEVS model " + config.getName() + " listening on port " + port);

        server.awaitTermination();
    }

    private static Atomic createModel(RunnableModel config) {
        try {
            Class<?> modelClass = Class.forName("Model");
            java.lang.reflect.Method newModelMethod = modelClass.getMethod("NewModel", RunnableModel.class);
            return (Atomic) newModelMethod.invoke(null, config);
        } catch (Exception e) {
            throw new RuntimeException("Failed to create model instance: " + e.getMessage(), e);
        }
    }

    private static int getGrpcPort() {
        String portStr = System.getenv("GRPC_PORT");
        if (portStr != null && !portStr.isEmpty()) {
            try {
                return Integer.parseInt(portStr);
            } catch (NumberFormatException e) {
                logger.warning("Invalid GRPC_PORT value: " + portStr + ", using default 50051");
            }
        }
        return 50051;
    }
}