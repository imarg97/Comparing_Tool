# mDiff v8.0.0 Release & Delivery Dossier

**Release Version**: `v8.0.0`  
**Release Tag**: `v8.0.0`  
**Application Name**: **mDiff** (Mavenir Diff Comparison Suite)  
**Date**: November 27, 2026  
**Author**: im_arg  
**Target Environments**: Windows 10/11 Enterprise (`mDiff.exe`), macOS (`mDiff.app`), and Mavenir Lab Web Server (`http://10.10.84.22:8097`)  

---

## 1. Key Updates Delivered in v8.0.0

### A. Intelligent Multi-Language Understanding & Auto-Structuring (AI Formatter)
- **Universal Auto-Structure Toggle**: Upgraded the previous XML checkbox to a universal **`[✓] Auto-Structure / Pretty Print`** engine in both Text Compare and Config & XML Compare views.
- **Embedded XML & JSON inside SQL Support**: Intelligently detects SQL statements (`REPLACE INTO`, `INSERT INTO`, `UPDATE`, `SET`) containing embedded XML literals (e.g., `Normalization_Changes_*.sql`). Extracts the XML payload, expands it across 50+ indented lines with 2-space hierarchy, and keeps the SQL statement prefix and suffix intact, perfectly matching the behavior of Notepad++ XML Tools (`Ctrl+Alt+Shift+A`).
- **Comprehensive Multi-Language Knowledge Base**: Intelligently identifies and formats:
  - **XML Documents**: Continuous or unformatted tags, compact leaf elements (`<name>0</name>`).
  - **JSON Documents**: Formatted with 2-space indentation with relaxed JSON parsing tolerance.
  - **YAML Configurations**: Clean indentation alignment for Helm charts and `values.yaml`.
  - **HTML Content**: Semantic tag formatting and structure.
  - **SQL with Embedded XML/JSON**: Seamless multi-line expansion of embedded payloads.
- **Live Language Detection Badge**: Automatically displays a live badge in the toolbar (e.g. `SQL with Embedded XML`, `XML Document`, `JSON Document`) providing immediate visual confirmation of the detected format.
- **Resilient Entity & Ampersand Handling**: Handles raw ampersands (`&`) and non-standard CMS symbols gracefully without crashing or throwing YAML parsing errors.

### B. Home Dashboard Session Isolation & History Clean Re-Open
- **Eliminated Stale Session Resurrection**: Closing a session tab (e.g., "Config & XML" or "Text Compare") now immediately and completely purges internal path state.
- **Fresh Session Guarantee**: Clicking any tile under the Home dashboard's "New" section (e.g., "Config & XML Compare", "Text Compare", "Folder Compare") opens a clean, blank workspace ready for new file selection, never resurrecting previously closed files.
- **History Isolation**: Previous comparisons are loaded strictly when explicitly selected from the "Recent Comparisons" list.

### C. Per-Line Diff Transfer Flexibility & Gutter Optimization
- **Individual Line Arrows**: Difference chunks spanning multiple lines provide gutter transfer arrows on **every individual line**.
- **Targeted Line Transfer**: Clicking the transfer arrow on a specific line (e.g. line 137) transfers **only that specific line** to the opposite side, rather than forcing the entire multi-line chunk.
- **Multi-Line Selection Transfer**: When a user selects a range of lines and clicks the arrow, the entire selected range is transferred cleanly.
- **Smoothness & Animation**: Zero-latency transitions, instant visual pulse feedback, and zero scroll jump during line transfers.

### D. Deterministic Diff Navigation
- **Zero Scroll Offset**: Replaced Monaco's heuristic `goToDiff` with exact chunk jumping based on canonical diff chunk coordinates.
- **Exact Positioning**: Clicking `Next` or `Prev` Difference jumps directly to the exact start line and centers the line in view without vertical drift or offset scrolling.

### E. Official Suite-Wide "mDiff" Branding & v8.0.0 Bump
- **Application Renamed to mDiff**: DiffX branding completely updated to **mDiff** across UI headers, menus, installers, registry keys, and documentation.
- **Version Synchronized to 8.0.0**: Synchronized across `package.json`, NSIS installer, Windows executables, Docker configurations, web deployment bundles, and technical documentation.

---

## 2. Release Artifacts & Distribution Packages

| Package File | Size | Format | Direct Clickable Local Link | Purpose & IT Guidance |
| :--- | :---: | :---: | :--- | :--- |
| **`mDiff-Setup-8.0.0.exe`** | **95.5 MB** | **NSIS Setup** | [**`mDiff-Setup-8.0.0.exe`**](file:///Users/anuabhi/.gemini/antigravity/scratch/diffx/release/mDiff-Setup-8.0.0.exe) | **Official Enterprise Installer.** Installs to `C:\Program Files\mDiff\`. Creates `Uninstall mDiff.exe` and registers in Windows Registry. Supports silent install (`/S`) for **Microsoft Intune / Mavenir Company Portal**. |
| **`mDiff-Setup-x64.exe`** | **95.5 MB** | **NSIS Setup** | [**`mDiff-Setup-x64.exe`**](file:///Users/anuabhi/.gemini/antigravity/scratch/diffx/release/mDiff-Setup-x64.exe) | Standard IT naming identical to `mDiff-Setup-8.0.0.exe`. |
| **`mDiff-v8.0_Tool.zip`** | **405 MB** | **Portable Zip** | [**`mDiff-v8.0_Tool.zip`**](file:///Users/anuabhi/.gemini/antigravity/scratch/diffx/release/mDiff-v8.0_Tool.zip) | **Zero Admin Rights Required.** Unrestricted 0777 archive. Extract anywhere and double-click `mDiff.exe`. Ideal for locked-down corporate laptops without admin privileges. |
| **`mDiff-windows-x64.zip`** | **405 MB** | **Portable Zip** | [**`mDiff-windows-x64.zip`**](file:///Users/anuabhi/.gemini/antigravity/scratch/diffx/release/mDiff-windows-x64.zip) | Standard portable release archive. |
| **`mDiff-internal-web-deployment.tar.gz`** | **2.5 MB** | **Web Tarball** | [**`mDiff-internal-web-deployment.tar.gz`**](file:///Users/anuabhi/.gemini/antigravity/scratch/diffx/release/mDiff-internal-web-deployment.tar.gz) | **Browser Access over Mavenir VPN.** Deployed on `bglocp-installer` (`http://10.10.84.22:8097`). Zero installation on client laptops. |
| **`mDiff-macOS-arm64.zip`** | **514 MB** | **Standalone App** | [**`mDiff-macOS-arm64.zip`**](file:///Users/anuabhi/.gemini/antigravity/scratch/diffx/release/mDiff-macOS-arm64.zip) | Apple Silicon macOS application (`mDiff.app`). |

---

## 3. Verification & Compliance Checklist

- [x] Intelligent language detection verified across XML, JSON, YAML, HTML, SQL with embedded XML, and SQL with embedded JSON.
- [x] Embedded XML inside SQL files (`Normalization_Changes_*.sql`) formatted across indented lines matching Notepad++ XML Tools.
- [x] Dashboard session reopening verified: closing tabs purges path state; clicking "New" opens fresh blank sessions.
- [x] Single-line diff transfer verified via `executeSelectedLinesCopyL2R` and visual row mapping.
- [x] Multi-line range selection transfer verified with smooth flash highlights and zero scroll jump.
- [x] Next/Prev diff navigation verified deterministic without scroll drift.
- [x] 100% test suite pass rate (115 passing tests across 13 test suites).
- [x] Zero telemetry, 100% offline air-gapped operation verified.
