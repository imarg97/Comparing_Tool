# mDiff (Mavenir Diff) — Enterprise Desktop & Web Comparison Suite

**Version**: `v8.0.0`  
**License**: Permissive Open-Source (100% MIT & ISC Compatible — Zero Copyleft)  
**Security Classification**: Air-Gapped / Zero-Telemetry / Portable User-Space Utility  
**Web Production URL**: `http://10.10.84.22:8097` *(Mavenir VPN)*  
**Primary Repository**: `https://github.com/imarg97/mdiff`  
**GitHub Mirrors**: `https://github.com/imarg97/Comparing_Tool` • `https://github.com/imarg97/diffx`  

---

## Overview

**mDiff** (Mavenir Diff) is an enterprise comparison suite tailored specifically for telecommunications engineering, cloud platform operations (OpenShift / Kubernetes), and DevOps workflows. 

Engineered with complete visual and behavioral fidelity to **Beyond Compare**, mDiff delivers side-by-side text diffing, deep cryptographic directory tree comparison, and semantic cellular/network XML, YAML, and JSON parameter comparisons across both native desktop operating systems (Windows & macOS) and internal air-gapped web servers.

---

## 📚 Complete Project Documentation & PDF Dossiers

All official technical documentation is maintained in [`docs/`](docs/) and compiled into PDF dossiers:

| Document Title | Markdown Link | Compiled PDF Dossier | Description & Scope |
| :--- | :--- | :--- | :--- |
| **Release Notes v8.0.0** | [**`RELEASE-NOTES-v8.0.md`**](docs/RELEASE-NOTES-v8.0.md) | [**`mDiff-Release-Notes-v8.0.pdf`**](docs/mDiff-Release-Notes-v8.0.pdf) | Release highlights: Intelligent Auto-Structuring for XML/JSON/SQL, dashboard session reset, per-line diff transfer, package inventory. |
| **User Guide & Manual** | [**`HOW-TO-USE.md`**](docs/HOW-TO-USE.md) | [**`mDiff-Complete-User-Guide.pdf`**](docs/mDiff-Complete-User-Guide.pdf) | Complete user guide for Folder Compare, Text Compare, Config & XML Compare, Folder Sync, and Table & Data Compare. |
| **Executive Briefing Guide** | [**`TEAM-BRIEFING-GUIDE.md`**](docs/TEAM-BRIEFING-GUIDE.md) | [**`mDiff-Executive-Briefing-Guide.pdf`**](docs/mDiff-Executive-Briefing-Guide.pdf) | High-level architectural walkthrough, feature comparison matrix against Beyond Compare, and team FAQ. |
| **IT Security Q&A Dossier** | [**`IT-SECURITY-QA.md`**](docs/IT-SECURITY-QA.md) | [**`mDiff-IT-Security-QA.pdf`**](docs/mDiff-IT-Security-QA.pdf) | Formal responses for InfoSec, DLP, and endpoint administrators regarding zero telemetry and client-side isolation. |
| **Licensing & Legal Compliance** | [**`LICENSING.md`**](docs/LICENSING.md) | [**`mDiff-Licensing-and-Compliance.pdf`**](docs/mDiff-Licensing-and-Compliance.pdf) | Complete bill of materials and license audit, confirming 100% MIT/ISC permissive open-source licensing. |
| **Security Audit Report** | [**`SECURITY-AUDIT-REPORT.md`**](docs/SECURITY-AUDIT-REPORT.md) | [**`mDiff-Security-Audit-Report.pdf`**](docs/mDiff-Security-Audit-Report.pdf) | Comprehensive security assessment covering trust boundaries, IPC input validation, and local storage safety. |
| **Enterprise Security & Policy** | [**`ENTERPRISE-SECURITY.md`**](docs/ENTERPRISE-SECURITY.md) | [**`mDiff-Enterprise-Security-Compliance.pdf`**](docs/mDiff-Enterprise-Security-Compliance.pdf) | Security compliance report covering user-space execution, non-destructive file operations, and endpoint policies. |
| **Deployment & Server Runbook** | [**`DEPLOYMENT-GUIDE.md`**](docs/DEPLOYMENT-GUIDE.md) | [**`mDiff-Deployment-Guide.pdf`**](docs/mDiff-Deployment-Guide.pdf) | Operations guide for deploying and maintaining the web edition on Mavenir lab servers (`10.10.84.22:8097`). |

---

## Key Guarantees & Features in v8.0.0

### 1. Intelligent Multi-Language Understanding & Auto-Structuring (AI Formatter)
- **Universal Auto-Structure Engine**: Upgraded toolbar checkbox **`[✓] Auto-Structure / Pretty Print`** in both Text Compare and Config & XML Compare views.
- **Embedded XML & JSON inside SQL**: Intelligently detects SQL statements (`REPLACE INTO`, `INSERT INTO`, `UPDATE`, `SET`) containing embedded XML literals (e.g., `Normalization_Changes_*.sql`). Expands single-line XML dumps into 50+ indented lines matching Notepad++ XML Tools (`Ctrl+Alt+Shift+A`), while preserving SQL prefixes and closing statements (`');`).
- **Comprehensive Language Support**: Formats and structures XML documents, JSON payloads, YAML configurations, HTML files, and SQL files with embedded payloads.
- **Live Format Detection Badge**: Displays a live badge in the toolbar (e.g. `SQL with Embedded XML`, `XML Document`, `JSON Document`) providing real-time visual recognition.

