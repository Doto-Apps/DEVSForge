#!/bin/sh
set -eu
out=simulator/runner/integrations/xdevs-python/wrapper/proto
python3 -m grpc_tools.protoc -I simulator/proto --python_out="$out" --grpc_python_out="$out" simulator/proto/devs.proto
python3 -c 'from pathlib import Path; p=Path("simulator/runner/integrations/xdevs-python/wrapper/proto/devs_pb2_grpc.py"); p.write_text(p.read_text().replace("import devs_pb2 as", "from . import devs_pb2 as"))'
