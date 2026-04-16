FROM golang:1.26.2 AS builder

WORKDIR /app

COPY go.work ./
COPY back/go.mod back/go.sum ./back/
COPY simulator/coordinator/go.mod simulator/coordinator/go.sum ./simulator/coordinator/
COPY simulator/runner/go.mod simulator/runner/go.sum ./simulator/runner/
COPY simulator/shared/go.mod simulator/shared/go.sum ./simulator/shared/
COPY simulator/wrappers/go/go.mod simulator/wrappers/go/go.sum ./simulator/wrappers/go/

COPY back ./back
COPY simulator ./simulator

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    mkdir bin && \
    CGO_ENABLED=0 go build -ldflags="-s -w" -o ./bin/devsforge-backend -v ./back && \
    CGO_ENABLED=0 go build -ldflags="-s -w" -o ./bin/devsforge-coordinator -v ./simulator/coordinator && \
    CGO_ENABLED=0 go build -ldflags="-s -w" -o ./bin/devsforge-runner -v ./simulator/runner

FROM alpine:3.23.3 AS backend
WORKDIR /app
COPY --from=builder /app/bin/devsforge-backend /app/devsforge-backend
COPY --from=builder /app/back/database/migrations /app/database/migrations
ENV DB_MIGRATIONS_PATH=/app/database/migrations
EXPOSE 3000
CMD ["/app/devsforge-backend"]