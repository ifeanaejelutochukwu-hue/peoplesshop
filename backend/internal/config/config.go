package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

// Config holds all application configuration loaded from environment variables.
type Config struct {
	AppEnv  string
	AppPort string

	DBHost     string
	DBPort     string
	DBName     string
	DBUser     string
	DBPassword string
	DBSSLMode  string
	DatabaseURL string

	JWTAccessSecret        string
	JWTRefreshSecret       string
	JWTAccessExpiry        time.Duration
	JWTRefreshExpiry       time.Duration

	CORSAllowedOrigins string

	UploadDir       string
	UploadMaxSizeMB int64

	LogLevel string
}

// Load reads configuration from environment variables.
// It loads a .env file if present (development only).
func Load() (*Config, error) {
	// Load .env file if it exists — ignore error if it doesn't
	_ = godotenv.Load()

	cfg := &Config{
		AppEnv:  getEnv("APP_ENV", "development"),
		AppPort: getEnv("APP_PORT", "8080"),

		DBHost:      getEnv("DB_HOST", "localhost"),
		DBPort:      getEnv("DB_PORT", "5432"),
		DBName:      getEnv("DB_NAME", "peoplesshop"),
		DBUser:      getEnv("DB_USER", "peoplesshop"),
		DBPassword:  getEnv("DB_PASSWORD", ""),
		DBSSLMode:   getEnv("DB_SSL_MODE", "disable"),
		DatabaseURL: getEnv("DATABASE_URL", ""),

		JWTAccessSecret:  getEnv("JWT_ACCESS_SECRET", ""),
		JWTRefreshSecret: getEnv("JWT_REFRESH_SECRET", ""),

		CORSAllowedOrigins: getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000"),
		UploadDir:          getEnv("UPLOAD_DIR", "./uploads"),
		LogLevel:           getEnv("LOG_LEVEL", "info"),
	}

	// Parse JWT expiry durations
	accessMins, err := strconv.Atoi(getEnv("JWT_ACCESS_EXPIRY_MINUTES", "15"))
	if err != nil {
		return nil, fmt.Errorf("invalid JWT_ACCESS_EXPIRY_MINUTES: %w", err)
	}
	cfg.JWTAccessExpiry = time.Duration(accessMins) * time.Minute

	refreshDays, err := strconv.Atoi(getEnv("JWT_REFRESH_EXPIRY_DAYS", "7"))
	if err != nil {
		return nil, fmt.Errorf("invalid JWT_REFRESH_EXPIRY_DAYS: %w", err)
	}
	cfg.JWTRefreshExpiry = time.Duration(refreshDays) * 24 * time.Hour

	maxMB, err := strconv.ParseInt(getEnv("UPLOAD_MAX_SIZE_MB", "5"), 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid UPLOAD_MAX_SIZE_MB: %w", err)
	}
	cfg.UploadMaxSizeMB = maxMB

	// Build DatabaseURL if not directly provided
	if cfg.DatabaseURL == "" {
		cfg.DatabaseURL = fmt.Sprintf(
			"postgres://%s:%s@%s:%s/%s?sslmode=%s",
			cfg.DBUser, cfg.DBPassword, cfg.DBHost, cfg.DBPort, cfg.DBName, cfg.DBSSLMode,
		)
	}

	// Validate required secrets
	if cfg.JWTAccessSecret == "" {
		return nil, fmt.Errorf("JWT_ACCESS_SECRET must be set")
	}
	if cfg.JWTRefreshSecret == "" {
		return nil, fmt.Errorf("JWT_REFRESH_SECRET must be set")
	}

	return cfg, nil
}

func getEnv(key, defaultValue string) string {
	if v, ok := os.LookupEnv(key); ok {
		return v
	}
	return defaultValue
}
