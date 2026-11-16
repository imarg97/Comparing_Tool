# mDiff (Mavenir Diff) — Enterprise Desktop & Web Comparison Suite

**Version**: `v5.0.0`  
**License**: Permissive Open-Source (100% MIT & ISC Compatible — Zero Copyleft)  
**Security Classification**: Air-Gapped / Zero-Telemetry / Portable User-Space Utility  
**Web Production URL**: `http://10.10.84.22:8097` *(Mavenir VPN)*  
**Primary Repository**: `https://github.com/imarg97/mdiff`  

---

## Overview

**mDiff** (Mavenir Diff) is an enterprise comparison suite tailored specifically for telecommunications engineering, cloud platform operations (OpenShift / Kubernetes), and DevOps workflows. 

Engineered with complete visual and behavioral fidelity to **Beyond Compare**, mDiff delivers side-by-side text diffing, deep cryptographic directory tree comparison, and semantic cellular/network XML, YAML, and JSON parameter comparisons across both native desktop operating systems (Windows & macOS) and internal air-gapped web servers.

---

## 📚 Complete Project Documentation

All official documentation has been organized into the [`docs/`](docs/) directory:

| Document | Description |
| :--- | :--- |
| **[📖 User Guide & How-To Manual](docs/HOW-TO-USE.md)** | Step-by-step instructions for Folder Compare, Text Compare, Config & XML Compare, Dynamic Difference Updates, and Keyboard Shortcuts. |
| **[🛡️ Second Security Audit Report](docs/SECURITY-AUDIT-REPORT.md)** | Cloudflare framework defensive audit evaluating 7 remediated vulnerability classes, trust boundaries, and test verification. |
| **[📋 Enterprise Security & Compliance](docs/ENTERPRISE-SECURITY.md)** | Management & IT compliance report covering zero-admin user-space execution, non-destructive file operations, and endpoint policies. |
| **[🔐 IT Security & SysAdmin Q&A](docs/IT-SECURITY-QA.md)** | Detailed answers for InfoSec, DLP, and endpoint administrators regarding zero network egress and Content Security Policy. |
| **[⚖️ Licensing & Legal Compliance](docs/LICENSING.md)** | Full audit of all 9 third-party libraries, confirming 100% MIT/ISC permissive licensing and zero copyleft/GPL risk. |
| **[🚀 Lab Server Deployment Runbook](docs/DEPLOYMENT-GUIDE.md)** | Complete operations guide for hosting and upgrading mDiff on Mavenir internal servers (`10.10.84.22:8097`). |

---

## Key Guarantees & Features in v5.0.0

### 1. Dynamic Difference Resolution & Real-Time Equality Updates
- **Instant In-Memory Diff Updates**: When files are edited or copied between Left and Right to make them equal (e.g. `bashrc`, `others.sh`), the diff status updates dynamically in real time. The left-side red font and center gutter (`≠`) immediately change back to clean black font and `=`.
- **Hierarchical Red-to-Black Folder Transition**: Parent directories containing differences display red folder icons and bold red text. As soon as all child differences are synchronized, the parent folder icon and name dynamically transition to solid black (`text-neutral-900`) with zero lag.
- **Instant Copy & Delete Operations**: Alt+Left / Alt+Right or context-menu copy immediately marks nodes as identical with 0ms visual latency, backed by filesystem verification.

### 2. Session Caching & Zero-Latency Tab Switching
- **In-Memory Folder Compare Retention**: Folder comparisons remain mounted and cached in memory across session tab switches. Switching from active text editing (`.bashrc`, `others.sh`, `values.yaml`) back to Folder Compare takes 0ms with zero re-scanning.
- **Home Screen Dashboard as Default Launch**: Applications open directly to the clean Beyond Compare-styled launcher dashboard with 5 comparison session options (Folder Compare, Text Compare, Config & XML, Folder Sync, and Table & Data).

### 3. Beyond Compare Visual Parity & Clean High-Contrast Typography
- **Clean Solid Black Typography**: Eliminates washed-out gray text (`#71717a`) on the right side pane. All identical and synchronized items render in clean, readable regular black font (`text-neutral-900` light / `text-neutral-100` dark), with bold red strictly highlighting active differences.
- **High-Contrast Monospace Typography**: Employs corporate standard monospace fonts (`Consolas`, `Lucida Console`, `DejaVu Sans Mono`, `Liberation Mono`) rendered with crisp contrast.
- **Box-Free Difference Highlighting**: Clean pastel rose row stripes (`#fdecec` light / `#2b1215` dark) and crisp bold red text (`#dc2626` light / `#ff5c5c` dark) strictly on differing characters.

### 4. Telecom & Cloud Structured Compare
- **Cellular XML Configurations**: Custom zero-dependency XML parser normalizes attributes, strips formatting differences, and highlights real parameter shifts between network snapshots.
- **Kubernetes / OpenShift YAML**: Built-in noise filters automatically suppress dynamic runtime noise (`resourceVersion`, `managedFields`, `creationTimestamp`, `uid`, `status`).

### 5. Absolute Privacy & Air-Gapped Execution
- **Zero Data Egress**: All diff computations execute strictly on the client CPU and RAM. No files, configs, keystrokes, or diff results are ever transmitted across the network or stored on the server.
- **Offline Self-Contained Bundles**: Zero external script dependencies (no Google Fonts, no public CDNs). Monaco Editor and all web workers are bundled locally.
- **Pure JavaScript SHA-256 Fallback**: Deterministic cryptographic hashing that runs reliably in all environments (including non-HTTPS internal network IPs).

---

## Pre-Built Distribution Packages (`release/`)

| Platform | Package Name | Format | Notes |
| :--- | :--- | :---: | :--- |
| **Windows (x64)** | `mDiff-windows-x64.zip` | Portable `.exe` | Extract and run `mDiff.exe`. No admin / UAC required. |
| **Windows (ARM64)** | `mDiff-windows-arm64.zip` | Portable `.exe` | Optimized for Qualcomm Snapdragon Windows laptops. |
| **macOS (Apple Silicon)** | `mDiff-macOS-arm64.zip` | Standalone `.app` | Drag `mDiff.app` to Applications. |
| **Internal Web Server** | `mDiff-internal-web-deployment.tar.gz` | Linux Bundle | Single command `./start-server.sh 8097` for `10.10.84.22`. |

---

## Local Development & Build Commands

```bash
# Install dependencies
npm install

# Run automated test suite (81 tests)
npm test

# Typecheck and lint
npm run lint

# Build production web bundle and Electron main process
npm run build

# Package desktop applications
npm run package
```
