package com.soa.blog_service.client;

import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tourism.follower.v1.*;

@Component
public class FollowerGrpcClient {
    @Value("${FOLLOWER_SERVICE_ADDR:follower:9090}")
    private String followerAddr;
    private ManagedChannel channel;
    private FollowerServiceGrpc.FollowerServiceBlockingStub blockingStub;

    @PostConstruct
    public void init(){
        String[] parts = followerAddr.split(":");
        channel = ManagedChannelBuilder.forAddress(parts[0], Integer.parseInt(parts[1]))
                .usePlaintext()
                .build();
        blockingStub = FollowerServiceGrpc.newBlockingStub(channel);
    }

    @PreDestroy
    public void shutdown(){
        if(channel != null) channel.shutdown();
    }

    public GetFollowedUserIdsResponse getFollowedUserIds(String userId){
        return blockingStub.getFollowedUserIds(GetFollowedUserIdsRequest.newBuilder().setUserId(userId).build());
    }

    public IsFollowingResponse isFollowing(String followerId, String followeeId){
        return blockingStub.isFollowing(IsFollowingRequest.newBuilder().setFollowerId(followerId).setFolloweeId(followeeId).build());
    }
}
