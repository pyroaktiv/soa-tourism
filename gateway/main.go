package main

import (
	"context"
	"embed"
	"log"
	"net/http"
	"os"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/rs/cors"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	authv1 "github.com/pyroaktiv/soa-tourism/gateway/gen/go/tourism/auth/v1"
	blogv1 "github.com/pyroaktiv/soa-tourism/gateway/gen/go/tourism/blog/v1"
	followerv1 "github.com/pyroaktiv/soa-tourism/gateway/gen/go/tourism/follower/v1"
	stakeholdersv1 "github.com/pyroaktiv/soa-tourism/gateway/gen/go/tourism/stakeholders/v1"
	tourv1 "github.com/pyroaktiv/soa-tourism/gateway/gen/go/tourism/tour/v1"
	"github.com/pyroaktiv/soa-tourism/gateway/internal/config"
)

//go:embed api/swagger
var swaggerFS embed.FS

func initTracer(ctx context.Context) (func(context.Context) error, error) {
	otelAddr := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if otelAddr == "" {
		otelAddr = "otel-collector:4317"
	}

	exp, err := otlptracegrpc.New(ctx,
		otlptracegrpc.WithEndpoint(otelAddr),
		otlptracegrpc.WithInsecure(),
	)
	if err != nil {
		return nil, err
	}

	res, _ := resource.New(ctx,
		resource.WithAttributes(semconv.ServiceNameKey.String("gateway")),
	)

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exp),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
	)
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))
	return tp.Shutdown, nil
}

func main() {
	cfg := config.Load()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	shutdownTracer, err := initTracer(ctx)
	if err != nil {
		log.Fatalf("init tracer: %v", err)
	}
	defer shutdownTracer(context.Background())

	// grpcMux translates incoming HTTP requests into gRPC calls.
	grpcMux := runtime.NewServeMux()

	dialOpts := []grpc.DialOption{
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithStatsHandler(otelgrpc.NewClientHandler()),
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

	tracingHandler := otelhttp.NewHandler(handler, "gateway")

	log.Printf("gateway listening on %s", cfg.HTTPAddr)
	if err := http.ListenAndServe(cfg.HTTPAddr, tracingHandler); err != nil {
		log.Fatalf("server: %v", err)
	}
}
