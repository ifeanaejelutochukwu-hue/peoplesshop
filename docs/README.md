# Peoplesshop — Clothing Retail Management System

A complete web-based retail management platform for a clothing shop.

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Go 1.21+
- Node.js 20+

### 1. Start the database

```bash
cd /home/l2e/Peoplesshop
docker compose up -d postgres
```

### 2. Start the backend

```bash
cd backend
./bin/api
# or rebuild first:
go build -o bin/api ./cmd/api && ./bin/api
```

The API starts on **http://localhost:8080**

### 3. Start the frontend

```bash
cd frontend
npm run dev
```

The app opens at **http://localhost:3000**

---

## Default Login

| Username | Password     | Role  |
|----------|-------------|-------|
| admin    | Admin@2026! | Owner |

**Change this password immediately after first login** via Staff → Reset Password.

---

## Architecture

```
frontend/          Next.js 14 (App Router) + TypeScript + Tailwind
backend/           Go + Chi router + pgx/v5
  cmd/api/         HTTP server entry point + router
  internal/
    auth/          JWT tokens + bcrypt password hashing
    config/        Environment configuration
    db/            Connection pool + migrations
    handler/       HTTP handlers (one per domain)
    middleware/     JWT auth + permission checks
    model/         Domain types
    repository/    Database queries
    service/       Business logic
  migrations/      SQL migration files
docker/            PostgreSQL Docker config
```

## Money / Currency

All monetary values are stored as **kobo** (integer minor units).  
₦1 = 100 kobo. Never floating-point.

The frontend utility `formatMoney(kobo)` converts to display format.

## Security

- Passwords: bcrypt cost 12
- Auth: JWT access token (15 min) + refresh token (7 days)
- Permissions: enforced on every backend route, not just UI
- SQL: parameterised queries via pgx — no string interpolation
- CORS: restricted to `NEXT_PUBLIC_API_URL` origin

## Environment Variables

Copy `.env.example` to `.env` and `.env.local` for the frontend.

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | 32+ char random string |
| `JWT_REFRESH_SECRET` | Different 32+ char random string |
| `NEXT_PUBLIC_API_URL` | Backend API base URL |

## Roles

| Role      | Key Capabilities |
|-----------|-----------------|
| owner     | Full access — all operations |
| manager   | Day-to-day ops, no staff management |
| attendant | POS only, own sales history |
