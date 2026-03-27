FROM golang:1.25 as builder

WORKDIR /app

COPY go.work ./go.work
COPY back ./back
COPY simulator ./simulator
RUN mkdir bin && \
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