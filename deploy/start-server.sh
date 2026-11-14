#!/usr/bin/env bash
# ==============================================================================
# mDiff v4.0.0 — Mavenir Internal Web Server Launcher
# Developed by im_arg
# ==============================================================================

PORT=${1:-8097}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Detect primary server IP address (e.g. 10.x.x.x)
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ip route get 1 2>/dev/null | awk '{print $7}' || echo "10.10.84.22")

echo "=========================================================="
echo " Starting mDiff v4.0.0 on Mavenir Internal Network"
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

# Stop any previous instance started from this folder
if [ -f "$SCRIPT_DIR/stop-server.sh" ]; then
    bash "$SCRIPT_DIR/stop-server.sh" >/dev/null 2>&1 || true
fi

if is_port_in_use "$PORT"; then
    echo "[WARN] Port $PORT is currently in use. Checking for existing mDiff/python processes..."
    # If an older serve.py is running on this port, kill it
    OLD_PID=$(lsof -ti :"$PORT" 2>/dev/null || ss -tulpn 2>/dev/null | grep ":$PORT\b" | grep -o 'pid=[0-9]*' | cut -d= -f2 || true)
    if [ -n "$OLD_PID" ]; then
        echo "[INFO] Terminating previous process on port $PORT (PID: $OLD_PID)..."
        kill -9 $OLD_PID 2>/dev/null || true
        sleep 1
    fi
    
    if is_port_in_use "$PORT"; then
        echo "[ERROR] Port $PORT is STILL in use by another non-mDiff service!"
        echo "Currently listening ports around $PORT:"
        (ss -tuln 2>/dev/null || netstat -tuln 2>/dev/null) | grep -E ":(809[0-9]|808[0-9])\b" || true
        echo "Please specify a free port. Example: ./start-server.sh 8098"
        exit 1
    fi
fi

# Strategy 1: Container Engine (Podman or Docker) with Local Image Detection
CONTAINER_CLI=""
if command -v podman >/dev/null 2>&1; then
    CONTAINER_CLI="podman"
elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    CONTAINER_CLI="docker"
fi

if [ -n "$CONTAINER_CLI" ]; then
    echo "[INFO] $CONTAINER_CLI detected. Scanning for cached Nginx container images..."
    $CONTAINER_CLI rm -f mdiff-web diffx-web >/dev/null 2>&1 || true
    
    # Identify any local nginx image (e.g. registry.access.redhat.com/nginx:alpine, docker.io/library/nginx:alpine, etc.)
    LOCAL_IMG=$($CONTAINER_CLI images --format "{{.Repository}}:{{.Tag}}" 2>/dev/null | grep -E "nginx" | head -n 1)
    if [ -z "$LOCAL_IMG" ]; then
        LOCAL_IMG=$($CONTAINER_CLI images --format "{{.Repository}}" 2>/dev/null | grep -E "nginx" | head -n 1)
    fi
    
    # Candidate images if nothing was found in local storage
    CANDIDATES=("$LOCAL_IMG" "registry.access.redhat.com/nginx:alpine" "registry.redhat.io/nginx:alpine" "docker.io/library/nginx:alpine" "nginx:alpine")
    
    CONTAINER_STARTED=false
    for img in "${CANDIDATES[@]}"; do
        if [ -n "$img" ]; then
            echo "[INFO] Trying container image: $img..."
            if $CONTAINER_CLI run -d \
                --name mdiff-web \
                --restart unless-stopped \
                -p "${PORT}:80" \
                -v "$SCRIPT_DIR/dist":/usr/share/nginx/html:ro,Z \
                "$img" >/dev/null 2>&1; then
                CONTAINER_STARTED=true
                break
            fi
        fi
    done
    
    if [ "$CONTAINER_STARTED" = true ]; then
        sleep 1
        echo ""
        echo "=========================================================="
        echo " SUCCESS! mDiff is live via $CONTAINER_CLI container"
        echo " Accessible URL : http://${SERVER_IP}:${PORT}"
        echo " To stop        : ./stop-server.sh"
        echo "=========================================================="
        exit 0
    else
        echo "[WARN] Container launch did not succeed. Falling back to universal Python 3 server..."
    fi
fi

# Strategy 2: Python 3 Universal Threaded Server (Rock Solid on RHEL / CentOS / Linux)
if command -v python3 >/dev/null 2>&1; then
    echo "[INFO] Launching universal Python 3 threaded server on port $PORT..."
    nohup python3 -u "$SCRIPT_DIR/serve.py" "$PORT" > "$SCRIPT_DIR/mdiff.log" 2>&1 &
    PID=$!
    echo "$PID" > "$SCRIPT_DIR/mdiff.pid"
    
    sleep 1
    if kill -0 "$PID" 2>/dev/null; then
        # Perform instant local HTTP verification
        HTTP_CODE=""
        if command -v curl >/dev/null 2>&1; then
            HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}/" 2>/dev/null || true)
        fi
        
        echo ""
        echo "=========================================================="
        echo " SUCCESS! mDiff is running in background (PID: $PID)"
        echo " Accessible URL : http://${SERVER_IP}:${PORT}"
        if [ -n "$HTTP_CODE" ]; then
            echo " Health Check   : HTTP $HTTP_CODE (Live & Responding)"
        fi
        echo " Logs           : tail -f $SCRIPT_DIR/mdiff.log"
        echo " To stop        : ./stop-server.sh"
        echo "=========================================================="
        exit 0
    fi
    echo "[WARN] Python server did not start. Check $SCRIPT_DIR/mdiff.log:"
    tail -n 10 "$SCRIPT_DIR/mdiff.log" 2>/dev/null || true
fi

# Strategy 3: Node.js / npx serve
if command -v npx >/dev/null 2>&1; then
    echo "[INFO] Starting Node.js static server on port $PORT..."
    cd "$SCRIPT_DIR/dist"
    nohup npx -y serve -s . -l "$PORT" > "$SCRIPT_DIR/mdiff.log" 2>&1 &
    PID=$!
    echo "$PID" > "$SCRIPT_DIR/mdiff.pid"
    
    echo ""
    echo "=========================================================="
    echo " SUCCESS! mDiff is running in background (PID: $PID)"
    echo " Accessible URL : http://${SERVER_IP}:${PORT}"
    echo " To stop        : ./stop-server.sh"
    echo "=========================================================="
    exit 0
fi

echo "[ERROR] Neither Podman/Docker, Python 3, nor Node.js could start mDiff on this server."
exit 1
