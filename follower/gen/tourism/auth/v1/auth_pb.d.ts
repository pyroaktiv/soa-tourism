import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";
import { type CallOptions, type ChannelCredentials, Client, type ClientOptions, type ClientUnaryCall, type handleUnaryCall, type Metadata, type ServiceError, type UntypedServiceImplementation } from "@grpc/grpc-js";
import { Empty } from "../../../google/protobuf/empty_pb";
export declare const protobufPackage = "tourism.auth.v1";
export interface User {
    id: string;
    username: string;
    email: string;
    roles: string[];
}
export interface TokenPair {
    accessToken: string;
    accessTokenExpiresAt: number;
    refreshToken: string;
    refreshTokenExpiresAt: number;
}
export interface AuthResponse {
    user?: User | undefined;
    tokens?: TokenPair | undefined;
}
export interface RegisterRequest {
    username: string;
    email: string;
    password: string;
    /** roles defaults to ["user"] when empty. */
    roles: string[];
}
export interface LoginRequest {
    /** identifier accepts either a username or email address. */
    identifier: string;
    password: string;
}
export interface RefreshRequest {
    refreshToken: string;
}
export interface ValidateRequest {
    accessToken: string;
}
export interface ValidateResponse {
    valid: boolean;
    /** user is populated only when valid is true. */
    user?: User | undefined;
}
export interface LogoutRequest {
    refreshToken: string;
}
export declare const User: MessageFns<User>;
export declare const TokenPair: MessageFns<TokenPair>;
export declare const AuthResponse: MessageFns<AuthResponse>;
export declare const RegisterRequest: MessageFns<RegisterRequest>;
export declare const LoginRequest: MessageFns<LoginRequest>;
export declare const RefreshRequest: MessageFns<RefreshRequest>;
export declare const ValidateRequest: MessageFns<ValidateRequest>;
export declare const ValidateResponse: MessageFns<ValidateResponse>;
export declare const LogoutRequest: MessageFns<LogoutRequest>;
export type AuthServiceService = typeof AuthServiceService;
export declare const AuthServiceService: {
    /** Register creates a new user account and returns a token pair. */
    readonly register: {
        readonly path: "/tourism.auth.v1.AuthService/Register";
        readonly requestStream: false;
        readonly responseStream: false;
        readonly requestSerialize: (value: RegisterRequest) => Buffer;
        readonly requestDeserialize: (value: Buffer) => RegisterRequest;
        readonly responseSerialize: (value: AuthResponse) => Buffer;
        readonly responseDeserialize: (value: Buffer) => AuthResponse;
    };
    /** Login authenticates with username or email + password and returns a token pair. */
    readonly login: {
        readonly path: "/tourism.auth.v1.AuthService/Login";
        readonly requestStream: false;
        readonly responseStream: false;
        readonly requestSerialize: (value: LoginRequest) => Buffer;
        readonly requestDeserialize: (value: Buffer) => LoginRequest;
        readonly responseSerialize: (value: AuthResponse) => Buffer;
        readonly responseDeserialize: (value: Buffer) => AuthResponse;
    };
    /** Refresh rotates a refresh token and returns a new token pair. */
    readonly refresh: {
        readonly path: "/tourism.auth.v1.AuthService/Refresh";
        readonly requestStream: false;
        readonly responseStream: false;
        readonly requestSerialize: (value: RefreshRequest) => Buffer;
        readonly requestDeserialize: (value: Buffer) => RefreshRequest;
        readonly responseSerialize: (value: TokenPair) => Buffer;
        readonly responseDeserialize: (value: Buffer) => TokenPair;
    };
    /**
     * Validate verifies an access token and returns the associated user.
     * Called internally by other services — not exposed through the gateway.
     */
    readonly validate: {
        readonly path: "/tourism.auth.v1.AuthService/Validate";
        readonly requestStream: false;
        readonly responseStream: false;
        readonly requestSerialize: (value: ValidateRequest) => Buffer;
        readonly requestDeserialize: (value: Buffer) => ValidateRequest;
        readonly responseSerialize: (value: ValidateResponse) => Buffer;
        readonly responseDeserialize: (value: Buffer) => ValidateResponse;
    };
    /** Logout revokes the given refresh token. */
    readonly logout: {
        readonly path: "/tourism.auth.v1.AuthService/Logout";
        readonly requestStream: false;
        readonly responseStream: false;
        readonly requestSerialize: (value: LogoutRequest) => Buffer;
        readonly requestDeserialize: (value: Buffer) => LogoutRequest;
        readonly responseSerialize: (value: Empty) => Buffer;
        readonly responseDeserialize: (value: Buffer) => Empty;
    };
};
export interface AuthServiceServer extends UntypedServiceImplementation {
    /** Register creates a new user account and returns a token pair. */
    register: handleUnaryCall<RegisterRequest, AuthResponse>;
    /** Login authenticates with username or email + password and returns a token pair. */
    login: handleUnaryCall<LoginRequest, AuthResponse>;
    /** Refresh rotates a refresh token and returns a new token pair. */
    refresh: handleUnaryCall<RefreshRequest, TokenPair>;
    /**
     * Validate verifies an access token and returns the associated user.
     * Called internally by other services — not exposed through the gateway.
     */
    validate: handleUnaryCall<ValidateRequest, ValidateResponse>;
    /** Logout revokes the given refresh token. */
    logout: handleUnaryCall<LogoutRequest, Empty>;
}
export interface AuthServiceClient extends Client {
    /** Register creates a new user account and returns a token pair. */
    register(request: RegisterRequest, callback: (error: ServiceError | null, response: AuthResponse) => void): ClientUnaryCall;
    register(request: RegisterRequest, metadata: Metadata, callback: (error: ServiceError | null, response: AuthResponse) => void): ClientUnaryCall;
    register(request: RegisterRequest, metadata: Metadata, options: Partial<CallOptions>, callback: (error: ServiceError | null, response: AuthResponse) => void): ClientUnaryCall;
    /** Login authenticates with username or email + password and returns a token pair. */
    login(request: LoginRequest, callback: (error: ServiceError | null, response: AuthResponse) => void): ClientUnaryCall;
    login(request: LoginRequest, metadata: Metadata, callback: (error: ServiceError | null, response: AuthResponse) => void): ClientUnaryCall;
    login(request: LoginRequest, metadata: Metadata, options: Partial<CallOptions>, callback: (error: ServiceError | null, response: AuthResponse) => void): ClientUnaryCall;
    /** Refresh rotates a refresh token and returns a new token pair. */
    refresh(request: RefreshRequest, callback: (error: ServiceError | null, response: TokenPair) => void): ClientUnaryCall;
    refresh(request: RefreshRequest, metadata: Metadata, callback: (error: ServiceError | null, response: TokenPair) => void): ClientUnaryCall;
    refresh(request: RefreshRequest, metadata: Metadata, options: Partial<CallOptions>, callback: (error: ServiceError | null, response: TokenPair) => void): ClientUnaryCall;
    /**
     * Validate verifies an access token and returns the associated user.
     * Called internally by other services — not exposed through the gateway.
     */
    validate(request: ValidateRequest, callback: (error: ServiceError | null, response: ValidateResponse) => void): ClientUnaryCall;
    validate(request: ValidateRequest, metadata: Metadata, callback: (error: ServiceError | null, response: ValidateResponse) => void): ClientUnaryCall;
    validate(request: ValidateRequest, metadata: Metadata, options: Partial<CallOptions>, callback: (error: ServiceError | null, response: ValidateResponse) => void): ClientUnaryCall;
    /** Logout revokes the given refresh token. */
    logout(request: LogoutRequest, callback: (error: ServiceError | null, response: Empty) => void): ClientUnaryCall;
    logout(request: LogoutRequest, metadata: Metadata, callback: (error: ServiceError | null, response: Empty) => void): ClientUnaryCall;
    logout(request: LogoutRequest, metadata: Metadata, options: Partial<CallOptions>, callback: (error: ServiceError | null, response: Empty) => void): ClientUnaryCall;
}
export declare const AuthServiceClient: {
    new (address: string, credentials: ChannelCredentials, options?: Partial<ClientOptions>): AuthServiceClient;
    service: typeof AuthServiceService;
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
