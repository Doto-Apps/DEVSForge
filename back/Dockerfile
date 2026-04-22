FROM golang:1.26.2 AS builder

WORKDIR /app

COPY go.work ./
COPY back ./back
COPY simulator/shared ./simulator/shared

COPY simulator/coordinator/go.mod simulator/coordinator/go.sum ./simulator/coordinator/
COPY simulator/runner/go.mod simulator/runner/go.sum ./simulator/runner/
COPY simulator/wrappers/go/go.mod simulator/wrappers/go/go.sum ./simulator/wrappers/go/

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    mkdir bin && \
    CGO_ENABLED=0 go build -ldflags="-s -w" -o ./bin/devsforge-backend -v ./back 

FROM alpine:3.23.3 AS backend
WORKDIR /app
COPY --from=builder /app/bin/devsforge-backend /app/devsforge-backend
COPY --from=builder /app/back/database/migrations /app/database/migrations
ENV DB_MIGRATIONS_PATH=/app/database/migrations
EXPOSE 3000
CMD ["/app/devsforge-backend"]
