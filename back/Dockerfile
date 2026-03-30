FROM golang:1.25.4 AS builder

WORKDIR /app

COPY go.work ./
COPY back/go.mod back/go.sum* ./back/
COPY simulator/coordinator/go.mod simulator/coordinator/go.sum* ./simulator/coordinator/
COPY simulator/runner/go.mod simulator/runner/go.sum* ./simulator/runner/
COPY simulator/shared/go.mod simulator/shared/go.sum* ./simulator/shared/
COPY simulator/wrappers/go/go.mod simulator/wrappers/go/go.sum* ./simulator/wrappers/go/

RUN cd back && go mod download && \
    cd /app/simulator/coordinator && go mod download && \
    cd /app/simulator/runner && go mod download && \
    cd /app/simulator/shared && go mod download && \
    cd /app/simulator/wrappers/go && go mod download

COPY back ./back
COPY simulator ./simulator

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    mkdir bin && \
    CGO_ENABLED=0 go build -ldflags="-s -w" -o ./bin/devsforge-backend -v ./back && \
    CGO_ENABLED=0 go build -ldflags="-s -w" -o ./bin/devsforge-coordinator -v ./simulator/coordinator && \
    CGO_ENABLED=0 go build -ldflags="-s -w" -o ./bin/devsforge-runner -v ./simulator/runner

# Backend target
FROM alpine:3.23.3 AS backend
WORKDIR /app
COPY --from=builder /app/bin/devsforge-backend /app/devsforge-backend
EXPOSE 3000
CMD ["/app/devsforge-backend"]


# Coordinator target
FROM alpine:3.23.3 AS coordinator
WORKDIR /app
COPY --from=builder /app/bin/devsforge-coordinator /app/devsforge-coordinator
EXPOSE 8080
VOLUME [ "/sim-logs" ]
CMD ["/app/devsforge-coordinator", "--daemon"]

# Runner target
FROM python:3.12-slim AS runner
WORKDIR /app
COPY --from=builder /usr/local/go /usr/local/go
ENV PATH="/usr/local/go/bin:${PATH}"
# Go cache env
ENV GOMODCACHE=/opt/go-cache/mod
ENV GOCACHE=/opt/go-cache/build
RUN mkdir -p $GOMODCACHE $GOCACHE && chmod -R 777 /opt/go-cache
# python deps install and cache
RUN pip install --no-cache-dir grpcio grpcio-tools protobuf
ENV PYTHONPYCACHEPREFIX=/opt/python-cache
RUN mkdir -p /opt/python-cache && chmod -R 777 /opt/python-cache
COPY --from=builder /app/simulator/wrappers /app/wrappers
# Cache preexisting files
RUN python3 -m compileall ./app/wrappers/python
# Cache deps and preexisiting files
COPY --from=builder /app/simulator/wrappers/go /tmp/go-preheat-wrappers
RUN cd /tmp/go-preheat-wrappers && go mod download && go build all || true && rm -rf /tmp/go-preheat-wrappers
COPY --from=builder /app/bin/devsforge-runner /app/devsforge-runner
CMD ["/app/devsforge-runner"]

# Simulator target
FROM runner AS simulator
COPY --from=builder /app/bin/devsforge-coordinator /app/devsforge-coordinator
EXPOSE 8080
VOLUME [ "/sim-logs" ]
CMD ["/app/devsforge-coordinator", "--daemon"]

# All in one image target
FROM runner AS all-in-one
COPY --from=builder /app/bin/devsforge-backend /app/devsforge-backend
COPY --from=builder /app/bin/devsforge-coordinator /app/devsforge-coordinator
EXPOSE 3000
VOLUME [ "/sim-logs" ]
CMD ["/app/devsforge-backend"]