import logging
import os
from concurrent import futures

import grpc
import requests
from pymongo import MongoClient, ReturnDocument

from tourism.stakeholders.v1 import stakeholders_pb2
from tourism.stakeholders.v1 import stakeholders_pb2_grpc
from tourism.auth.v1 import auth_pb2
from tourism.auth.v1 import auth_pb2_grpc

_SEAWEEDFS_FILER_URL = os.getenv("SEAWEEDFS_FILER_URL", "http://seaweedfs:8888")
_AUTH_SERVICE_ADDR = os.getenv("AUTH_SERVICE_ADDR", "auth-service:9090")
_MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongo:27017")
_MONGO_DB = os.getenv("MONGO_DB", "stakeholdersdb")
_GRPC_ADDR = os.getenv("GRPC_ADDR", "0.0.0.0:9090")


def _doc_to_profile(doc: dict) -> stakeholders_pb2.Profile:
    return stakeholders_pb2.Profile(
        user_id=doc.get("_id", ""),
        name=doc.get("name", ""),
        surname=doc.get("surname", ""),
        bio=doc.get("bio", ""),
        motto=doc.get("motto", ""),
        photo_url=doc.get("photo_url", ""),
    )


class StakeholderService(stakeholders_pb2_grpc.StakeholderServiceServicer):
    def __init__(self, db, auth_channel: grpc.Channel) -> None:
        self._profiles = db.get_collection("profiles")
        self._auth_stub = auth_pb2_grpc.AuthServiceStub(auth_channel)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _require_auth(self, context: grpc.ServicerContext):
        """Validate the Bearer token in gRPC metadata.

        Returns the auth.User on success.
        Aborts the RPC with UNAUTHENTICATED on failure,
        so callers do not need to check the return value.
        """
        meta = dict(context.invocation_metadata())
        authorization = meta.get("authorization", "")
        if not authorization.lower().startswith("bearer "):
            context.abort(grpc.StatusCode.UNAUTHENTICATED, "missing authorization header")
        token = authorization.split(" ", 1)[1]
        try:
            resp = self._auth_stub.Validate(
                auth_pb2.ValidateRequest(access_token=token)
            )
        except grpc.RpcError as exc:
            logging.warning("auth.Validate RPC failed: %s", exc)
            context.abort(grpc.StatusCode.UNAUTHENTICATED, "could not reach auth service")
        if not resp.valid:
            context.abort(grpc.StatusCode.UNAUTHENTICATED, "invalid or expired token")
        return resp.user

    # ------------------------------------------------------------------
    # RPC impl
    # ------------------------------------------------------------------

    def GetProfile(self, request, context):
        user_id = request.user_id
        if not user_id:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "user_id is required")

        doc = self._profiles.find_one({"_id": user_id})
        if doc is None:
            # Return an empty profile rather than NOT_FOUND — profile is
            # auto-created on first UpdateProfile call.
            return stakeholders_pb2.Profile(user_id=user_id)
        return _doc_to_profile(doc)

    def UpdateProfile(self, request, context):
        user = self._require_auth(context)

        user_id = request.user_id
        if not user_id:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "user_id is required")
        if user.id != user_id:
            context.abort(
                grpc.StatusCode.PERMISSION_DENIED,
                "cannot update another user's profile",
            )

        # Build $set from only the optional fields that were explicitly provided.
        update_fields: dict = {}
        for field in ("name", "surname", "bio", "motto"):
            if request.HasField(field):
                update_fields[field] = getattr(request, field)
        if request.HasField("photo_url"):
            photo_url = request.photo_url
            if photo_url and not photo_url.startswith(_SEAWEEDFS_FILER_URL):
                context.abort(
                    grpc.StatusCode.INVALID_ARGUMENT,
                    "photo_url must point to the SeaweedFS Filer",
                )
            update_fields["photo_url"] = photo_url

        if not update_fields:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "no fields to update")

        doc = self._profiles.find_one_and_update(
            {"_id": user_id},
            {"$set": update_fields},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        return _doc_to_profile(doc)

    def DeleteProfilePhoto(self, request, context):
        user = self._require_auth(context)

        user_id = request.user_id
        if not user_id:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "user_id is required")
        if user.id != user_id:
            context.abort(
                grpc.StatusCode.PERMISSION_DENIED,
                "cannot update another user's profile",
            )

        doc = self._profiles.find_one({"_id": user_id})
        if doc and doc.get("photo_url"):
            photo_url = doc["photo_url"]
            if photo_url.startswith(_SEAWEEDFS_FILER_URL):
                try:
                    requests.delete(photo_url, timeout=5)
                except Exception as exc:
                    logging.warning("failed to delete photo from SeaweedFS: %s", exc)

        # Clear photo_url regardless of whether the file deletion succeeded.
        doc = self._profiles.find_one_and_update(
            {"_id": user_id},
            {"$unset": {"photo_url": ""}},
            upsert=False,
            return_document=ReturnDocument.AFTER,
        )
        if doc is None:
            return stakeholders_pb2.Profile(user_id=user_id)
        return _doc_to_profile(doc)


def serve() -> None:
    db = MongoClient(_MONGO_URI)[_MONGO_DB]

    auth_channel = grpc.insecure_channel(_AUTH_SERVICE_ADDR)

    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    stakeholders_pb2_grpc.add_StakeholderServiceServicer_to_server(
        StakeholderService(db, auth_channel), server
    )
    server.add_insecure_port(_GRPC_ADDR)
    server.start()

    logging.info("stakeholders-service listening on %s", _GRPC_ADDR)
    server.wait_for_termination()


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s"
    )
    serve()
