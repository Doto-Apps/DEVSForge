import argparse
import json
import logging
import os

from rpc.devsModelServer import serve  # ton serveur gRPC Python
from model import NewModel  # fonction NewModel(cfg) dans model.py


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="[PY-WRAPPER] %(message)s")
    logging.info("wrapper starting (PID=%s)", os.getpid())
    logging.info("======================================")
    logging.info("   ⚙️ Wrapper RPC for model Generator Incremental")
    logging.info("======================================")

    parser = argparse.ArgumentParser()
    parser.add_argument("--json", required=True, help="JSON string to parse")
    args = parser.parse_args()

    # Parse le JSON en dict. À toi de mapper ça vers ta structure dans NewModel.
    config = json.loads(args.json)

    # Création du modèle utilisateur (implémenté dans model.py)
    model = NewModel(config)

    # Récupération du port gRPC : priorité à l'env, sinon valeur par défaut compilée
    port_str = os.environ.get("GRPC_PORT", "58797")
    try:
        port = int(port_str)
    except ValueError:
        raise SystemExit(f"Invalid GRPC_PORT value: {port_str!r}")

    host = "127.0.0.1"

    logging.info("Starting gRPC server on %s:%d", host, port)
    serve(model, host=host, port=port)


if __name__ == "__main__":
    main()
