-- PostgreSQL initialization script
-- Extensions required by Peoplesshop

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for fuzzy search on products/customers
