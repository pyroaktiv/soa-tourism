import * as grpc from "@grpc/grpc-js";
import {
  FollowerServiceService,
} from "../gen/tourism/follower/v1/follower_pb";
import { followerServiceImpl } from "./service";
import { closeDriver } from "./neo4j";

const GRPC_ADDR = process.env.GRPC_ADDR ?? "0.0.0.0:9090";

function serve(): void {
  const server = new grpc.Server();

  server.addService(FollowerServiceService, followerServiceImpl);

  server.bindAsync(GRPC_ADDR, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
      console.error("Failed to bind server:", err);
      process.exit(1);
    }
    console.info(`follower-service listening on port ${port}`);
  });

  const shutdown = async (signal: string) => {
    console.info(`Received ${signal}, shutting down…`);
    server.tryShutdown(async (err) => {
      if (err) console.error("gRPC shutdown error:", err);
      await closeDriver();
      process.exit(err ? 1 : 0);
    });
  };

  process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
  process.on("SIGINT",  () => { void shutdown("SIGINT"); });
}

serve();
