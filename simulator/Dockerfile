FROM golang:1.26.2 AS builder

WORKDIR /app

COPY go.work ./
COPY back/go.mod back/go.sum ./back/
COPY simulator/coordinator/go.mod simulator/coordinator/go.sum ./simulator/coordinator/
COPY simulator/runner/go.mod simulator/runner/go.sum ./simulator/runner/
COPY simulator/shared/go.mod simulator/shared/go.sum ./simulator/shared/
COPY simulator/wrappers/go/go.mod simulator/wrappers/go/go.sum ./simulator/wrappers/go/

COPY simulator ./simulator

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    mkdir bin && \
    CGO_ENABLED=0 go build -ldflags="-s -w" -o ./bin/devsforge-coordinator -v ./simulator/coordinator && \
    CGO_ENABLED=0 go build -ldflags="-s -w" -o ./bin/devsforge-runner -v ./simulator/runner

FROM python:3.12-slim AS simulator
ENV LOG_DIR="/app/sim-logs"
ENV PATHS_SIM_ROOT="/app"
ENV SIMULATOR_CMD="/app/devsforge-coordinator"
ENV PATHS_RUNNER_CMD="/app/devsforge-runner"

WORKDIR /app


# Install Java 21 and Maven
RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-21-jdk-headless \
    maven \
    && rm -rf /var/lib/apt/lists/*
# Set Java environment
ENV JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
ENV PATH="/usr/lib/jvm/java-21-openjdk-amd64/bin:${PATH}"

# GO environment
COPY --from=builder /usr/local/go /usr/local/go
ENV PATH="/usr/local/go/bin:/root/go/bin:${PATH}"
ENV GOMODCACHE=/opt/go-cache/mod
ENV GOCACHE=/opt/go-cache/build
RUN mkdir -p $GOMODCACHE $GOCACHE && chmod -R 777 /opt/go-cache


# python deps install and cache
COPY simulator/wrappers/python/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
ENV PYTHONPYCACHEPREFIX=/opt/python-cache
RUN mkdir -p /opt/python-cache && chmod -R 777 /opt/python-cache
# Cache preexisting files
COPY --from=builder /app/simulator/wrappers /app/wrappers
RUN python3 -m compileall ./app/wrappers/python

# Cache deps and preexisiting files
COPY --from=builder /app/simulator/wrappers/go /tmp/go-preheat-wrappers
WORKDIR /tmp/go-preheat-wrappers
RUN go build all || true && rm -rf /tmp/go-preheat-wrappers

# Cache Java wrapper dependencies
COPY --from=builder /app/simulator/wrappers/java /tmp/java-preheat-wrappers
WORKDIR /tmp/java-preheat-wrappers
RUN mvn dependency:resolve -q || true && rm -rf /tmp/java-preheat-wrappers

WORKDIR /app
COPY --from=builder /app/bin/devsforge-runner /app/devsforge-runner
COPY --from=builder /app/bin/devsforge-coordinator /app/devsforge-coordinator
EXPOSE 8080
VOLUME [ "/app/sim-logs" ]
CMD ["/app/devsforge-coordinator", "--daemon"]
