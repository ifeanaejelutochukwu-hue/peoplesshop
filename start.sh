#!/bin/bash
# ============================================================
# Peoplesshop — Start Everything
# Usage:  ./start.sh
# ============================================================

set -e
cd "$(dirname "$0")"

LAN_IP="10.2.254.23"

echo ""
echo "  Starting Peoplesshop..."
echo ""

# 1. Database
echo "  [1/3] Database..."
docker compose up -d postgres > /dev/null 2>&1
until docker exec peoplesshop_db pg_isready -U peoplesshop -q 2>/dev/null; do
  sleep 1
done
echo "        OK"

# 2. Backend
echo "  [2/3] Backend API..."
# Kill any old instance first
fuser -k 8080/tcp > /dev/null 2>&1 || true
sleep 1
cd backend
./bin/api > /tmp/peoplesshop-api.log 2>&1 &
echo $! > /tmp/peoplesshop-api.pid
cd ..
sleep 2
curl -sf http://localhost:8080/health > /dev/null && echo "        OK" || echo "        FAILED — check /tmp/peoplesshop-api.log"

# 3. Frontend
echo "  [3/3] Frontend..."
fuser -k 3000/tcp > /dev/null 2>&1 || true
sleep 1
cd frontend
npm run start > /tmp/peoplesshop-frontend.log 2>&1 &
echo $! > /tmp/peoplesshop-frontend.pid
cd ..
sleep 3

echo ""
echo "  ============================================"
echo "  Peoplesshop is running"
echo ""
echo "  This machine:  http://localhost:3000"
echo "  Other devices: http://$LAN_IP:3000"
echo ""
echo "  Login:  admin / Admin@2026!"
echo "  ============================================"
echo ""
echo "  Logs:"
echo "    API:      tail -f /tmp/peoplesshop-api.log"
echo "    Frontend: tail -f /tmp/peoplesshop-frontend.log"
echo ""
echo "  To stop:  ./stop.sh"
echo ""
