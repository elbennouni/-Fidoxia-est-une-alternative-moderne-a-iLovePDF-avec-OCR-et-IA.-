#!/bin/bash
# SeriesForge AI — Startup script with auto-restart

echo "🎬 Démarrage SeriesForge AI..."

# Kill any existing processes
pkill -f "next dev" 2>/dev/null
pkill -f cloudflared 2>/dev/null
sleep 2

# Start Next.js server
cd /workspace/seriesforge
nohup node_modules/.bin/next dev --port 3000 > /tmp/nextjs.log 2>&1 &
NEXT_PID=$!
echo "✅ Serveur Next.js démarré (PID: $NEXT_PID)"

# Wait for server to be ready
sleep 12

# Auto-restart tunnel loop
echo "🔗 Démarrage tunnel auto-restart..."
while true; do
    /tmp/cloudflared tunnel --url http://localhost:3000 2>&1 | tee /tmp/tunnel.log
    echo "⚠ Tunnel coupé — redémarrage dans 3 secondes..."
    sleep 3
done
