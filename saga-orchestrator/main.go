package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/nats-io/nats.go"
	"github.com/pyroaktiv/soa-tourism/saga-orchestrator/internal/orchestrator"
)

func main() {
	// Povezivanje na NATS (dodati config iz okruženja kasnije)
	natsURL := os.Getenv("NATS_URL")
	if natsURL == "" {
		natsURL = nats.DefaultURL
	}

	nc, err := nats.Connect(natsURL)
	if err != nil {
		log.Fatalf("Failed to connect to NATS: %v", err)
	}
	defer nc.Close()

	log.Println("Connected to NATS.")

	// Inicijalizacija orkestratora za proces blokiranja autora
	blockAuthorOrchestrator := orchestrator.NewBlockAuthorOrchestrator(nc)
	if err := blockAuthorOrchestrator.Start(); err != nil {
		log.Fatalf("Failed to start orchestrator: %v", err)
	}

	log.Println("Orchestrator is running. Waiting for events...")

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down orchestrator...")
}
