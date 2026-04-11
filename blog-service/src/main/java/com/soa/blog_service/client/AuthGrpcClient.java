package com.soa.blog_service.client;

import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tourism.auth.v1.AuthServiceGrpc;
import tourism.auth.v1.ValidateRequest;
import tourism.auth.v1.ValidateResponse;

@Component
public class AuthGrpcClient {

    @Value("${AUTH_SERVICE_ADDR:auth-service:9090}")
    private String authAddr;
    private ManagedChannel channel;
    private AuthServiceGrpc.AuthServiceBlockingStub blockingStub;

    @PostConstruct
    public void init() {
        String[] parts = authAddr.split(":");
        channel = ManagedChannelBuilder.forAddress(parts[0], Integer.parseInt(parts[1]))
                .usePlaintext()
                .build();
        blockingStub = AuthServiceGrpc.newBlockingStub(channel);
    }

    @PreDestroy
    public void shutdown() {
        if (channel != null) channel.shutdown();
    }

    public ValidateResponse validateToken(String token) {
        return blockingStub.validate(ValidateRequest.newBuilder().setAccessToken(token).build());
    }
}