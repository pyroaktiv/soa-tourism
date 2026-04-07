import * as grpc from "@grpc/grpc-js";
import {
  AuthServiceClient,
  ValidateRequest,
  type User,
} from "../gen/tourism/auth/v1/auth_pb";

const AUTH_SERVICE_ADDR =
  process.env.AUTH_SERVICE_ADDR ?? "auth-service:9090";

const _authClient = new AuthServiceClient(
  AUTH_SERVICE_ADDR,
  grpc.credentials.createInsecure(),
);

/**
 * Extracts the Bearer token from gRPC metadata, calls the auth service's
 * Validate RPC, and returns the authenticated User.
 *
 * Aborts the gRPC call with UNAUTHENTICATED if the token is missing or invalid.
 */
export function requireAuth(
  metadata: grpc.Metadata,
  callback: grpc.sendUnaryData<never>,
): Promise<User> {
  return new Promise((resolve) => {
    const values = metadata.get("authorization");
    const raw = typeof values[0] === "string" ? values[0] : "";

    if (!raw.toLowerCase().startsWith("bearer ")) {
      callback({
        code: grpc.status.UNAUTHENTICATED,
        message: "missing authorization header",
      });
      return;
    }

    const token = raw.slice("bearer ".length).trim();

    _authClient.validate(
      ValidateRequest.create({ accessToken: token }),
      (err, response) => {
        if (err) {
          callback({
            code: grpc.status.UNAUTHENTICATED,
            message: "could not reach auth service",
          });
          return;
        }
        if (!response?.valid || !response.user) {
          callback({
            code: grpc.status.UNAUTHENTICATED,
            message: "invalid or expired token",
          });
          return;
        }
        resolve(response.user);
      },
    );
  });
}
