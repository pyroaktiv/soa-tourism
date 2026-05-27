package main

import (
	"context"
	"log"
	"net"

	"google.golang.org/grpc"

	paymentv1 "github.com/pyroaktiv/soa-tourism/payment-service/gen/go/tourism/payment/v1"
	"github.com/pyroaktiv/soa-tourism/payment-service/internal/clients"
	"github.com/pyroaktiv/soa-tourism/payment-service/internal/config"
	"github.com/pyroaktiv/soa-tourism/payment-service/internal/payment"
	"github.com/pyroaktiv/soa-tourism/payment-service/internal/repository"
)

func main() {
	cfg := config.Load()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	repo, err := repository.New(ctx, cfg.PostgresURI)
	if err != nil {
		log.Fatalf("postgres: %v", err)
	}
	defer repo.Close()

	conns, err := clients.Dial(cfg.AuthServiceAddr, cfg.TourServiceAddr)
	if err != nil {
		log.Fatalf("dial dependencies: %v", err)
	}
	defer conns.Close()

	lis, err := net.Listen("tcp", cfg.GRPCAddr)
	if err != nil {
		log.Fatalf("listen %s: %v", cfg.GRPCAddr, err)
	}

	srv := grpc.NewServer()
	paymentv1.RegisterPaymentServiceServer(srv, payment.NewService(repo, conns))

	log.Printf("payment listening on %s", cfg.GRPCAddr)
	if err := srv.Serve(lis); err != nil {
		log.Fatalf("serve: %v", err)
	}
}
