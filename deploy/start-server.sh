#!/usr/bin/env bash
# ==============================================================================
# DiffX / mDiff v3.7.0 — Mavenir Internal Web Server Launcher
# Developed by im_arg
# ==============================================================================

PORT=${1:-8097}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Detect primary server IP address (e.g. 10.x.x.x)
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ip route get 1 2>/dev/null | awk '{print $7}' || echo "10.10.84.22")

echo "=========================================================="
echo " Starting mDiff v3.7.0 on Mavenir Internal Network"
echo " Target Port : $PORT"
echo " Detected IP : $SERVER_IP"
echo "=========================================================="

# Check if port is already in use
is_port_in_use() {
    local p=$1
    if command -v ss >/dev/null 2>&1; then
        if ss -tuln | grep -E "(:| )${p}\b" >/dev/null 2>&1; then return 0; fi
    elif command -v netstat >/dev/null 2>&1; then
        if netstat -tuln | grep -E "(:| )${p}\b" >/dev/null 2>&1; then return 0; fi
    elif command -v lsof >/dev/null 2>&1; then
        if lsof -Pi :${p} -sTCP:LISTEN -t >/dev/null 2>&1; then return 0; fi
    fi
    return 1
}

if is_port_in_use "$PORT"; then
    echo "[ERROR] Port $PORT is ALREADY IN USE on this server!"
    echo "Currently listening ports around $PORT:"
    (ss -tuln 2>/dev/null || netstat -tuln 2>/dev/null) | grep -E ":(809[0-9]|808[0-9])\b" || true
    echo "Please specify a free port. Example: ./start-server.sh 8098"
    exit 1
fi

# Strategy 1: Docker / Podman (Containerized)
CONTAINER_CLI=""
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    CONTAINER_CLI="docker"
elif command -v podman >/dev/null 2>&1; then
    CONTAINER_CLI="podman"
fi

if [ -n "$CONTAINER_CLI" ]; then
    echo "[INFO] $CONTAINER_CLI detected. Attempting to start container on port $PORT..."
    $CONTAINER_CLI rm -f diffx-web 2>/dev/null || true
    
    # Try running container
    if $CONTAINER_CLI run -d \
        --name diffx-web \
        --restart unless-stopped \
        -p "${PORT}:80" \
        -v "$SCRIPT_DIR/dist":/usr/share/nginx/html:ro \
        docker.io/library/nginx:alpine </dev/null 2>/dev/null; then
        
        sleep 1
        echo ""
        echo "=========================================================="
        echo " SUCCESS! DiffX is live via $CONTAINER_CLI container"
        echo " Accessible URL : http://${SERVER_IP}:${PORT}"
        echo " To stop        : ./stop-server.sh"
        echo "=========================================================="
        exit 0
    else
        echo "[WARN] $CONTAINER_CLI container failed (offline image or permissions). Falling back to Python 3..."
    fi
fi

# Strategy 2: Python 3 HTTP Server (Standard on RHEL / CentOS / Linux)
if command -v python3 >/dev/null 2>&1; then
    echo "[INFO] Starting standalone Python 3 HTTP server on 0.0.0.0:$PORT..."
    cd "$SCRIPT_DIR/dist"
    nohup python3 -m http.server "$PORT" --bind 0.0.0.0 > "$SCRIPT_DIR/diffx.log" 2>&1 &
    PID=$!
    echo "$PID" > "$SCRIPT_DIR/diffx.pid"
    
    sleep 1
    if kill -0 "$PID" 2>/dev/null; then
        echo ""
        echo "=========================================================="
        echo " SUCCESS! DiffX is running in background (PID: $PID)"
        echo " Accessible URL : http://${SERVER_IP}:${PORT}"
        echo " Logs           : tail -f $SCRIPT_DIR/diffx.log"
        echo " To stop        : ./stop-server.sh"
        echo "=========================================================="
        exit 0
    fi
    echo "[WARN] Python server failed to bind. Trying Node.js..."
fi

# Strategy 3: Node.js / npx serve
if command -v npx >/dev/null 2>&1; then
    echo "[INFO] Starting Node.js static server on port $PORT..."
    cd "$SCRIPT_DIR/dist"
    nohup npx -y serve -s . -l "$PORT" > "$SCRIPT_DIR/diffx.log" 2>&1 &
    PID=$!
    echo "$PID" > "$SCRIPT_DIR/diffx.pid"
    
    echo ""
    echo "=========================================================="
    echo " SUCCESS! DiffX is running in background (PID: $PID)"
    echo " Accessible URL : http://${SERVER_IP}:${PORT}"
    echo " To stop        : ./stop-server.sh"
    echo "=========================================================="
    exit 0
fi

echo "[ERROR] Neither Docker, Podman, Python 3, nor Node.js was found on this server."
echo "Please install Docker, Podman, Python 3, or Nginx to host DiffX."
exit 1
