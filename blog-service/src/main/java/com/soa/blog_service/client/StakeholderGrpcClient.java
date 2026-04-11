package com.soa.blog_service.client;

import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tourism.stakeholders.v1.GetProfileRequest;
import tourism.stakeholders.v1.Profile;
import tourism.stakeholders.v1.StakeholderServiceGrpc;

@Component
public class StakeholderGrpcClient {

    @Value("${STAKEHOLDERS_SERVICE_ADDR:localhost:9090}")
    private String stakeholdersAddr;

    private ManagedChannel channel;
    private StakeholderServiceGrpc.StakeholderServiceBlockingStub blockingStub;

    @PostConstruct
    public void init() {
        String[] parts = stakeholdersAddr.split(":");
        String host = parts[0];
        int port = parts.length > 1 ? Integer.parseInt(parts[1]) : 9090;

        channel = ManagedChannelBuilder.forAddress(host, port)
                .usePlaintext()
                .build();

        blockingStub = StakeholderServiceGrpc.newBlockingStub(channel);
    }

    @PreDestroy
    public void shutdown() {
        if (channel != null) {
            channel.shutdown();
        }
    }

    public Profile getProfile(String userId) {
        GetProfileRequest request = GetProfileRequest.newBuilder()
                .setUserId(userId)
                .build();

        return blockingStub.getProfile(request);
    }
}