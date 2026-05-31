import logging
import math
import os
import asyncio
import threading
from concurrent import futures
from datetime import datetime, timezone
from uuid import uuid4

import grpc
import requests
from pymongo import MongoClient
from pymongo.collection import ReturnDocument
from nats.aio.client import Client as NATS

from tourism.auth.v1 import auth_pb2_grpc, auth_pb2
from tourism.payment.v1 import payment_pb2, payment_pb2_grpc
from tourism.tour.v1 import tour_pb2, tour_pb2_grpc
from tourism.saga.v1 import saga_pb2

from google.protobuf import empty_pb2

logging.basicConfig(level=logging.INFO)

_GRPC_ADDR = os.environ.get("GRPC_ADDR", "0.0.0.0:9090")
_MONGO_URI = os.environ.get("MONGO_URI", "mongodb://mongo:27017")
_MONGO_DB = os.environ.get("MONGO_DB", "tourdb")
_NATS_URL = os.environ.get("NATS_URL", "nats://nats:4222")
_AUTH_SERVICE_ADDR = os.environ.get("AUTH_SERVICE_ADDR", "auth-service:9090")
_PAYMENT_SERVICE_ADDR = os.environ.get("PAYMENT_SERVICE_ADDR", "payment:9090")
_SEAWEEDFS_FILER_URL = os.environ.get("SEAWEEDFS_FILER_URL", "http://seaweedfs:8888")

