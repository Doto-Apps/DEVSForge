#!/bin/sh
set -eu
PYTHON_PROTO_OUT=simulator/runner/integrations/devsimpy-python/wrapper/proto \
  sh simulator/runner/integrations/xdevs-python/generate-proto.sh
