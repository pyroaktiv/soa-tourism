package config

import (
	"fmt"
	"os"
	"strings"
)

type Config struct {
	GRPCAddr           string
	PostgresURI        string
	AuthServiceAddr    string
	TourServiceAddr    string
}

func Load() Config {
	grpcAddr := os.Getenv("GRPC_ADDR")
	if grpcAddr == "" {
		grpcAddr = "0.0.0.0:9090"
	}

	pgURI := os.Getenv("POSTGRES_URI")
	if pgURI == "" {
		pgURI = "postgres://payment:payment@payment-db:5432/paymentdb?sslmode=disable"
	}

	authAddr := os.Getenv("AUTH_SERVICE_ADDR")
	if authAddr == "" {
		authAddr = "auth-service:9090"
	}

	tourAddr := os.Getenv("TOUR_SERVICE_ADDR")
	if tourAddr == "" {
		tourAddr = "tour:9090"
	}

	return Config{
		GRPCAddr:        grpcAddr,
		PostgresURI:     pgURI,
		AuthServiceAddr: authAddr,
		TourServiceAddr: tourAddr,
	}
}

func (c Config) ServiceAddr(name string) string {
	key := fmt.Sprintf("%s_SERVICE_ADDR", strings.ToUpper(name))
	if addr := os.Getenv(key); addr != "" {
		return addr
	}
	return fmt.Sprintf("%s:9090", name)
}
