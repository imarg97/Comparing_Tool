# mDiff v8.0.0 Release & Delivery Dossier

**Release Version**: `v8.0.0`  
**Release Tag**: `v8.0.0`  
**Application Name**: **mDiff** (Mavenir Diff Comparison Suite)  
**Date**: November 27, 2026  
**Author**: im_arg  
**Target Environments**: Windows 10/11 Enterprise (`mDiff.exe`), macOS (`mDiff.app`), and Mavenir Lab Web Server (`http://10.10.84.22:8097`)  

---

## 1. Key Updates Delivered in v8.0.0

### A. Dedicated "Structure XML First" Pre-Formatting Engine
- **Pre-Format Toggle**: Added a dedicated toolbar checkbox **`[✓] Structure XML First`** in both Structured and Text Compare views.
- **Unstructured XML Normalization**: Continuous tags and single-line XML dumps are automatically tokenized and formatted into clean 2-space indented hierarchy, with leaf tags formatted compactly (`<name>0</name>`).
- **Elimination of False Differences**: Aligns matching elements (e.g. `<appcommon>`) accurately across inserted blocks (`<encryption>`, `<nsid>`), eliminating false difference highlights.
- **Content-Based Format Detection**: Detects XML and JSON directly from content rather than relying strictly on file extensions, preventing syntax crashes on CMS configuration snapshots lacking `.xml` extensions.
- **Resilient Entity & Ampersand Handling**: Handles raw ampersands (`&`) and non-standard CMS symbols gracefully without crashing or throwing YAML parsing errors.

### B. Per-Line Diff Transfer Flexibility
- **Individual Line Arrows**: Difference chunks spanning multiple lines now provide gutter transfer arrows on **every individual line**.
- **Targeted Line Transfer**: Clicking the transfer arrow on a specific line (e.g. line 137) transfers **only that specific line** to the opposite side, rather than forcing the entire multi-line chunk.
- **Multi-Line Selection Transfer**: When a user selects a range of lines and clicks the arrow, the entire selected range is transferred cleanly.

### C. Deterministic Diff Navigation
- **Zero Scroll Offset**: Replaced Monaco's heuristic `goToDiff` with exact chunk jumping based on canonical diff chunk coordinates.
- **Exact Positioning**: Clicking `Next` or `Prev` Difference jumps directly to the exact start line and centers the line in view without vertical drift or offset scrolling.

### D. Official Suite-Wide "mDiff" Branding & v8.0.0 Bump
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

- [x] Unstructured continuous XML formatting verified with tag tokenizer and hierarchy indentation.
- [x] Content-based format detection verified on extensionless CMS config snapshots.
- [x] Single-line diff transfer verified via `executeSelectedLinesCopyL2R` and visual row mapping.
- [x] Multi-line range selection transfer verified.
- [x] Next/Prev diff navigation verified deterministic without scroll drift.
- [x] 100% test suite pass rate across unit and comparison regression tests.
- [x] Zero telemetry, 100% offline air-gapped operation verified.