_STATUS_MAP = {
    "draft": tour_pb2.TOUR_STATUS_DRAFT,
    "published": tour_pb2.TOUR_STATUS_PUBLISHED,
    "archive_pending": tour_pb2.TOUR_STATUS_ARCHIVE_PENDING,
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


class TourSagaHandler:
    def __init__(self, db, nats_url):
        self._tours = db.get_collection("tours")
        self._nats_url = nats_url
        self._nc = NATS()
        self._loop = asyncio.new_event_loop()

    def start(self):
        """Pokreće NATS osluškivač u posebnoj pozadinskoj niti."""
        t = threading.Thread(target=self._run_loop, daemon=True)
        t.start()

    def _run_loop(self):
        asyncio.set_event_loop(self._loop)
        self._loop.run_until_complete(self._connect_and_subscribe())
        self._loop.run_forever()

    async def _connect_and_subscribe(self):
        await self._nc.connect(self._nats_url)
        logging.info("Tour Saga Handler connected to NATS at %s", self._nats_url)
        
        # Slušamo komande od orkestratora
        await self._nc.subscribe("saga.block_author.tour.archive_command", cb=self._handle_archive_command)
        await self._nc.subscribe("saga.block_author.tour.finalize_command", cb=self._handle_finalize_command)
        await self._nc.subscribe("saga.archive_tour.tour.finalize_command", cb=self._handle_finalize_single_command)

    async def _handle_archive_command(self, msg):
        user_id = ""
        try:
            cmd = saga_pb2.ArchiveToursCommand()
            cmd.ParseFromString(msg.data)
            user_id = cmd.user_id
            logging.info("[Tour Saga] Received archive command for author: %s", user_id)

            # Koristimo Mongo pipeline update da sačuvamo trenutno stanje u 'previous_status' 
            # i prebacimo sve ture tog autora koje nisu arhivirane u 'archive_pending'
            self._tours.update_many(
                {"author_id": user_id, "status": {"$in": ["draft", "published"]}},
                [{"$set": {"previous_status": "$status", "status": "archive_pending"}}]
            )

            # Pokupimo ID-jeve svih tura koje su sada uspešno prebačene u pending
            cursor = self._tours.find({"author_id": user_id, "status": "archive_pending"}, ["_id"])
            tour_ids = [str(doc["_id"]) for doc in cursor]

            # Šaljemo uspeh nazad orkestratoru sa listom ID-jeva tura
            event = saga_pb2.ArchiveToursResultEvent(
                user_id=user_id,
                success=True,
                tour_ids=tour_ids
            )
            await self._nc.publish("saga.block_author.tour.archive_result", event.SerializeToString())
            logging.info("[Tour Saga] Successfully processed archive. Found %d tours for author %s", len(tour_ids), user_id)

        except Exception as exc:
            logging.error("[Tour Saga] Error processing archive command: %s", exc)
            try:
                event = saga_pb2.ArchiveToursResultEvent(
                    user_id=user_id,
                    success=False,
                    error_message=str(exc)
                )
                await self._nc.publish("saga.block_author.tour.archive_result", event.SerializeToString())
            except Exception as publish_exc:
                logging.error("[Tour Saga] Failed to publish error event: %s", publish_exc)

    async def _handle_finalize_command(self, msg):
        try:
            cmd = saga_pb2.FinalizeBlockAuthorCommand()
            cmd.ParseFromString(msg.data)
            user_id = cmd.user_id
            status = cmd.status
            logging.info("[Tour Saga] Received finalize command for user %s with status %s", user_id, status)

            if status == saga_pb2.SAGA_STATUS_SUCCESS:
                # COMMIT: Prebaci u trajno arhivirano stanje i obriši privremeni 'previous_status'
                self._tours.update_many(
                    {"author_id": user_id, "status": "archive_pending"},
                    {"$set": {"status": "archived", "archived_at": _now_iso()}, "$unset": {"previous_status": ""}}
                )
                logging.info("[Tour Saga] COMMIT COMPLETE: All pending tours for author %s are now permanently archived.", user_id)
            
            elif status == saga_pb2.SAGA_STATUS_ROLLBACK:
                # ROLLBACK: Vrati status na ono što je pisalo u 'previous_status' (ako nema, stavi published)
                self._tours.update_many(
                    {"author_id": user_id, "status": "archive_pending"},
                    [{"$set": {"status": {"$ifNull": ["$previous_status", "published"]}}}, {"$unset": "previous_status"}]
                )
                logging.info("[Tour Saga] ROLLBACK COMPLETE: All pending tours for author %s reverted to their original state.", user_id)

        except Exception as exc:
            logging.error("[Tour Saga] Error processing finalize command: %s", exc)

    async def _handle_finalize_single_command(self, msg):
        try:
            cmd = saga_pb2.FinalizeArchiveTourCommand()
            cmd.ParseFromString(msg.data)
            logging.info("[Archive Tour Saga] Finalize command for tour %s, status: %s", cmd.tour_id, cmd.status)

            if cmd.status == saga_pb2.SAGA_STATUS_SUCCESS:
                self._tours.update_one(
                    {"_id": cmd.tour_id, "status": "archive_pending"},
                    {"$set": {"status": "archived", "archived_at": _now_iso()}, "$unset": {"previous_status": ""}}
                )
            elif cmd.status == saga_pb2.SAGA_STATUS_ROLLBACK:
                self._tours.update_one(
                    {"_id": cmd.tour_id, "status": "archive_pending"},
                    [{"$set": {"status": {"$ifNull": ["$previous_status", "published"]}}}, {"$unset": "previous_status"}]
                )
        except Exception as exc:
            logging.error("[Archive Tour Saga] Error: %s", exc)


class TourService(tour_pb2_grpc.TourServiceServicer):
    def __init__(self, db, auth_channel: grpc.Channel, payment_channel: grpc.Channel, seaweedfs_url: str, saga_handler: TourSagaHandler) -> None:
        self._tours = db.get_collection("tours")
        self._executions = db.get_collection("tour_executions")
        self._auth_stub = auth_pb2_grpc.AuthServiceStub(auth_channel)
        self._payment_stub = payment_pb2_grpc.PaymentServiceStub(payment_channel)
        self._seaweedfs_url = seaweedfs_url
        self._saga_handler = saga_handler
        

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
                image_url=kp.get("image_url", ""),
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

        # Identify caller. Author who owns this tour sees full details.
        # A tourist who has purchased it (via payment service) also sees all
        # keypoints — per spec 16: "Ture koje su kupljene otkrivaju sve ključne tačke."
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
                    if not full and "tourist" in resp.user.roles:
                        try:
                            has = self._payment_stub.HasToken(
                                payment_pb2.HasTokenRequest(tour_id=request.id),
                                metadata=(("authorization", auth_header),),
                            )
                            if has.has_token:
                                full = True
                        except grpc.RpcError as exc:
                            logging.warning("payment HasToken failed: %s", exc)
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
            "image_url": request.image_url
        }
        keypoints.append(new_kp)
        length_km = _tour_length_km(keypoints)

        doc = self._tours.find_one_and_update(
            {"_id": request.tour_id},
            {"$set": {"keypoints": keypoints, "length_km": length_km}},
            return_document=ReturnDocument.AFTER,
        )
        return self._doc_to_tour(doc)
    
    def UpdateKeypoint(self, request, context):
        user = self._require_auth(context)
        self._require_role(user, "author", context)
        doc = self._get_tour_or_abort(request.tour_id, context)
        if doc["author_id"] != user.id:
            context.abort(grpc.StatusCode.PERMISSION_DENIED, "not your tour")
        if doc["status"] != "draft":
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, "only draft tours can be modified")

        keypoints = doc.get("keypoints", [])
        if request.order < 0 or request.order >= len(keypoints):
            context.abort(grpc.StatusCode.OUT_OF_RANGE, "Invalid keypoint order")

        keypoints[request.order].update({
            "name": request.name,
            "description": request.description,
            "latitude": request.latitude,
            "longitude": request.longitude,
            "image_url": request.image_url
        })

        length_km = _tour_length_km(keypoints)
        doc = self._tours.find_one_and_update(
            {"_id": request.tour_id},
            {"$set": {"keypoints": keypoints, "length_km": length_km}},
            return_document=ReturnDocument.AFTER
        )
        return self._doc_to_tour(doc)

    def DeleteKeypoint(self, request, context):
        user = self._require_auth(context)
        self._require_role(user, "author", context)
        doc = self._get_tour_or_abort(request.tour_id, context)
        if doc["author_id"] != user.id:
            context.abort(grpc.StatusCode.PERMISSION_DENIED, "not your tour")
        if doc["status"] != "draft":
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, "only draft tours can be modified")

        keypoints = doc.get("keypoints", [])
        if request.order < 0 or request.order >= len(keypoints):
            context.abort(grpc.StatusCode.OUT_OF_RANGE, "Invalid keypoint order")

        keypoints.pop(request.order)
        for i, kp in enumerate(keypoints):
            kp["order"] = i

        length_km = _tour_length_km(keypoints)
        doc = self._tours.find_one_and_update(
            {"_id": request.tour_id},
            {"$set": {"keypoints": keypoints, "length_km": length_km}},
            return_document=ReturnDocument.AFTER
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
        
        self._tours.update_one(
            {"_id": request.id},
            {"$set": {"previous_status": doc["status"], "status": "archive_pending"}}
        )

        event = saga_pb2.StartArchiveTourEvent(tour_id=request.id)
        asyncio.run_coroutine_threadsafe(
            self._saga_handler._nc.publish("saga.archive_tour.tour.started", event.SerializeToString()),
            self._saga_handler._loop
        )
        
        return empty_pb2.Empty()

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
            image_url=path
        )
    
    def UploadKeypointImage(self, request, context):
        self._require_auth(context)

        if not request.image_data:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "image_data is required")

        content_type = request.content_type or "application/octet-stream"
        path = f"/tours/keypoints/{uuid4()}" 
        
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

        return tour_pb2.UploadKeypointImageResponse(
            image_url=path
        )
    def _get_execution_or_abort(self, execution_id, context):
        doc = self._executions.find_one({"_id": execution_id})
        if doc is None:
            context.abort(grpc.StatusCode.NOT_FOUND, "execution not found")
        return doc

    def _doc_to_execution(self, doc):
        return tour_pb2.TourExecution(
            id=str(doc["_id"]),
            tour_id=doc.get("tour_id", ""),
            user_id=doc.get("user_id", ""),
            status=doc.get("status", ""),
            started_at=doc.get("started_at", ""),
            last_activity_at=doc.get("last_activity_at", ""),
            completed_at=doc.get("completed_at", ""),
            abandoned_at=doc.get("abandoned_at", ""),
            visited_keypoints=[
                tour_pb2.ExecutionKeypoint(
                    order=kp.get("order", 0),
                    name=kp.get("name", ""),
                    latitude=kp.get("latitude", 0.0),
                    longitude=kp.get("longitude", 0.0),
                    visited_at=kp.get("visited_at", ""),
                )
                for kp in doc.get("visited_keypoints", [])
            ],
        )
    def StartExecution(self, request, context):
        user = self._require_auth(context)
        self._require_role(user, "tourist", context)

        tour_doc = self._get_tour_or_abort(request.tour_id, context)
        if tour_doc.get("status") != "published":
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, "tour is not published")

        execution_id = str(uuid4())
        doc = {
            "_id": execution_id,
            "tour_id": request.tour_id,
            "user_id": user.id,
            "status": "started",
            "started_at": _now_iso(),
            "last_activity_at": _now_iso(),
            "completed_at": "",
            "abandoned_at": "",
            "visited_keypoints": [],
        }
        self._executions.insert_one(doc)
        return self._doc_to_execution(doc)

    def HeartbeatExecution(self, request, context):
        user = self._require_auth(context)
        self._require_role(user, "tourist", context)

        exec_doc = self._get_execution_or_abort(request.execution_id, context)
        if exec_doc["user_id"] != user.id:
            context.abort(grpc.StatusCode.PERMISSION_DENIED, "not your execution")
        if exec_doc["status"] in ("completed", "abandoned"):
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, "execution is no longer active")

        tour_doc = self._get_tour_or_abort(exec_doc["tour_id"], context)
        visited_orders = {kp.get("order") for kp in exec_doc.get("visited_keypoints", [])}

        remaining_keypoints = [
            kp for kp in tour_doc.get("keypoints", [])
            if kp.get("order") not in visited_orders
        ]
        remaining_keypoints.sort(key=lambda kp: kp.get("order", 0))
        next_keypoint = remaining_keypoints[0] if remaining_keypoints else None

        updates = {"last_activity_at": _now_iso()}
        newly_visited = False
        visited_order = -1

        if next_keypoint is not None:
            dist = _haversine_km(
                request.latitude,
                request.longitude,
                next_keypoint.get("latitude", 0.0),
                next_keypoint.get("longitude", 0.0),
            )
            if dist <= 0.05:
                visited = exec_doc.get("visited_keypoints", [])
                visited.append({
                    "order": next_keypoint["order"],
                    "name": next_keypoint.get("name", ""),
                    "latitude": next_keypoint.get("latitude", 0.0),
                    "longitude": next_keypoint.get("longitude", 0.0),
                    "visited_at": _now_iso(),
                })
                updates["visited_keypoints"] = visited
                newly_visited = True
                visited_order = next_keypoint["order"]

                if len(visited) >= len(tour_doc.get("keypoints", [])):
                    updates["status"] = "completed"
                    updates["completed_at"] = _now_iso()

        updated = self._executions.find_one_and_update(
            {"_id": request.execution_id},
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )

        return tour_pb2.HeartbeatResponse(
            execution=self._doc_to_execution(updated),
            newlyVisited=newly_visited,
            visitedOrder=visited_order,
        )

    def AbandonExecution(self, request, context):
        user = self._require_auth(context)
        self._require_role(user, "tourist", context)

        exec_doc = self._get_execution_or_abort(request.execution_id, context)
        if exec_doc["user_id"] != user.id:
            context.abort(grpc.StatusCode.PERMISSION_DENIED, "not your execution")
        if exec_doc["status"] in ("completed", "abandoned"):
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, "execution is no longer active")

        doc = self._executions.find_one_and_update(
            {"_id": request.execution_id},
            {"$set": {
                "status": "abandoned",
                "abandoned_at": _now_iso(),
                "last_activity_at": _now_iso(),
            }},
            return_document=ReturnDocument.AFTER,
        )
        return tour_pb2.AbandonExecutionResponse(
            execution=self._doc_to_execution(doc)
        )

    def GetExecution(self, request, context):
        user = self._require_auth(context)
        self._require_role(user, "tourist", context)

        exec_doc = self._get_execution_or_abort(request.id, context)
        if exec_doc["user_id"] != user.id:
            context.abort(grpc.StatusCode.PERMISSION_DENIED, "not your execution")
        return self._doc_to_execution(exec_doc)

def serve():
    db = MongoClient(_MONGO_URI)[_MONGO_DB]
    auth_channel = grpc.insecure_channel(_AUTH_SERVICE_ADDR)
    payment_channel = grpc.insecure_channel(_PAYMENT_SERVICE_ADDR)

    saga_handler = TourSagaHandler(db, _NATS_URL)
    saga_handler.start()

    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    tour_pb2_grpc.add_TourServiceServicer_to_server(
        TourService(db, auth_channel, payment_channel, _SEAWEEDFS_FILER_URL, saga_handler), server
    )
    server.add_insecure_port(_GRPC_ADDR)
    server.start()
    logging.info("tour service listening on %s", _GRPC_ADDR)
    server.wait_for_termination()


if __name__ == "__main__":
    serve()
