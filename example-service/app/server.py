import logging
import os
from concurrent import futures

import grpc

from tourism.example.v1 import example_pb2
from tourism.example.v1 import example_pb2_grpc


class HealthService(example_pb2_grpc.HealthServiceServicer):
    def Check(self, request, context):
        return example_pb2.CheckResponse(status="ok")


def serve() -> None:
    bind_addr = os.getenv("GRPC_ADDR", "0.0.0.0:9090")

    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    example_pb2_grpc.add_HealthServiceServicer_to_server(HealthService(), server)
    server.add_insecure_port(bind_addr)
    server.start()

    logging.info("example-service listening on %s", bind_addr)
    server.wait_for_termination()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    serve()
