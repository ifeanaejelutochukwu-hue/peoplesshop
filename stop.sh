#!/bin/bash
# ============================================================
# Peoplesshop — Stop Everything
# ============================================================

echo "Stopping Peoplesshop..."

# Kill frontend
if [ -f /tmp/peoplesshop-frontend.pid ]; then
  kill $(cat /tmp/peoplesshop-frontend.pid) 2>/dev/null && echo "  Frontend stopped"
  rm -f /tmp/peoplesshop-frontend.pid
fi
fuser -k 3000/tcp > /dev/null 2>&1 || true

# Kill backend
if [ -f /tmp/peoplesshop-api.pid ]; then
  kill $(cat /tmp/peoplesshop-api.pid) 2>/dev/null && echo "  Backend stopped"
  rm -f /tmp/peoplesshop-api.pid
fi
fuser -k 8080/tcp > /dev/null 2>&1 || true

echo "Done."
