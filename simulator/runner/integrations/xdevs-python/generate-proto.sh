#!/bin/sh
set -eu
out=${PYTHON_PROTO_OUT:-simulator/runner/integrations/xdevs-python/wrapper/proto}
python3 -m grpc_tools.protoc -I simulator/proto --python_out="$out" --grpc_python_out="$out" simulator/proto/devs.proto
python3 -c 'from pathlib import Path; import sys; p=Path(sys.argv[1])/"devs_pb2_grpc.py"; p.write_text(p.read_text().replace("import devs_pb2 as", "from . import devs_pb2 as"))' "$out"
