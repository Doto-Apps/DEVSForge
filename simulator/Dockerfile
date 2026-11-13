FROM golang:1.26.2 AS builder
WORKDIR /app
COPY go.work ./
COPY back/go.mod back/go.sum ./back/
COPY simulator ./simulator
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    mkdir bin && CGO_ENABLED=0 go build -ldflags="-s -w" -o bin/devsforge-coordinator ./simulator/coordinator && \
    CGO_ENABLED=0 go build -ldflags="-s -w" -o bin/devsforge-runner ./simulator/runner
FROM golang:1.26.2 AS go-tools
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build GOBIN=/tools go install golang.org/x/tools/gopls@v0.23.0

FROM node:24-slim AS node-tools
RUN npm install -g pyright@1.1.414
FROM eclipse-temurin:25-jdk AS jdt-jdk

FROM python:3.12-slim AS simulator
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openjdk-21-jdk-headless maven curl ca-certificates && \
    ln -s /usr/lib/jvm/java-21-openjdk-$(dpkg --print-architecture) /opt/java21 && rm -rf /var/lib/apt/lists/*
ENV JAVA_HOME=/opt/java21
ENV PATH="/opt/java21/bin:/usr/local/go/bin:/root/go/bin:${PATH}"
ENV LOG_DIR=/tmp/sim-logs PATHS_SIM_ROOT=/tmp/simulations SIMULATOR_CMD=/opt/devsforge/devsforge-coordinator PATHS_RUNNER_CMD=/opt/devsforge/devsforge-runner
ENV INTEGRATIONS_DIR=/opt/devsforge/integrations SHARED_GO_DIR=/opt/devsforge/shared
ENV GOMODCACHE=/opt/go-cache/mod GOCACHE=/opt/go-cache/build PYTHONPYCACHEPREFIX=/opt/python-cache
COPY --from=builder /usr/local/go /usr/local/go
# Dependency layers depend on their declarations, not on model/library source edits.
COPY simulator/runner/integrations/xdevs-python/wrapper/requirements.txt /tmp/requirements.txt
COPY simulator/runner/integrations/devsimpy-python/wrapper/requirements.txt /tmp/requirements-devsimpy.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt -r /tmp/requirements-devsimpy.txt
COPY simulator/runner/integrations/xdevs-go/wrapper/go.mod simulator/runner/integrations/xdevs-go/wrapper/go.sum /tmp/go-preheat/
COPY simulator/shared/go.mod simulator/shared/go.sum /tmp/go-preheat/.shared/
RUN cd /tmp/go-preheat && GOWORK=off go mod download && rm -rf /tmp/go-preheat
COPY simulator/runner/integrations/xdevs-java/wrapper/pom.xml /tmp/java-preheat/pom.xml
COPY simulator/runner/integrations/xdevs-java/wrapper/mvnw /tmp/java-preheat/mvnw
COPY simulator/runner/integrations/xdevs-java/wrapper/.mvn /tmp/java-preheat/.mvn
# Cache the same Maven distribution used when a model is compiled at runtime.
RUN cd /tmp/java-preheat && ./mvnw -Dmaven.repo.local=/opt/maven-cache dependency:go-offline -q && rm -rf /tmp/java-preheat
COPY simulator/runner/integrations/ms4me-java/wrapper/pom.xml simulator/runner/integrations/ms4me-java/wrapper/mvnw /tmp/ms4me-preheat/
COPY simulator/runner/integrations/ms4me-java/wrapper/.mvn /tmp/ms4me-preheat/.mvn
COPY simulator/runner/integrations/ms4me-java/wrapper/dependencies /tmp/ms4me-preheat/dependencies
COPY simulator/runner/integrations/ms4me-java/dependencies.sha256 /tmp/ms4me-preheat/dependencies.sha256
RUN cd /tmp/ms4me-preheat && sha256sum -c dependencies.sha256 && \
    ./mvnw -Dmaven.repo.local=/opt/maven-cache dependency:go-offline -q && rm -rf /tmp/ms4me-preheat
COPY --from=builder /app/bin/ /opt/devsforge/
COPY simulator/runner/integrations /opt/devsforge/integrations
COPY simulator/shared /opt/devsforge/shared
# Build the MS4 Me runtime once, outside the immutable catalogue resources.
RUN cp -a /opt/devsforge/integrations/ms4me-java/wrapper /tmp/ms4me-runtime && \
    cd /tmp/ms4me-runtime && ./mvnw -Dmaven.repo.local=/opt/maven-cache -B package -DskipTests -q && \
    mkdir -p /opt/devsforge/runtimes/ms4me-java && \
    cp target/runtime/ms4me-runtime.jar /opt/devsforge/runtimes/ms4me-java/ && rm -rf /tmp/ms4me-runtime
ENV MS4ME_RUNTIME_JAR=/opt/devsforge/runtimes/ms4me-java/ms4me-runtime.jar
# Compile framework dependencies once; analysis only loads user documents at runtime.
RUN cp -a /opt/devsforge/integrations/xdevs-go/wrapper /tmp/go-analysis-preheat && \
    cp -a /opt/devsforge/shared /tmp/go-analysis-preheat/.shared && \
    cd /tmp/go-analysis-preheat && GOWORK=off go build -mod=mod ./modeling ./rpc && \
    rm -rf /tmp/go-analysis-preheat && \
    python3 -m compileall -q /opt/devsforge/integrations/xdevs-python/wrapper/modeling \
        /opt/devsforge/integrations/devsimpy-python/wrapper
RUN mkdir -p /tmp/simulations /tmp/sim-logs
ENV MAVEN_OPTS=-Dmaven.repo.local=/opt/maven-cache
EXPOSE 8080
CMD ["/opt/devsforge/devsforge-coordinator", "--daemon"]

FROM simulator AS lsp
COPY --from=node-tools /usr/local/bin/node /usr/local/bin/node
COPY --from=node-tools /usr/local/lib/node_modules/pyright /opt/lsp/pyright
COPY --from=go-tools /tools/gopls /usr/local/bin/gopls
COPY --from=jdt-jdk /opt/java/openjdk /opt/lsp/jdk25
RUN ln -s /opt/lsp/pyright/langserver.index.js /usr/local/bin/pyright-langserver && \
    pip install --no-cache-dir ruff==0.17.3 && \
    mkdir -p /opt/lsp/jdtls /opt/lsp/bin && \
    curl -fsSL https://download.eclipse.org/jdtls/milestones/1.63.0/jdt-language-server-1.63.0-202610191322.tar.gz -o /tmp/jdtls.tar.gz && \
    echo 'b1f2abe0b3cccb462cf64fb4a5587c7d09df60cf8be7748b152cbd89d018bdc4  /tmp/jdtls.tar.gz' | sha256sum -c - && \
    tar -xzf /tmp/jdtls.tar.gz -C /opt/lsp/jdtls && rm /tmp/jdtls.tar.gz
COPY simulator/runner/internal/lsp/jdtls.sh /opt/lsp/bin/jdtls
RUN chmod +x /opt/lsp/bin/jdtls && mkdir -p /opt/python-cache /opt/go-cache/build && chmod -R a+rX /opt/devsforge /opt/go-cache && useradd --create-home --uid 10001 lsp && chown -R lsp:lsp /opt/go-cache/build /opt/python-cache
RUN mkdir -p /home/lsp/.m2 && ln -s /opt/maven-cache /home/lsp/.m2/repository && \
    chown -R lsp:lsp /home/lsp/.m2 /opt/maven-cache
ENV MAVEN_OPTS=-Dmaven.repo.local=/opt/maven-cache
ENV GOTOOLCHAIN=local
USER lsp
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD python3 -c 'import os,urllib.request; urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:8090/health",headers={"Authorization":"Bearer "+os.environ["LSP_INTERNAL_TOKEN"]}),timeout=3)'
CMD ["/opt/devsforge/devsforge-runner", "--lsp-daemon"]

FROM simulator AS development
RUN go install github.com/air-verse/air@v1.64.5
CMD ["air", "-c", ".air.toml", "--", "--daemon"]

FROM simulator AS runner
CMD ["/opt/devsforge/devsforge-runner"]

FROM simulator AS production
