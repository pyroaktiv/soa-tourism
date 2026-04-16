package com.soa.blog_service.config;

import com.soa.blog_service.controller.BlogGrpcController;
import com.soa.blog_service.security.AuthInterceptor; // Dodat import!
import io.grpc.Server;
import io.grpc.ServerBuilder;
import io.grpc.ServerInterceptors; // Dodat import za presretanje!
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class GrpcServerRunner {

    private final BlogGrpcController blogGrpcController;
    private final AuthInterceptor authInterceptor;
    private Server server;


    public GrpcServerRunner(BlogGrpcController blogGrpcController, AuthInterceptor authInterceptor) {
        this.blogGrpcController = blogGrpcController;
        this.authInterceptor = authInterceptor;
    }

    @PostConstruct
    public void start() throws IOException {
        server = ServerBuilder.forPort(9090)
                .addService(ServerInterceptors.intercept(blogGrpcController, authInterceptor))
                .build()
                .start();
        System.out.println("gRPC Server uspešno pokrenut i pod zaštitom sluša na portu 9090! 🛡️");
    }

    @PreDestroy
    public void stop() {
        if (server != null) {
            server.shutdown();
        }
    }
}