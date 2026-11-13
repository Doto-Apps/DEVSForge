# SPDX-License-Identifier: MIT
"""Expose a native PyPDEVS atomic over DEVSForge's common RPC API."""
import argparse
import json
import logging
import os

from bridge import serve


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", required=True)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="[DEVSimPy] %(message)s")
    serve(json.loads(args.json), port=int(os.environ["GRPC_PORT"]))
