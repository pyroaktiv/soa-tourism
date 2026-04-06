package main

import (
	"context"
	"embed"
	"io/fs"
	"log"
	"net/http"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/rs/cors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	authv1 "github.com/pyroaktiv/soa-tourism/gateway/gen/go/tourism/auth/v1"
	blogv1 "github.com/pyroaktiv/soa-tourism/gateway/gen/go/tourism/blog/v1"
	examplev1 "github.com/pyroaktiv/soa-tourism/gateway/gen/go/tourism/example/v1"
	stakeholdersv1 "github.com/pyroaktiv/soa-tourism/gateway/gen/go/tourism/stakeholders/v1"
	"github.com/pyroaktiv/soa-tourism/gateway/internal/config"
)

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

	if err := examplev1.RegisterHealthServiceHandlerFromEndpoint(
		ctx, grpcMux, cfg.ServiceAddr("example"), dialOpts,
	); err != nil {
		log.Fatalf("register HealthService: %v", err)
	}

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

	// Strip the "api/swagger" embed prefix so files are at /swagger/<path>.
	swaggerSub, err := fs.Sub(swaggerFS, "api/swagger")
	if err != nil {
		log.Fatalf("swagger sub-fs: %v", err)
	}

	httpMux := http.NewServeMux()
	httpMux.Handle("/swagger/", http.StripPrefix("/swagger/", http.FileServer(http.FS(swaggerSub))))
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
