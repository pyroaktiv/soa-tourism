package main

import (
	"context"
	"embed"
	"log"
	"net/http"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/rs/cors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	authv1 "github.com/pyroaktiv/soa-tourism/gateway/gen/go/tourism/auth/v1"
	blogv1 "github.com/pyroaktiv/soa-tourism/gateway/gen/go/tourism/blog/v1"
	followerv1 "github.com/pyroaktiv/soa-tourism/gateway/gen/go/tourism/follower/v1"
	paymentv1 "github.com/pyroaktiv/soa-tourism/gateway/gen/go/tourism/payment/v1"
	stakeholdersv1 "github.com/pyroaktiv/soa-tourism/gateway/gen/go/tourism/stakeholders/v1"
	tourv1 "github.com/pyroaktiv/soa-tourism/gateway/gen/go/tourism/tour/v1"
	simulatorv1 "github.com/pyroaktiv/soa-tourism/gateway/gen/go/tourism/simulator/v1"
	"github.com/pyroaktiv/soa-tourism/gateway/internal/config"
)

//go:embed api/swagger
var swaggerFS embed.FS

func main() {
	cfg := config.Load()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// grpcMux translates incoming HTTP requests into gRPC calls.
	grpcMux := runtime.NewServeMux()

	dialOpts := []grpc.DialOption{
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	}

	// To add a new service:
	// 1. add its proto under proto/ with google.api.http annotations.
	// 2. run `make generate`.
	// 4. call RegisterNewServiceHandlerFromEndpoint here.

	if err := authv1.RegisterAuthServiceHandlerFromEndpoint(
		ctx, grpcMux, cfg.ServiceAddr("auth"), dialOpts,
	); err != nil {
		log.Fatalf("register AuthService: %v", err)
	}

	if err := blogv1.RegisterBlogServiceHandlerFromEndpoint(
		ctx, grpcMux, cfg.ServiceAddr("blog"), dialOpts,
	); err != nil {
		log.Fatalf("register BlogService: %v", err)
	}

	if err := stakeholdersv1.RegisterStakeholderServiceHandlerFromEndpoint(
		ctx, grpcMux, cfg.ServiceAddr("stakeholders"), dialOpts,
	); err != nil {
		log.Fatalf("register StakeholderService: %v", err)
	}

	if err := followerv1.RegisterFollowerServiceHandlerFromEndpoint(
		ctx, grpcMux, cfg.ServiceAddr("follower"), dialOpts,
	); err != nil {
		log.Fatalf("register FollowerService: %v", err)
	}

	if err := tourv1.RegisterTourServiceHandlerFromEndpoint(
		ctx, grpcMux, cfg.ServiceAddr("tour"), dialOpts,
	); err != nil {
		log.Fatalf("register TourService: %v", err)
	}

	if err := simulatorv1.RegisterSimulatorServiceHandlerFromEndpoint(
		ctx, grpcMux, cfg.ServiceAddr("simulator"), dialOpts,
	); err != nil {
		log.Fatalf("register SimulatorService: %v", err)
	}

	if err := paymentv1.RegisterPaymentServiceHandlerFromEndpoint(
		ctx, grpcMux, cfg.ServiceAddr("payment"), dialOpts,
	); err != nil {
		log.Fatalf("register PaymentService: %v", err)
	}

	// Strip the "api/swagger" embed prefix so files are at /swagger/<path>.
	/*
		swaggerSub, err := fs.Sub(swaggerFS, "api/swagger")
		if err != nil {
			log.Fatalf("swagger sub-fs: %v", err)
		}
	*/
	httpMux := http.NewServeMux()
	httpMux.Handle("/swagger/", http.StripPrefix("/swagger/", http.FileServer(http.FS(swaggerFS))))
	httpMux.Handle("/", grpcMux)

	handler := cors.New(cors.Options{
		AllowedOrigins: cfg.CORSAllowedOrigins,
		AllowedMethods: []string{
			http.MethodGet, http.MethodPost, http.MethodPut,
			http.MethodPatch, http.MethodDelete, http.MethodOptions,
		},
		AllowedHeaders: []string{
			"Authorization", "Content-Type", "Accept",
			"Origin", "X-Requested-With",
		},
	}).Handler(httpMux)

	log.Printf("gateway listening on %s", cfg.HTTPAddr)
	if err := http.ListenAndServe(cfg.HTTPAddr, handler); err != nil {
		log.Fatalf("server: %v", err)
	}
}
