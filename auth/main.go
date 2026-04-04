package main

import (
	"context"
	"log"
	"net"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"google.golang.org/grpc"

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

	lis, err := net.Listen("tcp", cfg.GRPCAddr)
	if err != nil {
		log.Fatalf("listen %s: %v", cfg.GRPCAddr, err)
	}

	srv := grpc.NewServer()
	authv1.RegisterAuthServiceServer(srv, auth.NewService(cfg, db))

	log.Printf("auth listening on %s", cfg.GRPCAddr)
	if err := srv.Serve(lis); err != nil {
		log.Fatalf("serve: %v", err)
	}
}
