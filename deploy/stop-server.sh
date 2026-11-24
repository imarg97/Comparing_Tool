#!/usr/bin/env bash
# ==============================================================================
# mDiff v7.0.0 — Stop Server Script
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Stopping mDiff web server..."

# Stop Podman / Docker containers if running
for cli in podman docker; do
    if command -v $cli >/dev/null 2>&1; then
        for cname in mdiff-web diffx-web; do
            if $cli ps -q -f name="$cname" 2>/dev/null | grep -q .; then
                echo "Stopping $cli container $cname..."
                $cli stop "$cname" >/dev/null 2>&1 || true
                $cli rm "$cname" >/dev/null 2>&1 || true
                echo "Container $cname stopped."
            fi
        done
    fi
done

# Stop PIDs if recorded in pid files
for pidfile in "$SCRIPT_DIR/mdiff.pid" "$SCRIPT_DIR/diffx.pid"; do
    if [ -f "$pidfile" ]; then
        PID=$(cat "$pidfile")
        if kill -0 "$PID" 2>/dev/null; then
            echo "Stopping recorded process $PID..."
            kill "$PID" 2>/dev/null || kill -9 "$PID" 2>/dev/null
            echo "Process $PID stopped."
        fi
        rm -f "$pidfile"
    fi
done

# Kill any python serve.py instances running from this directory
pkill -f "python3.*serve.py" 2>/dev/null || true

echo "mDiff web server stopped."
