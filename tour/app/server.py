import logging
import math
import os
from concurrent import futures
from datetime import datetime, timezone
from uuid import uuid4

import grpc
import requests
from pymongo import MongoClient
from pymongo.collection import ReturnDocument

from tourism.auth.v1 import auth_pb2_grpc, auth_pb2
from tourism.tour.v1 import tour_pb2, tour_pb2_grpc

logging.basicConfig(level=logging.INFO)

_GRPC_ADDR = os.environ.get("GRPC_ADDR", "0.0.0.0:9090")
_MONGO_URI = os.environ.get("MONGO_URI", "mongodb://mongo:27017")
_MONGO_DB = os.environ.get("MONGO_DB", "tourdb")
_AUTH_SERVICE_ADDR = os.environ.get("AUTH_SERVICE_ADDR", "auth-service:9090")
_SEAWEEDFS_FILER_URL = os.environ.get("SEAWEEDFS_FILER_URL", "http://seaweedfs:8888")

_STATUS_MAP = {
    "draft": tour_pb2.TOUR_STATUS_DRAFT,
    "published": tour_pb2.TOUR_STATUS_PUBLISHED,
    "archived": tour_pb2.TOUR_STATUS_ARCHIVED,
}

_STATUS_NAME = {v: k for k, v in _STATUS_MAP.items()}

_TRANSPORT_MAP = {
    tour_pb2.TRANSPORT_TYPE_FOOT: "foot",
    tour_pb2.TRANSPORT_TYPE_BICYCLE: "bicycle",
    tour_pb2.TRANSPORT_TYPE_CAR: "car",
}

_TRANSPORT_NAME = {v: k for k, v in _TRANSPORT_MAP.items()}


def _haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _tour_length_km(keypoints):
    total = 0.0
    for i in range(1, len(keypoints)):
        total += _haversine_km(
            keypoints[i - 1]["latitude"],
            keypoints[i - 1]["longitude"],
            keypoints[i]["latitude"],
            keypoints[i]["longitude"],
        )
    return total


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


