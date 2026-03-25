FROM golang:1.25

WORKDIR /app

# Python runtime for wrapper-related dependencies used by simulator processes.
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip && \
    pip3 install --break-system-packages grpcio grpcio-tools protobuf && \
    rm -rf /var/lib/apt/lists/*

COPY go.work ./go.work
COPY back ./back
COPY simulator ./simulator

WORKDIR /app/back

RUN go mod download
RUN cd /app/simulator/coordinator && go mod download
RUN cd /app/simulator/runner && go mod download

ENV NODE_ENV=production
ENV COORDINATOR_PATH=/app/simulator/coordinator

EXPOSE 3000

CMD ["go", "run", "."]
