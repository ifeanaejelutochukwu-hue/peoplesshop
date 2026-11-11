# ---- Build stage ----
# Use a recent Go image; GOTOOLCHAIN=auto lets it fetch the exact version if needed
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Allow Go to automatically download the required toolchain version
ENV GOTOOLCHAIN=auto

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

COPY --from=builder /app/bin/api ./bin/api
COPY --from=builder /app/migrations ./migrations

RUN mkdir -p uploads

EXPOSE 8080

CMD ["./bin/api"]
