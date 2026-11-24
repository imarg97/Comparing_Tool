# mDiff v7.0.0 — Mavenir Internal Deployment Guide

This package contains everything needed to deploy mDiff (Mavenir Diff, formerly DiffX) on Mavenir's internal network (e.g. `10.10.84.22` or any internal lab VM / Docker / Podman host).

---

## Quick Start (1 Command)

To run mDiff on port `8097` (or any custom port):

```bash
# Default port 8097 (verified free)
./start-server.sh

# Or specify any desired port
./start-server.sh 8097
```

The script automatically detects if **Docker**, **Podman**, **Python 3**, or **Node.js** is present, starts mDiff in the background, and prints your internal URL:
```
http://10.10.84.22:8097
```

To stop the server at any time:
```bash
./stop-server.sh
```

---

## Deployment Options

### Option 1: Docker / Podman / Docker Compose
```bash
# Run using docker compose
docker compose up -d

# Or run directly with docker / podman run:
docker run -d --name mdiff-web --restart unless-stopped -p 8097:80 -v $(pwd)/dist:/usr/share/nginx/html:ro docker.io/library/nginx:alpine
```

### Option 2: Standalone Linux Server (Python 3 - Threaded, Zero-Dependency)
```bash
# Start multi-threaded server with guaranteed MIME types and SPA fallback:
./start-server.sh 8097

# Or run directly via Python 3:
nohup python3 serve.py 8097 > mdiff.log 2>&1 &
```

### Option 3: Standard Enterprise Nginx
Copy `nginx.conf` to `/etc/nginx/conf.d/mdiff.conf`, edit `root` to point to the `dist` directory, and run `nginx -s reload`.
