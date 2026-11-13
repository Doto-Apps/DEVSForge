package com.devsforge.ms4me;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.grpc.Server;
import io.grpc.ServerBuilder;

import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Launcher: java -cp ms4me-runtime.jar:classes com.devsforge.ms4me.Main --json '{...}' --model-class pkg.Model
 * The gRPC port comes from GRPC_PORT (default 50051), as for the other wrappers.
 */
public final class Main {
    private static final Logger LOG = Logger.getLogger(Main.class.getName());
    private static final String USAGE = "usage: java -cp ms4me-runtime.jar:classes " + Main.class.getName()
            + " --json '<RunnableModel JSON>' --model-class <fully.qualified.ModelClass>   (env GRPC_PORT, default 50051)";

    private Main() {
    }

    public static void main(String[] args) throws Exception {
        String json = null;
        String modelClass = null;
        for (int i = 0; i + 1 < args.length; i++) {
            if ("--json".equals(args[i])) {
                json = args[++i];
            } else if ("--model-class".equals(args[i])) {
                modelClass = args[++i];
            }
        }
        if (json == null || json.isEmpty() || modelClass == null || modelClass.isEmpty()) {
            System.err.println(USAGE);
            System.exit(2);
        }

        LOG.info("[WRAPPER] MS4 Me model wrapper starting...");
        RunnableModel cfg = new ObjectMapper().readValue(json, RunnableModel.class);

        ModelHost host;
        try {
            host = ModelHost.load(modelClass, cfg);
        } catch (ModelLoadException e) {
            LOG.log(Level.SEVERE, "cannot load MS4 Me model: " + e.getMessage(), e.getCause());
            System.exit(1);
            return;
        }

        int port = grpcPort();
        Server server = ServerBuilder.forPort(port)
                .addService(new Ms4meModelServer(host, new PortCodec()))
                .build()
                .start();

        LOG.info("MS4 Me model " + cfg.name + " (" + modelClass + ") listening on port " + port);
        server.awaitTermination();
    }

    private static int grpcPort() {
        String portStr = System.getenv("GRPC_PORT");
        if (portStr != null && !portStr.isEmpty()) {
            try {
                return Integer.parseInt(portStr);
            } catch (NumberFormatException e) {
                LOG.warning("Invalid GRPC_PORT value: " + portStr + ", using default 50051");
            }
        }
        return 50051;
    }
}