### 2. Home Dashboard Session Reset & History Isolation
- **Clean Session Guarantee**: Closing a session tab completely purges path state.
- **Fresh Launchers**: Clicking any session tile under the Home dashboard's **"New"** section (Folder Compare, Text Compare, Config & XML Compare, Folder Sync, Table & Data) opens a guaranteed clean, blank workspace ready for new file selection, never resurrecting closed files.
- **Dedicated Recent Comparisons**: Saved sessions are loaded strictly when explicitly selected from the "Recent Comparisons" list.

### 3. Per-Line Diff Transfer Flexibility & Gutter Optimization
- **Individual Line Arrows**: Multi-line difference chunks render transfer arrows on **every individual line**.
- **Targeted Line Transfer**: Clicking a line arrow (e.g. line 137) transfers **only that specific line** to the opposite side.
- **Multi-Line Range Transfer**: Selecting multiple lines and clicking the gutter arrow transfers the entire selected block.
- **Smoothness**: Zero-latency transitions, instant visual pulse feedback, and zero scroll jump during line transfers.

### 4. Deterministic Diff Navigation & Viewport Tracking
- **Zero Scroll Offset**: Chunk navigation jumps directly to exact start lines without vertical drift or offset scrolling.
- **Smooth Diff Overview Map**: Far-left minimap overview bar supports smooth dragging without snapping.
- **Precision Line Details Inspector**: Bottom split inspection bar accurately matches lines between Left and Right across gaps and insertions, displaying green **"Lines identical"** status without false differences in unchanged sections.

### 5. Absolute Privacy & Air-Gapped Execution
- **Zero Data Egress**: All diff computations execute strictly on the client CPU and RAM. No files, configs, keystrokes, or diff results are ever transmitted across the network or stored on the server.
- **Offline Self-Contained Bundles**: Zero external script dependencies (no Google Fonts, no public CDNs). Monaco Editor and all web workers are bundled locally.
- **Pure JavaScript SHA-256 Fallback**: Deterministic cryptographic hashing that runs reliably in all environments (including non-HTTPS internal network IPs).

---

## Pre-Built Distribution Packages (`release/`)

| Platform / Target | Package Name | Format | Size | Description |
| :--- | :--- | :---: | :---: | :--- |
| **Windows Enterprise Setup (x64)** | [**`mDiff-Setup-8.0.0.exe`**](release/mDiff-Setup-8.0.0.exe) / [**`mDiff-Setup-x64.exe`**](release/mDiff-Setup-x64.exe) | **NSIS Installer** | **95.5 MB** | **Official Windows Setup for `C:\Program Files\mDiff\`. Generates `Uninstall mDiff.exe`. Silent `/S` switch for Microsoft Intune & Company Portal.** |
| **Windows Enterprise Setup (ARM64)** | [**`mDiff-Setup-arm64.exe`**](release/mDiff-Setup-arm64.exe) | **NSIS Installer** | **91.0 MB** | **Setup for Qualcomm Snapdragon Copilot+ Windows laptops.** |
| **Windows Portable (x64)** | [**`mDiff-v8.0_Tool.zip`**](release/mDiff-v8.0_Tool.zip) / [**`mDiff-windows-x64.zip`**](release/mDiff-windows-x64.zip) | Portable Zip | 405 MB | **Zero Admin Rights Required.** Extract and run `mDiff.exe`. Unrestricted 0777 archive. |
| **Windows Portable (ARM64)** | [**`mDiff-windows-arm64.zip`**](release/mDiff-windows-arm64.zip) | Portable Zip | 419 MB | Portable package for Windows ARM64 laptops. |
| **macOS (Apple Silicon)** | [**`mDiff-macOS-arm64.zip`**](release/mDiff-macOS-arm64.zip) | Standalone `.app` | 514 MB | Drag `mDiff.app` to Applications. |
| **Internal Web Server** | [**`mDiff-internal-web-deployment.tar.gz`**](release/mDiff-internal-web-deployment.tar.gz) | Linux Tarball | 1.5 MB | Clean Linux deployment package (0 Apple xattr noise) for `10.10.84.22:8097`. |
| **Internal Web Server (Zip)** | [**`mDiff-internal-web-deployment.zip`**](release/mDiff-internal-web-deployment.zip) | Linux Zip | 5.0 MB | Alternative web deployment archive. |

---

## Local Development & Build Commands

```bash
# Install dependencies
npm install

# Run automated test suite (115 tests across 13 suites)
npm test

# Typecheck and lint
npm run lint

# Build production web bundle and Electron main process
npm run build

# Package desktop applications
npm run package
```
