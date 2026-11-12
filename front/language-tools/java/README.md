# Java analysis with B-JVM

The editor runs the real Javacs language server inside B-JVM WebAssembly.
It does not execute user models. Simulation still uses the existing Java 21
wrapper on the simulator.

## Build and update

From the repository root, run `task front:language-tools`. The Java stages in
`front/Dockerfile` pin B-JVM, Emscripten, Javacs and Temurin OpenJDK. Generated
assets go to `front/public/language-tools/java/` and are ignored by Git.

- `bjvm.patch` applies to the pinned B-JVM revision. It fixes synchronous class
  initialization, catch-type resolution in user class loaders, module package
  ownership, nest hosts, weak references, the wall clock and the filesystem
  operations used by javac. The clock must advance for changed-source caches
  to invalidate and diagnostics to refresh. The patch also
  fixes downloads when HTTP compression changes `Content-Length`.
- `browser.patch` applies to the pinned Javacs revision. It builds for Java 23,
  selects the embedded compiler directly, uses the VM's Java home and discards
  compiler contexts whose private cleanup method cannot be called.
- `build-runtime.sh` creates a trimmed OpenJDK image and a bootstrap class JAR.
  No JDK test binaries from the B-JVM repository are redistributed. Console JUL
  logging is disabled because B-JVM lacks its stack walker; LSP diagnostics
  remain enabled.
- `BrowserBridge.java` is only transport and project isolation. LSP input and
  output cross the JS/Java boundary as ASCII base64 containing UTF-8 bytes.
  This avoids B-JVM's modified-UTF-8 string interop for user text.

Rebase both patches when updating their upstream revisions. Keep their upstream
copyright notices and the generated license files. Run `task front:lsp:test`
after rebuilding; it checks actual SDK/standard-library completions, Unicode
positions, isolated projects, diagnostics, navigation and worker cleanup.

## Lifecycle and limits

`java.worker.ts` loads local static assets; it contacts no external Java CDN.
One worker/JVM is shared per account/window/integration/version. Each model has
its own directory and Javacs class loader because Javacs maintains static
indexes. Opening a homonymous model therefore does not merge its symbols with
another model. Switching tabs reuses the worker and projects.

The server thread is non-daemon so B-JVM keeps scheduling the idle diagnostic
pass between JS calls. Its reader remains a daemon; closing the bridge input
ends the server loop.

Closing a document ends its LSP transport and removes its project files. B-JVM
does not currently unload all class-loader metadata. Closing the last Java
document or the workspace terminates the worker and frees the entire VM.
The initial Java heap is 256 MiB; this is not the total worker memory.

B-JVM is experimental. The runtime currently contains `java.base`,
`java.compiler`, `jdk.compiler`, `jdk.zipfs`, `java.logging`, `java.xml` and
`jdk.unsupported`. This does not provide every native Java API or Maven package.
Analysis uses OpenJDK 23 whereas the simulator compiles with Java 21: final
validation must use the simulator. JDK source navigation is not bundled.

B-JVM and Javacs are MIT; OpenJDK and the OpenJDK-derived portions of Javacs
retain GPL-2.0 with the Classpath exception. See `../NOTICE.md` and the notices
shipped with the generated tools. All Java runtime assets are served locally;
the MIT license does not change the licenses of the JDK or other engines.
