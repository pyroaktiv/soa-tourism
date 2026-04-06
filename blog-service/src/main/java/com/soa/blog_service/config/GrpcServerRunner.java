package com.soa.blog_service.config;

import com.soa.blog_service.controller.BlogGrpcController;
import io.grpc.Server;
import io.grpc.ServerBuilder;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class GrpcServerRunner {

    private final BlogGrpcController blogGrpcController;
    private Server server;

    public GrpcServerRunner(BlogGrpcController blogGrpcController) {
        this.blogGrpcController = blogGrpcController;
    }

    @PostConstruct
    public void start() throws IOException {
        server = ServerBuilder.forPort(9090)
                .addService(blogGrpcController)
                .build()
                .start();
        System.out.println("gRPC Server uspešno pokrenut i sluša na portu 9090!");
    }

    @PreDestroy
    public void stop() {
        if (server != null) {
            server.shutdown();
        }
    }
}