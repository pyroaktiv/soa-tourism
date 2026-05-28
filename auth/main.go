package main

import (
	"context"
	"log"
	"net"
	"os"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"google.golang.org/grpc"

	"github.com/nats-io/nats.go"
	authv1 "github.com/pyroaktiv/soa-tourism/auth-service/gen/go/tourism/auth/v1"
	"github.com/pyroaktiv/soa-tourism/auth-service/internal/auth"
	"github.com/pyroaktiv/soa-tourism/auth-service/internal/config"
)

func main() {
	cfg := config.Load()

	client, err := mongo.Connect(options.Client().ApplyURI(cfg.MongoURI))
	if err != nil {
		log.Fatalf("mongo connect: %v", err)
	}
	defer func() {
		if err := client.Disconnect(context.Background()); err != nil {
			log.Printf("mongo disconnect: %v", err)
		}
	}()

	db := client.Database(cfg.MongoDB)

	natsURL := os.Getenv("NATS_URL")
	if natsURL == "" {
		natsURL = nats.DefaultURL
	}
	nc, err := nats.Connect(natsURL)
	if err != nil {
		log.Fatalf("nats connect to %s failed: %v", natsURL, err)
	}
	defer nc.Close()
	log.Printf("Auth service successfully connected to NATS at %s", natsURL)

	lis, err := net.Listen("tcp", cfg.GRPCAddr)
	if err != nil {
		log.Fatalf("listen %s: %v", cfg.GRPCAddr, err)
	}

	srv := grpc.NewServer()
	authv1.RegisterAuthServiceServer(srv, auth.NewService(cfg, db, nc))

	log.Printf("auth listening on %s", cfg.GRPCAddr)
	if err := srv.Serve(lis); err != nil {
		log.Fatalf("serve: %v", err)
	}
}
