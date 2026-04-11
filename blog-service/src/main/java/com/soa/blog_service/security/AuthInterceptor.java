package com.soa.blog_service.security;

import com.soa.blog_service.client.AuthGrpcClient;
import io.grpc.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tourism.auth.v1.ValidateResponse;

@Component
@RequiredArgsConstructor
public class AuthInterceptor implements ServerInterceptor {

    private final AuthGrpcClient authClient;

    public static final Context.Key<String> USER_ID_KEY = Context.key("user_id");

    @Override
    public <ReqT, RespT> ServerCall.Listener<ReqT> interceptCall(
            ServerCall<ReqT, RespT> call, Metadata headers, ServerCallHandler<ReqT, RespT> next) {

        String methodName = call.getMethodDescriptor().getFullMethodName();

        if (methodName.endsWith("GetAllBlogs")) {
            return Contexts.interceptCall(Context.current(), call, headers, next);
        }

        String authHeader = headers.get(Metadata.Key.of("authorization", Metadata.ASCII_STRING_MARSHALLER));

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            call.close(Status.UNAUTHENTICATED.withDescription("Nedostaje ili je nevalidan JWT token!"), headers);
            return new ServerCall.Listener<ReqT>() {};
        }

        String token = authHeader.substring(7);

        try {
            ValidateResponse response = authClient.validateToken(token);

            if (!response.getValid() || response.getUser().getBlocked()) {
                call.close(Status.UNAUTHENTICATED.withDescription("Token je istekao ili je korisnik blokiran!"), headers);
                return new ServerCall.Listener<ReqT>() {};
            }

            Context ctx = Context.current().withValue(USER_ID_KEY, response.getUser().getId());
            return Contexts.interceptCall(ctx, call, headers, next);

        } catch (Exception e) {
            call.close(Status.UNAVAILABLE.withDescription("Auth servis trenutno ne radi!"), headers);
            return new ServerCall.Listener<ReqT>() {};
        }
    }
}