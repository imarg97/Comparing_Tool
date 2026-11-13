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
chmod +x *.sh
./start-server.sh 8097
```

The script automatically probes the system:
1. Detects `docker` or `podman`.
2. Starts containerized Nginx on port `8097`.
3. If container engines are locked or restricted, gracefully falls back to standalone Python 3:
   ```bash
   python3 -m http.server 8097 --bind 0.0.0.0
   ```
4. Prints the live internal URL: `http://10.10.84.22:8097`.

---

## 4. Operational Maintenance

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
