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

	examplev1 "github.com/pyroaktiv/soa-tourism/gateway/gen/go/tourism/example/v1"
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
