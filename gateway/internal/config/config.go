package config

import (
	"fmt"
	"os"
	"strings"
)

// Config holds gateway configuration loaded from environment variables.
type Config struct {
	// HTTPAddr is the address the HTTP gateway listens on (default: ":8080").
	HTTPAddr string
	// CORSAllowedOrigins is a comma-separated list of allowed CORS origins (default: "*").
	CORSAllowedOrigins []string
}

// Load reads gateway configuration from environment variables and applies defaults.
func Load() Config {
	httpAddr := os.Getenv("HTTP_ADDR")
	if httpAddr == "" {
		httpAddr = ":8080"
	}

	corsOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
	if corsOrigins == "" {
		corsOrigins = "*"
	}

	return Config{
		HTTPAddr:           httpAddr,
		CORSAllowedOrigins: strings.Split(corsOrigins, ","),
	}
}

// ServiceAddr returns the gRPC address for a named backend service.
// It reads <UPPER_NAME>_SERVICE_ADDR from the environment, e.g. "tours" → TOURS_SERVICE_ADDR.
// Falls back to "<name>:9090" if the variable is not set.
func (c Config) ServiceAddr(name string) string {
	key := fmt.Sprintf("%s_SERVICE_ADDR", strings.ToUpper(name))
	if addr := os.Getenv(key); addr != "" {
		return addr
	}
	return fmt.Sprintf("%s:9090", name)
}
