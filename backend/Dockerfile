# ---- Build stage ----
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy dependency files first (better layer caching)
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY . .

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux go build -o bin/api ./cmd/api

# ---- Runtime stage ----
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/bin/api ./bin/api

# Copy migrations
COPY --from=builder /app/migrations ./migrations

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 8080

CMD ["./bin/api"]
