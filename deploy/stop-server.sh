#!/usr/bin/env bash
# ==============================================================================
# DiffX v3.7.0 — Stop Server Script
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Stopping DiffX web server..."

# Stop Docker if running
if command -v docker >/dev/null 2>&1; then
    if docker ps -q -f name=diffx-web | grep -q .; then
        echo "Stopping Docker container diffx-web..."
        docker stop diffx-web && docker rm diffx-web
        echo "Docker container stopped."
        exit 0
    fi
fi

# Stop Podman if running
if command -v podman >/dev/null 2>&1; then
    if podman ps -q -f name=diffx-web | grep -q .; then
        echo "Stopping Podman container diffx-web..."
        podman stop diffx-web && podman rm diffx-web
        echo "Podman container stopped."
        exit 0
    fi
fi

# Stop PID if running
if [ -f "$SCRIPT_DIR/diffx.pid" ]; then
    PID=$(cat "$SCRIPT_DIR/diffx.pid")
    if kill -0 "$PID" 2>/dev/null; then
        echo "Killing process $PID..."
        kill "$PID"
        rm -f "$SCRIPT_DIR/diffx.pid"
        echo "DiffX process stopped."
        exit 0
    fi
    rm -f "$SCRIPT_DIR/diffx.pid"
fi

echo "DiffX does not appear to be running."
