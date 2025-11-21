# simulator/wrappers/python/rpc/devs_model_server.py

from concurrent import futures
from typing import Optional, Any, List
import json

import grpc
from google.protobuf.empty_pb2 import Empty

from simulator.proto.python import devs_pb2, devs_pb2_grpc
from simulator.wrappers.python.modeling.modeling import Atomic  # ton runtime Python


class DevsModelServer(devs_pb2_grpc.AtomicModelServiceServicer):
    """
    Équivalent Python de DEVSModelServer (Go).

    Il expose un modèle Atomic (Python) via le service gRPC AtomicModelService.
    Les valeurs circulent maintenant sous forme **JSON** sur le réseau :
    - Output : les valeurs des ports sont sérialisées en JSON (list[str]).
    - AddInput : value_json est désérialisé en objet Python avant d'être ajouté au port.
    """

    def __init__(self, model: Atomic) -> None:
        self._model = model

    # Initialize correspond à Component.Initialize()
    def Initialize(self, request: Empty, context: grpc.ServicerContext) -> Empty:
        self._model.initialize()
        return Empty()

    # Finalize correspond à Component.Exit()
    def Finalize(self, request: Empty, context: grpc.ServicerContext) -> Empty:
        self._model.exit()
        return Empty()

    # TimeAdvance correspond à TA()
    def TimeAdvance(
        self, request: Empty, context: grpc.ServicerContext
    ) -> devs_pb2.TimeAdvanceResponse:
        sigma = self._model.ta()
        return devs_pb2.TimeAdvanceResponse(sigma=sigma)

    # InternalTransition correspond à DeltInt()
    def InternalTransition(self, request: Empty, context: grpc.ServicerContext) -> Empty:
        self._model.delt_int()
        return Empty()

    # ExternalTransition correspond à DeltExt(e)
    def ExternalTransition(
        self, request: devs_pb2.ElapsedTime, context: grpc.ServicerContext
    ) -> Empty:
        e = request.value
        self._model.delt_ext(e)
        return Empty()

    # ConfluentTransition correspond à DeltCon(e)
    def ConfluentTransition(
        self, request: devs_pb2.ElapsedTime, context: grpc.ServicerContext
    ) -> Empty:
        e = request.value
        self._model.delt_con(e)
        return Empty()

    # Output correspond à Lambda()
    # On lit les ports de sortie et on renvoie les valeurs au runner.
    # ⚠️ Comme en Go, on sérialise chaque valeur en JSON.
    def Output(
        self, request: Empty, context: grpc.ServicerContext
    ) -> devs_pb2.OutputResponse:
        # On laisse le modèle calculer ses sorties
        self._model.lambda_()

        resp = devs_pb2.OutputResponse()

        # Récupération des ports de sortie via Component.get_ports("out")
        port_type = "out"
        for port in self._model.get_ports(port_type):
            port_name = port.get_name()

            values = port.get_values()  # on s'attend à une List[Any]
            if not isinstance(values, list):
                context.abort(
                    grpc.StatusCode.INTERNAL,
                    f"port {port_name} n'a pas un type list (type réel: {type(values)})",
                )

            values_json: List[str] = []
            for v in values:
                try:
                    # Équivalent du json.Marshal(value) côté Go
                    values_json.append(json.dumps(v))
                except TypeError as exc:
                    context.abort(
                        grpc.StatusCode.INTERNAL,
                        f"Cannot JSON-encode value for port {port_name}: {exc}",
                    )

            out = devs_pb2.PortOutput(
                port_name=port_name,
                values_json=values_json,
            )
            resp.outputs.append(out)

            # Optionnel : vider le port après lecture
            # port.clear()

        return resp

    # AddInput permet d'ajouter une valeur dans un port d'entrée du modèle.
    # ⚠️ Comme en Go, on reçoit un JSON (string) et on le transforme en objet Python.
    def AddInput(
        self, request: devs_pb2.InputMessage, context: grpc.ServicerContext
    ) -> Empty:
        port_name = request.port_name
        value_json = request.value_json  # string JSON

        try:
            # Symétrique de json.Unmarshal côté Go (si tu le fais dans Port.AddValue)
            value: Any = json.loads(value_json)
        except json.JSONDecodeError as exc:
            context.abort(
                grpc.StatusCode.INVALID_ARGUMENT,
                f"invalid JSON for value_json on port {port_name}: {exc}",
            )

        try:
            in_port = self._model.get_port_by_name(port_name)
        except KeyError:
            context.abort(
                grpc.StatusCode.NOT_FOUND,
                f"input port {port_name} not found",
            )

        # Le port est supposé contenir des valeurs typées (list[Any])
        in_port.add_value(value)

        return Empty()

    def __str__(self) -> str:
        return f"DevsModelServer(model={self._model.get_name()})"


# Optionnel : petite fonction utilitaire pour lancer le serveur gRPC
def serve(
    model: Atomic,
    host: str = "127.0.0.1",
    port: int = 50051,
    max_workers: int = 10,
) -> None:
    """
    Lance un serveur gRPC pour un modèle donné.

    Exemple d'usage :
        model = GeneratorIncremental(...)  # ton modèle Atomic
        serve(model, host="127.0.0.1", port=50051)
    """
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=max_workers))
    devs_pb2_grpc.add_AtomicModelServiceServicer_to_server(
        DevsModelServer(model),
        server,
    )
    server.add_insecure_port(f"{host}:{port}")
    server.start()
    print(f"[PY-WRAPPER] gRPC server running on {host}:{port} for model {model.get_name()}")
    server.wait_for_termination()
