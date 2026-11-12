FROM golang:1.26.2 AS builder
WORKDIR /app
COPY go.work ./
COPY back/go.mod back/go.sum ./back/
COPY simulator ./simulator
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    mkdir bin && CGO_ENABLED=0 go build -ldflags="-s -w" -o bin/devsforge-coordinator ./simulator/coordinator && \
    CGO_ENABLED=0 go build -ldflags="-s -w" -o bin/devsforge-runner ./simulator/runner
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
RUN pip install --no-cache-dir -r /tmp/requirements.txt
COPY simulator/runner/integrations/xdevs-go/wrapper/go.mod simulator/runner/integrations/xdevs-go/wrapper/go.sum /tmp/go-preheat/
COPY simulator/shared/go.mod simulator/shared/go.sum /tmp/go-preheat/.shared/
RUN cd /tmp/go-preheat && GOWORK=off go mod download && rm -rf /tmp/go-preheat
COPY simulator/runner/integrations/xdevs-java/wrapper/pom.xml /tmp/java-preheat/pom.xml
COPY simulator/runner/integrations/xdevs-java/wrapper/mvnw /tmp/java-preheat/mvnw
COPY simulator/runner/integrations/xdevs-java/wrapper/.mvn /tmp/java-preheat/.mvn
# Cache the same Maven distribution used when a model is compiled at runtime.
RUN cd /tmp/java-preheat && ./mvnw -Dmaven.repo.local=/opt/maven-cache dependency:go-offline -q && rm -rf /tmp/java-preheat
COPY --from=builder /app/bin/ /opt/devsforge/
COPY simulator/runner/integrations /opt/devsforge/integrations
COPY simulator/shared /opt/devsforge/shared
# Compile framework dependencies once; analysis only loads user documents at runtime.
RUN cp -a /opt/devsforge/integrations/xdevs-go/wrapper /tmp/go-analysis-preheat && \
    cp -a /opt/devsforge/shared /tmp/go-analysis-preheat/.shared && \
    cd /tmp/go-analysis-preheat && GOWORK=off go build -mod=mod ./modeling ./rpc && \
    rm -rf /tmp/go-analysis-preheat && \
    python3 -m compileall -q /opt/devsforge/integrations/xdevs-python/wrapper/modeling
RUN mkdir -p /tmp/simulations /tmp/sim-logs
ENV MAVEN_OPTS=-Dmaven.repo.local=/opt/maven-cache
EXPOSE 8080
CMD ["/opt/devsforge/devsforge-coordinator", "--daemon"]

FROM simulator AS development
RUN go install github.com/air-verse/air@v1.64.5
CMD ["air", "-c", ".air.toml", "--", "--daemon"]

FROM simulator AS runner
CMD ["/opt/devsforge/devsforge-runner"]

FROM simulator AS production
