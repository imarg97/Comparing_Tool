# mDiff — Mavenir Lab Server Deployment & Runbook Guide

**Host Server**: `bglocp-installer` (`10.10.84.22`)  
**Network**: Mavenir VPN Internal Network  
**Target Port**: `8097` (Verified Free & Routable)  
**Production URL**: `http://10.10.84.22:8097`  
**Application Version**: `v3.7.0`  

---

## 1. Architecture Overview

On the internal network, mDiff operates as a high-performance, lightweight web application. The deployment package is completely self-contained with zero external internet dependencies:

```
+-----------------------------------------------------------------------------------------+
| Mavenir Lab Host: bglocp-installer (10.10.84.22)                                        |
|                                                                                         |
|  [Port 8097]                                                                            |
|       |                                                                                 |
|       v                                                                                 |
|  +-----------------------------------------------------------------------------------+  |
|  | Container (Podman / Docker) OR Python 3 Standalone Server                        |  |
|  | - Serves static pre-compiled bundles: HTML, CSS, Monaco Editor Web Workers, JS    |  |
|  +-----------------------------------------------------------------------------------+  |
|       |                                                                                 |
+-------|---------------------------------------------------------------------------------+
        | HTTP (Internal Only)
        v
+-----------------------------------------------------------------------------------------+
| User Laptop (Edge / Chrome / Safari over Mavenir VPN)                                   |
|                                                                                         |
|  - Monaco Diff Engine runs inside client browser RAM / CPU                              |
|  - Pure JavaScript SHA-256 fallback engine computes hashes offline                      |
|  - Zero files, zero configs, and zero diff outputs are sent back to the server          |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Server Port Allocation Audit

Before deployment, a full port audit was performed on `bglocp-installer`:

| Port | Status | Process / Service | Notes |
| :---: | :---: | :--- | :--- |
| **8080** | **OCCUPIED** | `conmon` (PID 4061676) | OpenShift container monitor |
| **5000** | **OCCUPIED** | `python` (PID 940007) | Internal service |
| **5001** | **OCCUPIED** | `python` (PID 457433) | Internal service |
| **11434**| **OCCUPIED** | `ollama` (PID 202397) | Internal AI engine |
| **8097** | **>>> FREE TO USE <<<** | **mDiff Web Service** | **Active Production Port** |

Firewall status: `firewalld` is inactive on `bglocp-installer`, ensuring port `8097` is immediately routable across the Mavenir VPN.

---

## 3. Deployment Runbook & Quick Commands

### A. Transfer Package to Host
From your local terminal, transfer the deployment archive to the server:
```bash
scp release/mDiff-internal-web-deployment.tar.gz root@10.10.84.22:/root/DiffX/
```

### B. Extract and Launch
Log into the server and run the automated launcher:
```bash
ssh root@10.10.84.22
cd /root/DiffX
tar -xzf mDiff-internal-web-deployment.tar.gz
cd mdiff
chmod +x *.sh *.py
./start-server.sh 8097
```

The script automatically probes the system:
1. **Container Engine (Docker / Podman)**: Uses fully-qualified image names (`docker.io/library/nginx:alpine`) with SELinux `:ro,Z` volume mounts and `/dev/null` redirection to prevent interactive terminal prompts or SELinux permission denials.
2. **Python 3 High-Performance Server (`serve.py`)**: When container engines are absent or restricted, automatically starts `serve.py`—a multi-threaded `ThreadingHTTPServer` with guaranteed ES Module MIME types (`.js` as `application/javascript`, `.wasm` as `application/wasm`, `.css` as `text/css`) and SPA routing fallback.
3. Prints the live internal URL: `http://10.10.84.22:8097`.

---

## 4. Troubleshooting: Infinite Loading / Blank Screen Resolution

### Root Cause Analysis (Why `python3 -m http.server` hung)
1. **ES Module MIME Type Enforcement**: Modern browsers (Edge / Chrome) strictly enforce MIME types for `<script type="module">`. On minimal enterprise RHEL/CentOS systems without `/etc/mime.types` installed, the default Python CLI `http.server` serves `.js` files as `text/plain` or `application/octet-stream`. The browser refuses to execute the script for security reasons and hangs indefinitely.
2. **Single-Threaded Socket Starvation**: Python's built-in `http.server` module CLI is single-threaded. When a modern browser fires concurrent requests for the 4MB JS bundle, stylesheet, and web workers over VPN, connections queue and timeout.
3. **Container Registry Prompts**: On RHEL systems, calling unqualified `nginx:alpine` in Podman triggered an interactive prompt (`? Please select an image:`), blocking non-interactive startup.

### The Permanent Fix in v3.7.0
- **`serve.py`**: Custom multi-threaded server using Python's `ThreadingHTTPServer` with an explicit in-memory MIME dictionary, cache control headers, and single-page-app routing fallback.
- **Enhanced `start-server.sh`**: Directly wires `serve.py`, adds SELinux `:ro,Z` volume flags for containers, suppresses interactive prompts, and writes verified logs to `mdiff.log`.

---

## 5. Operational Maintenance

### Check Service Status
```bash
ss -tuln | grep 8097
# or check container status
podman ps | grep mdiff || docker ps | grep mdiff
```

### Stopping the Service
```bash
./stop-server.sh
```

### Hot Upgrades (Zero Downtime)
To upgrade to a newer release:
```bash
tar -xzf mDiff-internal-web-deployment.tar.gz
./start-server.sh 8097
```
`start-server.sh` stops any existing listener on port `8097` cleanly before spawning the updated version.
