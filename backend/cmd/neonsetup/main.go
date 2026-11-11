// Temporary tool — sets up Neon extensions and clears dirty migration state
package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5"
)

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL not set")
	}

	ctx := context.Background()
	conn, err := pgx.Connect(ctx, dbURL)
	if err != nil {
		log.Fatalf("connect: %v", err)
	}
	defer conn.Close(ctx)
	fmt.Println("Connected to Neon")

	for _, ext := range []string{"pgcrypto", "pg_trgm"} {
		if _, err := conn.Exec(ctx, "CREATE EXTENSION IF NOT EXISTS "+ext); err != nil {
			log.Fatalf("extension %s: %v", ext, err)
		}
		fmt.Printf("Extension %s: OK\n", ext)
	}

	// Drop the migrate state table so the Go API can apply migrations cleanly
	if _, err := conn.Exec(ctx, "DROP TABLE IF EXISTS schema_migrations"); err != nil {
		log.Fatalf("drop schema_migrations: %v", err)
	}
	fmt.Println("schema_migrations cleared: OK")
	fmt.Println("Neon database is ready — start the API to apply migrations")
}
