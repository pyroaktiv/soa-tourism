package config

import (
	"fmt"
	"os"
	"strings"
	"time"
)

type Config struct {
	GRPCAddr        string
	JWTSecret       string
	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration
	MongoURI        string
	MongoDB         string
}

func Load() Config {
	grpcAddr := os.Getenv("GRPC_ADDR")
	if grpcAddr == "" {
		grpcAddr = "0.0.0.0:9090"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "change-me-before-production"
	}

	accessDur := parseDuration(os.Getenv("ACCESS_TOKEN_DURATION"), 15*time.Minute)
	refreshDur := parseDuration(os.Getenv("REFRESH_TOKEN_DURATION"), 7*24*time.Hour)

	mongoURI := os.Getenv("MONGO_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://localhost:27017"
	}

	mongoDB := os.Getenv("MONGO_DB")
	if mongoDB == "" {
		mongoDB = "authdb"
	}

	return Config{
		GRPCAddr:        grpcAddr,
		JWTSecret:       jwtSecret,
		AccessTokenTTL:  accessDur,
		RefreshTokenTTL: refreshDur,
		MongoURI:        mongoURI,
		MongoDB:         mongoDB,
	}
}

func parseDuration(s string, fallback time.Duration) time.Duration {
	if s == "" {
		return fallback
	}
	d, err := time.ParseDuration(s)
	if err != nil {
		fmt.Printf("invalid duration %q, using default %s\n", s, fallback)
		return fallback
	}
	return d
}

func (c Config) ServiceAddr(name string) string {
	key := fmt.Sprintf("%s_SERVICE_ADDR", strings.ToUpper(name))
	if addr := os.Getenv(key); addr != "" {
		return addr
	}
	return fmt.Sprintf("%s:9090", name)
}
