import logging
import os
from concurrent import futures
from datetime import datetime, timezone

import grpc
from pymongo import MongoClient, ReturnDocument

from tourism.simulator.v1 import simulator_pb2, simulator_pb2_grpc
from tourism.auth.v1 import auth_pb2, auth_pb2_grpc

logging.basicConfig(level=logging.INFO)

_GRPC_ADDR = os.environ.get("GRPC_ADDR", "0.0.0.0:9090")
_MONGO_URI = os.environ.get("MONGO_URI", "mongodb://mongo:27017")
_MONGO_DB = os.environ.get("MONGO_DB", "simulatordb")
_AUTH_SERVICE_ADDR = os.environ.get("AUTH_SERVICE_ADDR", "auth-service:9090")


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


class SimulatorService(simulator_pb2_grpc.SimulatorServiceServicer):
    def __init__(self, db, auth_channel: grpc.Channel) -> None:
        self._positions = db.get_collection("positions")
        self._auth_stub = auth_pb2_grpc.AuthServiceStub(auth_channel)

    def _require_auth(self, context):
        meta = dict(context.invocation_metadata())
        auth_header = meta.get("authorization", "")
        if not auth_header.lower().startswith("bearer "):
            context.abort(grpc.StatusCode.UNAUTHENTICATED, "missing bearer token")
        token = auth_header[len("bearer "):]
        try:
            resp = self._auth_stub.Validate(
                auth_pb2.ValidateRequest(access_token=token)
            )
        except grpc.RpcError as exc:
            context.abort(grpc.StatusCode.UNAUTHENTICATED, "auth service unavailable")
        if not resp.valid:
            context.abort(grpc.StatusCode.UNAUTHENTICATED, "invalid token")
        return resp.user

    def UpdatePosition(self, request, context):
        user = self._require_auth(context)

        if "tourist" not in user.roles:
            context.abort(grpc.StatusCode.PERMISSION_DENIED, "Samo turisti mogu koristiti simulator pozicije.")
        
        doc = self._positions.find_one_and_update(
            {"_id": user.id},
            {"$set": {
                "latitude": request.latitude,
                "longitude": request.longitude,
                "updated_at": _now_iso()
            }},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )

        return simulator_pb2.Position(
            user_id=doc["_id"],
            latitude=doc["latitude"],
            longitude=doc["longitude"],
            updated_at=doc["updated_at"]
        )

    def GetPosition(self, request, context):
        user = self._require_auth(context)
        
        doc = self._positions.find_one({"_id": user.id})
        if doc is None:
            context.abort(grpc.StatusCode.NOT_FOUND, "Lokacija nije prethodno definisana")
            
        return simulator_pb2.Position(
            user_id=doc["_id"],
            latitude=doc["latitude"],
            longitude=doc["longitude"],
            updated_at=doc["updated_at"]
        )

def serve():
    db = MongoClient(_MONGO_URI)[_MONGO_DB]
    auth_channel = grpc.insecure_channel(_AUTH_SERVICE_ADDR)

    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    simulator_pb2_grpc.add_SimulatorServiceServicer_to_server(
        SimulatorService(db, auth_channel), server
    )
    server.add_insecure_port(_GRPC_ADDR)
    server.start()
    logging.info("Simulator service listening on %s", _GRPC_ADDR)
    server.wait_for_termination()

if __name__ == "__main__":
    serve()