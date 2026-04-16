import * as grpc from "@grpc/grpc-js";

import type {
  FollowerServiceServer,
  FollowRequest,
  FollowResponse,
  UnfollowRequest,
  UnfollowResponse,
  GetFollowersRequest,
  GetFollowersResponse,
  GetFollowingRequest,
  GetFollowingResponse,
  IsFollowingRequest,
  IsFollowingResponse,
  GetFollowedUserIdsRequest,
  GetFollowedUserIdsResponse,
  GetRecommendationsRequest,
  GetRecommendationsResponse,
} from "../gen/tourism/follower/v1/follower_pb";

import { requireAuth } from "./auth-client";
import * as db from "./neo4j";

const DEFAULT_PAGE_LIMIT = 20;
const DEFAULT_REC_LIMIT = 10;

export const followerServiceImpl: FollowerServiceServer = {
  follow: async (
    call: grpc.ServerUnaryCall<FollowRequest, FollowResponse>,
    callback: grpc.sendUnaryData<FollowResponse>,
  ) => {
    const user = await requireAuth(call.metadata, callback as grpc.sendUnaryData<never>).catch(() => null);
    if (!user) return;

    const followeeId = call.request.followeeId;
    if (!followeeId) {
      callback({ code: grpc.status.INVALID_ARGUMENT, message: "followee_id is required" });
      return;
    }
    if (user.id === followeeId) {
      callback({ code: grpc.status.INVALID_ARGUMENT, message: "cannot follow yourself" });
      return;
    }

    try {
      await db.follow(user.id, followeeId);
      callback(null, { success: true });
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, message: String(err) });
    }
  },

  unfollow: async (
    call: grpc.ServerUnaryCall<UnfollowRequest, UnfollowResponse>,
    callback: grpc.sendUnaryData<UnfollowResponse>,
  ) => {
    const user = await requireAuth(call.metadata, callback as grpc.sendUnaryData<never>).catch(() => null);
    if (!user) return;

    const followeeId = call.request.followeeId;
    if (!followeeId) {
      callback({ code: grpc.status.INVALID_ARGUMENT, message: "followee_id is required" });
      return;
    }

    try {
      await db.unfollow(user.id, followeeId);
      callback(null, { success: true });
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, message: String(err) });
    }
  },

  getFollowers: async (
    call: grpc.ServerUnaryCall<GetFollowersRequest, GetFollowersResponse>,
    callback: grpc.sendUnaryData<GetFollowersResponse>,
  ) => {
    const userId = call.request.userId;
    if (!userId) {
      callback({ code: grpc.status.INVALID_ARGUMENT, message: "user_id is required" });
      return;
    }

    const limit = call.request.limit > 0 ? call.request.limit : DEFAULT_PAGE_LIMIT;
    const offset = call.request.offset >= 0 ? call.request.offset : 0;

    try {
      const result = await db.getFollowers(userId, limit, offset);
      callback(null, result);
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, message: String(err) });
    }
  },

  getFollowing: async (
    call: grpc.ServerUnaryCall<GetFollowingRequest, GetFollowingResponse>,
    callback: grpc.sendUnaryData<GetFollowingResponse>,
  ) => {
    const userId = call.request.userId;
    if (!userId) {
      callback({ code: grpc.status.INVALID_ARGUMENT, message: "user_id is required" });
      return;
    }

    const limit = call.request.limit > 0 ? call.request.limit : DEFAULT_PAGE_LIMIT;
    const offset = call.request.offset >= 0 ? call.request.offset : 0;

    try {
      const result = await db.getFollowing(userId, limit, offset);
      callback(null, result);
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, message: String(err) });
    }
  },

  isFollowing: async (
    call: grpc.ServerUnaryCall<IsFollowingRequest, IsFollowingResponse>,
    callback: grpc.sendUnaryData<IsFollowingResponse>,
  ) => {
    const { followerId, followeeId } = call.request;
    if (!followerId || !followeeId) {
      callback({ code: grpc.status.INVALID_ARGUMENT, message: "follower_id and followee_id are required" });
      return;
    }

    try {
      const result = await db.isFollowing(followerId, followeeId);
      callback(null, { isFollowing: result });
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, message: String(err) });
    }
  },

  getFollowedUserIds: async (
    call: grpc.ServerUnaryCall<GetFollowedUserIdsRequest, GetFollowedUserIdsResponse>,
    callback: grpc.sendUnaryData<GetFollowedUserIdsResponse>,
  ) => {
    const userId = call.request.userId;
    if (!userId) {
      callback({ code: grpc.status.INVALID_ARGUMENT, message: "user_id is required" });
      return;
    }

    try {
      const userIds = await db.getFollowedUserIds(userId);
      callback(null, { userIds });
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, message: String(err) });
    }
  },

  getRecommendations: async (
    call: grpc.ServerUnaryCall<GetRecommendationsRequest, GetRecommendationsResponse>,
    callback: grpc.sendUnaryData<GetRecommendationsResponse>,
  ) => {
    const user = await requireAuth(call.metadata, callback as grpc.sendUnaryData<never>).catch(() => null);
    if (!user) return;

    const limit = call.request.limit > 0 ? call.request.limit : DEFAULT_REC_LIMIT;

    try {
      const rows = await db.getRecommendations(user.id, limit);
      callback(null, {
        recommendations: rows.map((r) => ({
          userId: r.userId,
          mutualFollows: r.mutualFollows,
        })),
      });
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, message: String(err) });
    }
  },
};
