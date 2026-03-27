FROM golang:1.25.4 as builder

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
    go build -o ./bin/devsforge-backend -v ./back && \
    go build -o ./bin/devsforge-coordinator -v ./simulator/coordinator && \
    go build -o ./bin/devsforge-runner -v ./simulator/runner


FROM ubuntu:24.04

# Python runtime for wrapper-related dependencies used by simulator processes.
RUN apt-get update && apt-get install -y --no-install-recommends golang python3 python3-pip && \
    pip3 install --no-cache-dir --break-system-packages grpcio grpcio-tools protobuf && \
    rm -rf /var/lib/apt/lists/*


COPY --from=builder /app/bin/devsforge-backend /devsforge-backend
COPY --from=builder /app/bin/devsforge-coordinator /devsforge-coordinator
COPY --from=builder /app/bin/devsforge-runner /devsforge-runner
COPY --from=builder /app/simulator/wrappers /wrappers


EXPOSE 3000

CMD ["./devsforge-backend"]