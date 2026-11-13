#!/bin/sh
set -eu
# Same Java contract and toolchain, separate output for this integration.
export JAVA_PROTO_OUT=simulator/runner/integrations/ms4me-java/wrapper/src/main/generated
exec sh simulator/runner/integrations/xdevs-java/generate-proto.sh
