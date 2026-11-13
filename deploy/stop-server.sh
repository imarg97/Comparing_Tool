#!/usr/bin/env bash
# ==============================================================================
# mDiff v3.7.0 — Stop Server Script
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Stopping mDiff web server..."

# Stop Docker if running
if command -v docker >/dev/null 2>&1; then
    for cname in mdiff-web diffx-web; do
        if docker ps -q -f name="$cname" | grep -q .; then
            echo "Stopping Docker container $cname..."
            docker stop "$cname" && docker rm "$cname"
            echo "Docker container $cname stopped."
        fi
    done
fi

# Stop Podman if running
if command -v podman >/dev/null 2>&1; then
    for cname in mdiff-web diffx-web; do
        if podman ps -q -f name="$cname" | grep -q .; then
            echo "Stopping Podman container $cname..."
            podman stop "$cname" && podman rm "$cname"
            echo "Podman container $cname stopped."
        fi
    done
fi

# Stop PIDs if running
for pidfile in "$SCRIPT_DIR/mdiff.pid" "$SCRIPT_DIR/diffx.pid"; do
    if [ -f "$pidfile" ]; then
        PID=$(cat "$pidfile")
        if kill -0 "$PID" 2>/dev/null; then
            echo "Killing process $PID..."
            kill "$PID" 2>/dev/null || kill -9 "$PID" 2>/dev/null
            echo "Process $PID stopped."
        fi
        rm -f "$pidfile"
    fi
done

# Kill any python serve.py instances still running from script directory
pkill -f "python3.*serve.py" 2>/dev/null || true

echo "mDiff web server stopped."
