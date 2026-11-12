package devsforge.browser;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Function;

/** LSP transport only. All parsing, types and IDE features come from javac/Javacs. */
public final class BrowserBridge {
    private static final Map<String, Server> servers = new HashMap<>();

    // Javacs has process-wide source indexes. Give each project a class loader,
    // while sharing the browser JVM and its JDK across all documents.
    public static synchronized void create(String id, String classPath) throws Exception {
        if (servers.containsKey(id)) throw new IllegalStateException("Project already attached");
        URL[] jars = Arrays.stream(classPath.split(":"))
            .map(path -> { try { return Path.of(path).toUri().toURL(); } catch (Exception e) { throw new RuntimeException(e); } })
            .toArray(URL[]::new);
        Server server = new Server(new URLClassLoader(jars, BrowserBridge.class.getClassLoader()));
        servers.put(id, server);
        server.thread = new Thread(() -> {
            try {
                Class<?> lsp = server.loader.loadClass("org.javacs.lsp.LSP");
                Class<?> client = server.loader.loadClass("org.javacs.lsp.LanguageClient");
                var constructor = server.loader.loadClass("org.javacs.JavaLanguageServer").getDeclaredConstructor(client);
                constructor.setAccessible(true);
                Function<Object, Object> factory = connection -> {
                    try { return constructor.newInstance(connection); }
                    catch (Exception e) { throw new RuntimeException(e); }
                };
                lsp.getMethod("connect", Function.class, InputStream.class, OutputStream.class)
                    .invoke(null, factory, server.receive, server.send);
            } catch (Throwable error) {
                synchronized (server) { server.error = error.toString(); }
            }
        }, "browser-java-" + id);
        server.thread.setContextClassLoader(server.loader);
        // Keep the server runnable between JS calls: B-JVM stops scheduling
        // when only daemon threads remain, including its idle diagnostic pass.
        server.thread.setDaemon(false);
        server.thread.start();
    }

    public static synchronized void send(String id, String encoded) {
        Server server = require(id);
        // Transfer JSON as ASCII base64: the runtime interop uses modified UTF-8.
        byte[] body = Base64.getDecoder().decode(encoded);
        byte[] header = ("Content-Length: " + body.length + "\r\n\r\n").getBytes(StandardCharsets.US_ASCII);
        byte[] packet = new byte[header.length + body.length];
        System.arraycopy(header, 0, packet, 0, header.length);
        System.arraycopy(body, 0, packet, header.length, body.length);
        server.input.add(packet);
    }

    public static synchronized String drain(String id) {
        Server server = require(id);
        synchronized (server) {
            if (server.error != null) throw new IllegalStateException(server.error);
            String bytes = Base64.getEncoder().encodeToString(server.output.toByteArray());
            server.output.reset();
            return bytes;
        }
    }

    public static synchronized void close(String id) throws IOException {
        Server server = servers.remove(id);
        if (server == null) return;
        server.input.add(new byte[0]);
        server.loader.close();
    }

    private static Server require(String id) {
        Server server = servers.get(id);
        if (server == null) throw new IllegalArgumentException("Unknown Java project");
        return server;
    }

    private static final class Server {
        final URLClassLoader loader;
        final LinkedBlockingQueue<byte[]> input = new LinkedBlockingQueue<>();
        final ByteArrayOutputStream output = new ByteArrayOutputStream();
        Thread thread;
        String error;
        final InputStream receive = new InputStream() {
            byte[] current = new byte[0];
            int position;
            public int read() throws IOException {
                if (position == current.length) {
                    try { current = input.take(); position = 0; }
                    catch (InterruptedException e) { Thread.currentThread().interrupt(); return -1; }
                    if (current.length == 0) return -1;
                }
                return current[position++] & 255;
            }
            public int read(byte[] target, int offset, int length) throws IOException {
                if (length == 0) return 0;
                int first = read();
                if (first < 0) return -1;
                target[offset] = (byte) first;
                int count = Math.min(length - 1, current.length - position);
                System.arraycopy(current, position, target, offset + 1, count);
                position += count;
                return count + 1;
            }
        };
        final OutputStream send = new OutputStream() {
            public void write(int value) { synchronized (Server.this) { output.write(value); } }
            public void write(byte[] bytes, int off, int len) { synchronized (Server.this) { output.write(bytes, off, len); } }
        };
        Server(URLClassLoader loader) { this.loader = loader; }
    }
}
