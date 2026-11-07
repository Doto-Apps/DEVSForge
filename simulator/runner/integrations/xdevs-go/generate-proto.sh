#!/bin/sh
set -eu
protoc -I simulator/proto --go_out=simulator/shared/proto --go_opt=paths=source_relative --go-grpc_out=simulator/shared/proto --go-grpc_opt=paths=source_relative simulator/proto/devs.proto
