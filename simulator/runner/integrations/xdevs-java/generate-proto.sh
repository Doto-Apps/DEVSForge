#!/bin/sh
set -eu
: "${GRPC_JAVA_PLUGIN:?Set GRPC_JAVA_PLUGIN to the protoc-gen-grpc-java 1.60.0 executable for your OS}"
protoc_java=${PROTOC_JAVA:-protoc}
[ "$("$protoc_java" --version)" = "libprotoc 34.1" ] || { echo "Use protoc 34.1 (set PROTOC_JAVA to its executable)" >&2; exit 1; }
out=${JAVA_PROTO_OUT:-simulator/runner/integrations/xdevs-java/wrapper/src/main/generated}
"$protoc_java" -I simulator/proto --java_out="$out" --grpc-java_out="$out" --plugin="protoc-gen-grpc-java=$GRPC_JAVA_PLUGIN" simulator/proto/devs.proto