class TourService(tour_pb2_grpc.TourServiceServicer):
    def __init__(self, db, auth_channel: grpc.Channel, seaweedfs_url: str) -> None:
        self._tours = db.get_collection("tours")
        self._auth_stub = auth_pb2_grpc.AuthServiceStub(auth_channel)
        self._seaweedfs_url = seaweedfs_url

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
            logging.warning("auth validation failed: %s", exc)
            context.abort(grpc.StatusCode.UNAUTHENTICATED, "auth service unavailable")
        if not resp.valid:
            context.abort(grpc.StatusCode.UNAUTHENTICATED, "invalid token")
        return resp.user

    def _require_role(self, user, role: str, context):
        if role not in user.roles:
            context.abort(
                grpc.StatusCode.PERMISSION_DENIED,
                f"role '{role}' required",
            )

    def _doc_to_tour(self, doc, *, full=True):
        keypoints_raw = doc.get("keypoints", [])
        if not full:
            keypoints_raw = keypoints_raw[:1]

        keypoints = [
            tour_pb2.Keypoint(
                name=kp.get("name", ""),
                description=kp.get("description", ""),
                latitude=kp.get("latitude", 0.0),
                longitude=kp.get("longitude", 0.0),
                order=kp.get("order", 0),
            )
            for kp in keypoints_raw
        ]

        transport_times = [
            tour_pb2.TransportTime(
                transport=_TRANSPORT_NAME.get(tt.get("transport", ""), tour_pb2.TRANSPORT_TYPE_UNSPECIFIED),
                minutes=tt.get("minutes", 0),
            )
            for tt in doc.get("transport_times", [])
        ]

        reviews = [
            tour_pb2.Review(
                id=str(r.get("id", "")),
                tourist_id=r.get("tourist_id", ""),
                tourist_username=r.get("tourist_username", ""),
                rating=r.get("rating", 0),
                comment=r.get("comment", ""),
                visit_date=r.get("visit_date", ""),
                created_at=r.get("created_at", ""),
                image_urls=r.get("image_urls", []),
            )
            for r in doc.get("reviews", [])
        ]

        return tour_pb2.Tour(
            id=str(doc["_id"]),
            author_id=doc.get("author_id", ""),
            name=doc.get("name", ""),
            description=doc.get("description", ""),
            difficulty=doc.get("difficulty", 0),
            tags=doc.get("tags", []),
            status=_STATUS_MAP.get(doc.get("status", ""), tour_pb2.TOUR_STATUS_UNSPECIFIED),
            price=doc.get("price", 0.0),
            length_km=doc.get("length_km", 0.0),
            published_at=doc.get("published_at", ""),
            archived_at=doc.get("archived_at", ""),
            created_at=doc.get("created_at", ""),
            keypoints=keypoints,
            transport_times=transport_times,
            reviews=reviews,
        )

    def _get_tour_or_abort(self, tour_id, context):
        doc = self._tours.find_one({"_id": tour_id})
        if doc is None:
            context.abort(grpc.StatusCode.NOT_FOUND, "tour not found")
        return doc

    def CreateTour(self, request, context):
        user = self._require_auth(context)
        self._require_role(user, "author", context)

        tour_id = str(uuid4())
        doc = {
            "_id": tour_id,
            "author_id": user.id,
            "name": request.name,
            "description": request.description,
            "difficulty": request.difficulty,
            "tags": list(request.tags),
            "status": "draft",
            "price": 0.0,
            "length_km": 0.0,
            "published_at": "",
            "archived_at": "",
            "created_at": _now_iso(),
            "keypoints": [],
            "transport_times": [],
            "reviews": [],
        }
        self._tours.insert_one(doc)
        return self._doc_to_tour(doc)

    def UpdateTour(self, request, context):
        user = self._require_auth(context)
        self._require_role(user, "author", context)

        doc = self._get_tour_or_abort(request.id, context)
        if doc["author_id"] != user.id:
            context.abort(grpc.StatusCode.PERMISSION_DENIED, "not your tour")
        if doc["status"] != "draft":
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, "only draft tours can be updated")

        updates = {}
        if request.HasField("name"):
            updates["name"] = request.name
        if request.HasField("description"):
            updates["description"] = request.description
        if request.HasField("difficulty"):
            updates["difficulty"] = request.difficulty
        if request.HasField("price"):
            updates["price"] = request.price
        if list(request.tags):
            updates["tags"] = list(request.tags)

        if not updates:
            return self._doc_to_tour(doc)

        doc = self._tours.find_one_and_update(
            {"_id": request.id},
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )
        return self._doc_to_tour(doc)

    def GetTour(self, request, context):
        doc = self._get_tour_or_abort(request.id, context)

        # Try to identify caller's role to filter response for non-authors. 
        # Only authors can see full details of their own tours, others see 
        # limited info and only if published.
        meta = dict(context.invocation_metadata())
        auth_header = meta.get("authorization", "")
        full = False
        if auth_header.lower().startswith("bearer "):
            token = auth_header[len("bearer "):]
            try:
                resp = self._auth_stub.Validate(
                    auth_pb2.ValidateRequest(access_token=token)
                )
                if resp.valid:
                    is_author = "author" in resp.user.roles
                    owns_tour = resp.user.id == doc["author_id"]
                    full = is_author and owns_tour
            except grpc.RpcError:
                pass

        if not full and doc["status"] != "published":
            context.abort(grpc.StatusCode.NOT_FOUND, "tour not found")

        return self._doc_to_tour(doc, full=full)

    def ListMyTours(self, request, context):
        user = self._require_auth(context)
        self._require_role(user, "author", context)

        docs = list(self._tours.find({"author_id": user.id}))
        return tour_pb2.ListToursResponse(
            tours=[self._doc_to_tour(d) for d in docs]
        )

    def ListPublishedTours(self, request, context):
        docs = list(self._tours.find({"status": "published"}))
        return tour_pb2.ListToursResponse(
            tours=[self._doc_to_tour(d, full=False) for d in docs]
        )

    def AddKeypoint(self, request, context):
        user = self._require_auth(context)
        self._require_role(user, "author", context)

        doc = self._get_tour_or_abort(request.tour_id, context)
        if doc["author_id"] != user.id:
            context.abort(grpc.StatusCode.PERMISSION_DENIED, "not your tour")
        if doc["status"] != "draft":
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, "only draft tours can be modified")

        keypoints = doc.get("keypoints", [])
        new_kp = {
            "name": request.name,
            "description": request.description,
            "latitude": request.latitude,
            "longitude": request.longitude,
            "order": len(keypoints),
        }
        keypoints.append(new_kp)
        length_km = _tour_length_km(keypoints)

        doc = self._tours.find_one_and_update(
            {"_id": request.tour_id},
            {"$set": {"keypoints": keypoints, "length_km": length_km}},
            return_document=ReturnDocument.AFTER,
        )
        return self._doc_to_tour(doc)

    def AddTransportTime(self, request, context):
        user = self._require_auth(context)
        self._require_role(user, "author", context)

        doc = self._get_tour_or_abort(request.tour_id, context)
        if doc["author_id"] != user.id:
            context.abort(grpc.StatusCode.PERMISSION_DENIED, "not your tour")
        if doc["status"] != "draft":
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, "only draft tours can be modified")

        transport_name = _TRANSPORT_MAP.get(request.transport, "")
        if not transport_name:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "invalid transport type")

        transport_times = doc.get("transport_times", [])
        # Replace existing entry for same transport type if present
        transport_times = [t for t in transport_times if t["transport"] != transport_name]
        transport_times.append({"transport": transport_name, "minutes": request.minutes})

        doc = self._tours.find_one_and_update(
            {"_id": request.tour_id},
            {"$set": {"transport_times": transport_times}},
            return_document=ReturnDocument.AFTER,
        )
        return self._doc_to_tour(doc)

    def PublishTour(self, request, context):
        user = self._require_auth(context)
        self._require_role(user, "author", context)

        doc = self._get_tour_or_abort(request.id, context)
        if doc["author_id"] != user.id:
            context.abort(grpc.StatusCode.PERMISSION_DENIED, "not your tour")
        if doc["status"] != "draft":
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, "only draft tours can be published")

        # Validate publish conditions
        if not (doc.get("name") and doc.get("description") and doc.get("difficulty") and doc.get("tags")):
            context.abort(
                grpc.StatusCode.FAILED_PRECONDITION,
                "tour must have name, description, difficulty, and tags",
            )
        if len(doc.get("keypoints", [])) < 2:
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, "tour must have at least 2 keypoints")
        if len(doc.get("transport_times", [])) < 1:
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, "tour must have at least 1 transport time")

        doc = self._tours.find_one_and_update(
            {"_id": request.id},
            {"$set": {"status": "published", "published_at": _now_iso()}},
            return_document=ReturnDocument.AFTER,
        )
        return self._doc_to_tour(doc)

    def ArchiveTour(self, request, context):
        user = self._require_auth(context)
        self._require_role(user, "author", context)

        doc = self._get_tour_or_abort(request.id, context)
        if doc["author_id"] != user.id:
            context.abort(grpc.StatusCode.PERMISSION_DENIED, "not your tour")
        if doc["status"] != "published":
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, "only published tours can be archived")

        doc = self._tours.find_one_and_update(
            {"_id": request.id},
            {"$set": {"status": "archived", "archived_at": _now_iso()}},
            return_document=ReturnDocument.AFTER,
        )
        return self._doc_to_tour(doc)

    def ReactivateTour(self, request, context):
        user = self._require_auth(context)
        self._require_role(user, "author", context)

        doc = self._get_tour_or_abort(request.id, context)
        if doc["author_id"] != user.id:
            context.abort(grpc.StatusCode.PERMISSION_DENIED, "not your tour")
        if doc["status"] != "archived":
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, "only archived tours can be reactivated")

        doc = self._tours.find_one_and_update(
            {"_id": request.id},
            {"$set": {"status": "published"}, "$unset": {"archived_at": ""}},
            return_document=ReturnDocument.AFTER,
        )
        return self._doc_to_tour(doc)

    def AddReview(self, request, context):
        user = self._require_auth(context)
        self._require_role(user, "tourist", context)

        doc = self._get_tour_or_abort(request.tour_id, context)
        if doc["status"] != "published":
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, "reviews can only be added to published tours")

        if not (1 <= request.rating <= 5):
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "rating must be between 1 and 5")

        username = user.username if user.username else "Unknown"

        review = {
            "id": str(uuid4()),
            "tourist_id": user.id,
            "tourist_username": username,
            "rating": request.rating,
            "comment": request.comment,
            "visit_date": request.visit_date,
            "created_at": _now_iso(),
            "image_urls": list(request.image_urls),
        }

        doc = self._tours.find_one_and_update(
            {"_id": request.tour_id},
            {"$push": {"reviews": review}},
            return_document=ReturnDocument.AFTER,
        )
        return self._doc_to_tour(doc)

    def UploadReviewImage(self, request, context):
        self._require_auth(context)

        if not request.image_data:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "image_data is required")

        content_type = request.content_type or "application/octet-stream"
        path = f"/tours/reviews/{uuid4()}"
        try:
            resp = requests.post(
                f"{self._seaweedfs_url}{path}",
                files={"file": ("image", request.image_data, content_type)},
                timeout=10,
            )
        except Exception as exc:
            logging.error("seaweedfs upload error: %s", exc)
            context.abort(grpc.StatusCode.INTERNAL, "failed to upload image")

        if resp.status_code not in (200, 201):
            logging.error("seaweedfs returned %s: %s", resp.status_code, resp.text)
            context.abort(grpc.StatusCode.INTERNAL, "seaweedfs upload failed")

        return tour_pb2.UploadReviewImageResponse(
            image_url=f"{self._seaweedfs_url}{path}"
        )


def serve():
    db = MongoClient(_MONGO_URI)[_MONGO_DB]
    auth_channel = grpc.insecure_channel(_AUTH_SERVICE_ADDR)

    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    tour_pb2_grpc.add_TourServiceServicer_to_server(
        TourService(db, auth_channel, _SEAWEEDFS_FILER_URL), server
    )
    server.add_insecure_port(_GRPC_ADDR)
    server.start()
    logging.info("tour service listening on %s", _GRPC_ADDR)
    server.wait_for_termination()


if __name__ == "__main__":
    serve()
