import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";
import { type CallOptions, type ChannelCredentials, Client, type ClientOptions, type ClientUnaryCall, type handleUnaryCall, type Metadata, type ServiceError, type UntypedServiceImplementation } from "@grpc/grpc-js";
export declare const protobufPackage = "tourism.follower.v1";
export interface FollowRequest {
    /** The user to follow. The follower is the authenticated caller. */
    followeeId: string;
}
export interface FollowResponse {
    success: boolean;
}
export interface UnfollowRequest {
    /** The user to unfollow. The follower is the authenticated caller. */
    followeeId: string;
}
export interface UnfollowResponse {
    success: boolean;
}
export interface GetFollowersRequest {
    userId: string;
    limit: number;
    offset: number;
}
export interface GetFollowersResponse {
    userIds: string[];
    total: number;
}
export interface GetFollowingRequest {
    userId: string;
    limit: number;
    offset: number;
}
export interface GetFollowingResponse {
    userIds: string[];
    total: number;
}
export interface IsFollowingRequest {
    followerId: string;
    followeeId: string;
}
export interface IsFollowingResponse {
    isFollowing: boolean;
}
export interface GetFollowedUserIdsRequest {
    userId: string;
}
export interface GetFollowedUserIdsResponse {
    userIds: string[];
}
export interface GetRecommendationsRequest {
    /** Maximum number of recommendations to return. Defaults to 10 if 0. */
    limit: number;
}
export interface Recommendation {
    userId: string;
    mutualFollows: number;
}
export interface GetRecommendationsResponse {
    recommendations: Recommendation[];
}
export declare const FollowRequest: MessageFns<FollowRequest>;
export declare const FollowResponse: MessageFns<FollowResponse>;
export declare const UnfollowRequest: MessageFns<UnfollowRequest>;
export declare const UnfollowResponse: MessageFns<UnfollowResponse>;
export declare const GetFollowersRequest: MessageFns<GetFollowersRequest>;
export declare const GetFollowersResponse: MessageFns<GetFollowersResponse>;
export declare const GetFollowingRequest: MessageFns<GetFollowingRequest>;
export declare const GetFollowingResponse: MessageFns<GetFollowingResponse>;
export declare const IsFollowingRequest: MessageFns<IsFollowingRequest>;
export declare const IsFollowingResponse: MessageFns<IsFollowingResponse>;
export declare const GetFollowedUserIdsRequest: MessageFns<GetFollowedUserIdsRequest>;
export declare const GetFollowedUserIdsResponse: MessageFns<GetFollowedUserIdsResponse>;
export declare const GetRecommendationsRequest: MessageFns<GetRecommendationsRequest>;
export declare const Recommendation: MessageFns<Recommendation>;
export declare const GetRecommendationsResponse: MessageFns<GetRecommendationsResponse>;
export type FollowerServiceService = typeof FollowerServiceService;
export declare const FollowerServiceService: {
    /** Follow a user. The calling user is identified from the Authorization header. */
    readonly follow: {
        readonly path: "/tourism.follower.v1.FollowerService/Follow";
        readonly requestStream: false;
        readonly responseStream: false;
        readonly requestSerialize: (value: FollowRequest) => Buffer;
        readonly requestDeserialize: (value: Buffer) => FollowRequest;
        readonly responseSerialize: (value: FollowResponse) => Buffer;
        readonly responseDeserialize: (value: Buffer) => FollowResponse;
    };
    /** Unfollow a user. The calling user is identified from the Authorization header. */
    readonly unfollow: {
        readonly path: "/tourism.follower.v1.FollowerService/Unfollow";
        readonly requestStream: false;
        readonly responseStream: false;
        readonly requestSerialize: (value: UnfollowRequest) => Buffer;
        readonly requestDeserialize: (value: Buffer) => UnfollowRequest;
        readonly responseSerialize: (value: UnfollowResponse) => Buffer;
        readonly responseDeserialize: (value: Buffer) => UnfollowResponse;
    };
    /** List users who follow the given user. */
    readonly getFollowers: {
        readonly path: "/tourism.follower.v1.FollowerService/GetFollowers";
        readonly requestStream: false;
        readonly responseStream: false;
        readonly requestSerialize: (value: GetFollowersRequest) => Buffer;
        readonly requestDeserialize: (value: Buffer) => GetFollowersRequest;
        readonly responseSerialize: (value: GetFollowersResponse) => Buffer;
        readonly responseDeserialize: (value: Buffer) => GetFollowersResponse;
    };
    /** List users that the given user follows. */
    readonly getFollowing: {
        readonly path: "/tourism.follower.v1.FollowerService/GetFollowing";
        readonly requestStream: false;
        readonly responseStream: false;
        readonly requestSerialize: (value: GetFollowingRequest) => Buffer;
        readonly requestDeserialize: (value: Buffer) => GetFollowingRequest;
        readonly responseSerialize: (value: GetFollowingResponse) => Buffer;
        readonly responseDeserialize: (value: Buffer) => GetFollowingResponse;
    };
    /** Check whether follower_id follows followee_id. */
    readonly isFollowing: {
        readonly path: "/tourism.follower.v1.FollowerService/IsFollowing";
        readonly requestStream: false;
        readonly responseStream: false;
        readonly requestSerialize: (value: IsFollowingRequest) => Buffer;
        readonly requestDeserialize: (value: Buffer) => IsFollowingRequest;
        readonly responseSerialize: (value: IsFollowingResponse) => Buffer;
        readonly responseDeserialize: (value: Buffer) => IsFollowingResponse;
    };
    /**
     * Return all user IDs followed by the given user.
     * No HTTP binding — intended for internal service-to-service calls only
     * (e.g., the future blog service checking which authors the caller follows).
     */
    readonly getFollowedUserIds: {
        readonly path: "/tourism.follower.v1.FollowerService/GetFollowedUserIds";
        readonly requestStream: false;
        readonly responseStream: false;
        readonly requestSerialize: (value: GetFollowedUserIdsRequest) => Buffer;
        readonly requestDeserialize: (value: Buffer) => GetFollowedUserIdsRequest;
        readonly responseSerialize: (value: GetFollowedUserIdsResponse) => Buffer;
        readonly responseDeserialize: (value: Buffer) => GetFollowedUserIdsResponse;
    };
    /**
     * Return follow recommendations based on friends-of-friends.
     * The calling user is identified from the Authorization header.
     */
    readonly getRecommendations: {
        readonly path: "/tourism.follower.v1.FollowerService/GetRecommendations";
        readonly requestStream: false;
        readonly responseStream: false;
        readonly requestSerialize: (value: GetRecommendationsRequest) => Buffer;
        readonly requestDeserialize: (value: Buffer) => GetRecommendationsRequest;
        readonly responseSerialize: (value: GetRecommendationsResponse) => Buffer;
        readonly responseDeserialize: (value: Buffer) => GetRecommendationsResponse;
    };
};
export interface FollowerServiceServer extends UntypedServiceImplementation {
    /** Follow a user. The calling user is identified from the Authorization header. */
    follow: handleUnaryCall<FollowRequest, FollowResponse>;
    /** Unfollow a user. The calling user is identified from the Authorization header. */
    unfollow: handleUnaryCall<UnfollowRequest, UnfollowResponse>;
    /** List users who follow the given user. */
    getFollowers: handleUnaryCall<GetFollowersRequest, GetFollowersResponse>;
    /** List users that the given user follows. */
    getFollowing: handleUnaryCall<GetFollowingRequest, GetFollowingResponse>;
    /** Check whether follower_id follows followee_id. */
    isFollowing: handleUnaryCall<IsFollowingRequest, IsFollowingResponse>;
    /**
     * Return all user IDs followed by the given user.
     * No HTTP binding — intended for internal service-to-service calls only
     * (e.g., the future blog service checking which authors the caller follows).
     */
    getFollowedUserIds: handleUnaryCall<GetFollowedUserIdsRequest, GetFollowedUserIdsResponse>;
    /**
     * Return follow recommendations based on friends-of-friends.
     * The calling user is identified from the Authorization header.
     */
    getRecommendations: handleUnaryCall<GetRecommendationsRequest, GetRecommendationsResponse>;
}
export interface FollowerServiceClient extends Client {
    /** Follow a user. The calling user is identified from the Authorization header. */
    follow(request: FollowRequest, callback: (error: ServiceError | null, response: FollowResponse) => void): ClientUnaryCall;
    follow(request: FollowRequest, metadata: Metadata, callback: (error: ServiceError | null, response: FollowResponse) => void): ClientUnaryCall;
    follow(request: FollowRequest, metadata: Metadata, options: Partial<CallOptions>, callback: (error: ServiceError | null, response: FollowResponse) => void): ClientUnaryCall;
    /** Unfollow a user. The calling user is identified from the Authorization header. */
    unfollow(request: UnfollowRequest, callback: (error: ServiceError | null, response: UnfollowResponse) => void): ClientUnaryCall;
    unfollow(request: UnfollowRequest, metadata: Metadata, callback: (error: ServiceError | null, response: UnfollowResponse) => void): ClientUnaryCall;
    unfollow(request: UnfollowRequest, metadata: Metadata, options: Partial<CallOptions>, callback: (error: ServiceError | null, response: UnfollowResponse) => void): ClientUnaryCall;
    /** List users who follow the given user. */
    getFollowers(request: GetFollowersRequest, callback: (error: ServiceError | null, response: GetFollowersResponse) => void): ClientUnaryCall;
    getFollowers(request: GetFollowersRequest, metadata: Metadata, callback: (error: ServiceError | null, response: GetFollowersResponse) => void): ClientUnaryCall;
    getFollowers(request: GetFollowersRequest, metadata: Metadata, options: Partial<CallOptions>, callback: (error: ServiceError | null, response: GetFollowersResponse) => void): ClientUnaryCall;
    /** List users that the given user follows. */
    getFollowing(request: GetFollowingRequest, callback: (error: ServiceError | null, response: GetFollowingResponse) => void): ClientUnaryCall;
    getFollowing(request: GetFollowingRequest, metadata: Metadata, callback: (error: ServiceError | null, response: GetFollowingResponse) => void): ClientUnaryCall;
    getFollowing(request: GetFollowingRequest, metadata: Metadata, options: Partial<CallOptions>, callback: (error: ServiceError | null, response: GetFollowingResponse) => void): ClientUnaryCall;
    /** Check whether follower_id follows followee_id. */
    isFollowing(request: IsFollowingRequest, callback: (error: ServiceError | null, response: IsFollowingResponse) => void): ClientUnaryCall;
    isFollowing(request: IsFollowingRequest, metadata: Metadata, callback: (error: ServiceError | null, response: IsFollowingResponse) => void): ClientUnaryCall;
    isFollowing(request: IsFollowingRequest, metadata: Metadata, options: Partial<CallOptions>, callback: (error: ServiceError | null, response: IsFollowingResponse) => void): ClientUnaryCall;
    /**
     * Return all user IDs followed by the given user.
     * No HTTP binding — intended for internal service-to-service calls only
     * (e.g., the future blog service checking which authors the caller follows).
     */
    getFollowedUserIds(request: GetFollowedUserIdsRequest, callback: (error: ServiceError | null, response: GetFollowedUserIdsResponse) => void): ClientUnaryCall;
    getFollowedUserIds(request: GetFollowedUserIdsRequest, metadata: Metadata, callback: (error: ServiceError | null, response: GetFollowedUserIdsResponse) => void): ClientUnaryCall;
    getFollowedUserIds(request: GetFollowedUserIdsRequest, metadata: Metadata, options: Partial<CallOptions>, callback: (error: ServiceError | null, response: GetFollowedUserIdsResponse) => void): ClientUnaryCall;
    /**
     * Return follow recommendations based on friends-of-friends.
     * The calling user is identified from the Authorization header.
     */
    getRecommendations(request: GetRecommendationsRequest, callback: (error: ServiceError | null, response: GetRecommendationsResponse) => void): ClientUnaryCall;
    getRecommendations(request: GetRecommendationsRequest, metadata: Metadata, callback: (error: ServiceError | null, response: GetRecommendationsResponse) => void): ClientUnaryCall;
    getRecommendations(request: GetRecommendationsRequest, metadata: Metadata, options: Partial<CallOptions>, callback: (error: ServiceError | null, response: GetRecommendationsResponse) => void): ClientUnaryCall;
}
export declare const FollowerServiceClient: {
    new (address: string, credentials: ChannelCredentials, options?: Partial<ClientOptions>): FollowerServiceClient;
    service: typeof FollowerServiceService;
    serviceName: string;
};
type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;
export type DeepPartial<T> = T extends Builtin ? T : T extends globalThis.Array<infer U> ? globalThis.Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>> : T extends {} ? {
    [K in keyof T]?: DeepPartial<T[K]>;
} : Partial<T>;
type KeysOfUnion<T> = T extends T ? keyof T : never;
export type Exact<P, I extends P> = P extends Builtin ? P : P & {
    [K in keyof P]: Exact<P[K], I[K]>;
} & {
    [K in Exclude<keyof I, KeysOfUnion<P>>]: never;
};
export interface MessageFns<T> {
    encode(message: T, writer?: BinaryWriter): BinaryWriter;
    decode(input: BinaryReader | Uint8Array, length?: number): T;
    fromJSON(object: any): T;
    toJSON(message: T): unknown;
    create<I extends Exact<DeepPartial<T>, I>>(base?: I): T;
    fromPartial<I extends Exact<DeepPartial<T>, I>>(object: I): T;
}
export {};
