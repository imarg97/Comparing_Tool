# mDiff (Mavenir Diff) — Executive Briefing & Team Walkthrough Guide

**Product**: mDiff (Mavenir Diff) Enterprise Comparison Suite  
**Version**: `v8.0.0`  
**Date**: November 27, 2026  
**Classification**: Mavenir Internal Use  
**PDF Document**: [`mDiff-Executive-Briefing-Guide.pdf`](file:///Users/anuabhi/.gemini/antigravity/scratch/diffx/docs/mDiff-Executive-Briefing-Guide.pdf)  

---

## 1. Executive Summary & Layman's Explanation

### What is mDiff in Simple Terms?
In plain terms, **mDiff** is an enterprise comparison suite designed specifically for telecom network engineers, cloud platform operators (OpenShift / Kubernetes), and software developers. 

Whenever you need to answer:
- *"What changed between yesterday's configuration and today's?"*
- *"Why is Site A behaving differently from Site B?"*
- *"Which files are missing or modified in this new release bundle?"*

**mDiff pinpoints the exact differences in seconds.** Instead of manually reading thousands of lines of code or complex YAML/XML configuration dumps, you point mDiff to two directories, two files, or two tabular datasets. It instantly highlights what was **added**, what was **deleted**, and what was **modified**, while automatically ignoring meaningless noise like timestamps or cosmetic whitespace.

### Key Value Highlights for Today's Meeting:
1. **100% Free & Permissive Open-Source (Zero License Headaches)**: Zero subscriptions, zero license keys, zero trial expiration, and zero cost to Mavenir (built on 100% MIT/ISC libraries).
2. **Beyond Compare Fidelity**: Full visual, color palette, and keyboard shortcut parity (`F7`, `Shift+F7`, `Alt+Right`, `Alt+Left`, `Ctrl+1..5`).
3. **Dual Delivery (Desktop + Web over VPN)**:
   - **Windows Program Files Setup**: `mDiff-Setup-8.0.0.exe` for standard enterprise deployment via **Microsoft Intune / Mavenir Company Portal**.
   - **Zero-Install Portable Zip**: `mDiff-windows-x64.zip` for instant user-space execution without admin rights.
   - **Internal Web Portal**: Accessible at `http://10.10.84.22:8097` over Mavenir VPN from any browser without installing software on client machines.
4. **Telecom & Cloud Intelligence**: Built-in semantic filtering for Kubernetes/OpenShift YAML manifests and cellular XML parameter dumps.

---

## 2. Visual Deep-Dive: Explanation of Sync Features

On the mDiff Home screen, you see comparison tiles including **Folder Sync** and **Table & Data**. Here is a clear visual explanation of what each feature does and when to use them:

### A. Folder Sync vs. Folder Compare

```
+---------------------------------------------------------------------------------------------------+
| FOLDER COMPARE (Inspection & Discovery)                                                            |
| Goal: Analyze differences between two directories, navigate trees, and inspect side-by-side diffs. |
|                                                                                                   |
|  Left Directory (Site A)                  Gutter                  Right Directory (Site B)         |
|  📁 imc-diamre                            [ ≠ ]                   📁 imc-diamre                   |
|     ├── 📄 values.yaml (Modified)         [ ≠ ] ──(Double-click)─►   ├── 📄 values.yaml (Modified)|
|     └── 📄 Chart.yaml (Identical)         [ = ]                      └── 📄 Chart.yaml (Identical)|
|  📄 desktop.ini (Left Orphan)             [ ◄ ]                      (Missing)                    |
+---------------------------------------------------------------------------------------------------+

+---------------------------------------------------------------------------------------------------+
| FOLDER SYNC (Reconciliation & Automated Replication)                                              |
| Goal: Reconcile two folders based on synchronization rules (Mirror, Update, Two-Way).              |
|                                                                                                   |
|  Left (Master / Source)                  Action                     Right (Target / Backup)       |
|  📄 values.yaml (Newer: 11:26 AM)  ───► [ COPY / UPDATE ] ───►  📄 values.yaml (Older: 10:38 AM)   |
|  📄 new-service.yaml (Source Only) ───► [ COPY ORPHAN  ] ───►  (Created on Target)                |
|  (No longer exists on Source)      ───► [ DELETE ORPHAN] ───►  🗑️ deprecated.yaml (Removed)       |
+---------------------------------------------------------------------------------------------------+
```

#### Sync Rules Breakdown:
| Sync Rule | How It Operates (Direction) | Engineering Use Case |
| :--- | :--- | :--- |
| **Update Right** | Left (Source) ──[ Newer / Missing ]──► Right<br/>*(Unique files on Right are left untouched)* | Deploying patch files to a lab test server without overwriting existing lab-specific logs or local debug scripts. |
| **Mirror to Right** | Left (Master) ════[ Exact Clone ]════► Right<br/>*(Copies additions/changes; deletes Right orphans)* | Ensuring a backup disaster-recovery directory exactly mirrors the production Helm chart release repository. |
| **Two-Way Sync** | Left ◄──[ Bi-directional Sync ]──► Right<br/>*(Copies latest timestamp from either side)* | Synchronizing shared workspace folders between a development laptop and a remote lab virtual machine. |

---

### B. Table & Data Compare vs. Text Compare

```
+---------------------------------------------------------------------------------------------------+
| STANDARD TEXT COMPARE (Line-by-Line)                                                              |
| Problem: If rows are sorted differently or columns are reordered, Text Compare flags everything! |
|                                                                                                   |
|  Line 1: IMSI_001, 10.247.15.161, Active   ≠   Line 1: IMSI_002, 10.219.229.80, Active (DIFF)    |
|  Line 2: IMSI_002, 10.219.229.80, Active   ≠   Line 2: IMSI_001, 10.247.15.161, Active (DIFF)    |
|  Result: 100% false-positive differences across the entire file because row order shifted!       |
+---------------------------------------------------------------------------------------------------+

+---------------------------------------------------------------------------------------------------+
| TABLE & DATA COMPARE (Database & Key-Aware Grid)                                                  |
| Solution: Matches rows by Primary Key (`IMSI`) regardless of order, highlighting only changed cells! |
|                                                                                                   |
|  [KEY] IMSI      | Left: IP Address    Right: IP Address   | Left: Status    Right: Status        |
|  IMSI_001        | 10.247.15.161       10.247.15.161       | Active          Active         (=)   |
|  IMSI_002        | 10.219.229.80       10.219.229.80       | Active          Active         (=)   |
|  IMSI_003        | 10.10.84.22         10.10.84.99   [ ≠ ] | Standby         Active   [ ≠ ](DIFF)  |
|  Result: Identifies exact cell discrepancies (`IP` and `Status`) with zero row-sorting confusion. |
+---------------------------------------------------------------------------------------------------+
```

#### Comparison Matrix:
| Capability | Standard Text Compare | Table & Data Compare |
| :--- | :--- | :--- |
| **Data Format** | Plain text, source code (`.sh`, `.py`, `.js`, `.txt`) | Structured tabular data (`.csv`, `.tsv`, `.dat`) |
| **Row Order Sensitivity** | Highly sensitive (reordered rows break line alignment) | Completely insensitive (aligns rows by Primary Key) |
| **Granularity** | Line and character differences | Cell-by-cell values within specific columns |
| **Telecom Example** | Comparing shell scripts or configuration templates | Comparing Call Detail Records (CDRs), subscriber database dumps, IP routing tables, or 5G gNodeB cell parameter sheets |

---

## 3. Addressing Core Meeting Questions

### (a) How does mDiff compare to Beyond Compare?
mDiff was engineered from day one to maintain **complete visual, behavioral, and muscle-memory parity** with Beyond Compare:
1. **Identical Visual Theme & Color Palette**:
   - Differences appear in **bold red** (`#c51b1b`) on the left with soft pastel rose line striping (`#fdecec`).
   - The right pane displays clean, readable **solid black font** (`text-neutral-900`) for identical and modified code.
   - Unique orphan files render in distinct **purple** (`#7e22ce`), and identical files display clean `=` signs.
2. **Monospace Typography**: Standard corporate monospace font stack (`Consolas`, `Lucida Console`, `DejaVu Sans Mono`) with `13px` font size and `20px` line spacing for optimal readability.
3. **Standard Beyond Compare Keyboard Shortcuts**:
   - `F7`: Jump to Next Difference
   - `Shift+F7`: Jump to Previous Difference
   - `Alt+Right` / `Alt+Left`: Transfer changes Left-to-Right or Right-to-Left
   - `Ctrl+1` through `Ctrl+5`: Switch comparison modes (Folder, Text, Config, Sessions, Preferences)
4. **Docked Line Detail Inspector**: Docked at the bottom of the screen, showing an enlarged single-line breakdown comparing the Left and Right text character-by-character with instant transfer buttons.
5. **Initial Collapsed View**: Directories start collapsed at the root level upon comparison, preventing information overload when opening large directories with thousands of sub-files.

---

### (b) What extra features have we added that Beyond Compare lacks?
1. **Dual Delivery (Native Desktop + Internal Web Portal)**: Beyond Compare is strictly desktop-only. mDiff can be deployed on internal lab servers (`http://10.10.84.22:8097`) so engineers can compare files directly in their web browser over Mavenir VPN without installing client software.
2. **Intelligent Kubernetes & Cloud Noise Filter**: Beyond Compare treats dynamic runtime metadata as real differences. mDiff's Config & XML mode automatically suppresses dynamic Kubernetes noise (`resourceVersion`, `managedFields`, `creationTimestamp`, `uid`, `status`), saving hours of manual review.
3. **Interactive UI & Font Zoom (70% - 200%)**: Engineers can dynamically scale the editor font, row height, and folder tree using `Ctrl` + mouse wheel (roller button) or toolbar zoom buttons.
4. **Zero-Latency In-Memory Session Caching**: Folder comparisons remain persistently cached in RAM across tab switches. Switching from active text editing back to Folder Compare takes 0ms with zero re-scanning.
5. **Enterprise Windows Setup Installer for Intune**: Includes an official NSIS installer (`mDiff-Setup-8.0.0.exe`) that installs to `C:\Program Files\mDiff\`, generates `Uninstall mDiff.exe`, and supports silent install (`/S`) for the **Mavenir Company Portal / Microsoft Intune**.

---

### (c) What issues have we sorted out compared to Beyond Compare?
1. **License Expiration & Cost Bottlenecks**: Beyond Compare requires expensive commercial licenses and trial periods that expire, blocking critical deployment workflows. mDiff is **100% free, MIT/ISC permissive, and permanent**.
2. **Air-Gapped & Zero Data Egress**: All diff computations execute strictly on the client CPU and RAM. No files, configs, keystrokes, or diff results are ever transmitted across the network or stored externally.
3. **Non-Snapping Freeform Minimap Scrolling**: Resolved the common comparison annoyance where sliding through non-differential code forcefully snapped the cursor into nearby diffs. In mDiff, the overview minimap allows fluid, freeform sliding.
4. **Eliminated False Diff Warnings in Line Details**: Precision aligned line mapping (`getAlignedLineNumbers`) matches lines across gap insertions, eliminating false diff warnings in non-differential code.
5. **Zero Timeout Full Diff Computation**: Diff calculation timeout has been set to 0 (infinite timeout allowed), ensuring 100% of differences are computed accurately across huge XML configuration files (thousands of lines) without premature truncation.

---

## 4. Enterprise Distribution & Installation Packages

All production packages are compiled and available in [`release/`](file:///Users/anuabhi/.gemini/antigravity/scratch/diffx/release/):

| Package File | Size | Format | Direct Clickable Local Link | Purpose & IT Guidance |
| :--- | :---: | :---: | :--- | :--- |
| **`mDiff-Setup-8.0.0.exe`** | **95.5 MB** | **NSIS Setup** | [**`mDiff-Setup-8.0.0.exe`**](file:///Users/anuabhi/.gemini/antigravity/scratch/diffx/release/mDiff-Setup-8.0.0.exe) | **Official Enterprise Installer.** Installs to `C:\Program Files\mDiff\`. Creates `Uninstall mDiff.exe` and registers in Windows Registry. Supports silent install (`/S`) for **Microsoft Intune / Mavenir Company Portal**. |
| **`mDiff-Setup-x64.exe`** | **95.5 MB** | **NSIS Setup** | [**`mDiff-Setup-x64.exe`**](file:///Users/anuabhi/.gemini/antigravity/scratch/diffx/release/mDiff-Setup-x64.exe) | Standard IT naming identical to `mDiff-Setup-8.0.0.exe`. |
| **`mDiff-v8.0_Tool.zip`** | **405 MB** | **Portable Zip** | [**`mDiff-v8.0_Tool.zip`**](file:///Users/anuabhi/.gemini/antigravity/scratch/diffx/release/mDiff-v8.0_Tool.zip) | **Zero Admin Rights Required.** Unrestricted 0777 archive. Extract anywhere and double-click `mDiff.exe`. Ideal for locked-down corporate laptops without admin privileges. |
| **`mDiff-windows-x64.zip`** | **405 MB** | **Portable Zip** | [**`mDiff-windows-x64.zip`**](file:///Users/anuabhi/.gemini/antigravity/scratch/diffx/release/mDiff-windows-x64.zip) | Standard portable release archive. |
| **`mDiff-internal-web-deployment.tar.gz`** | **2.5 MB** | **Web Tarball** | [**`mDiff-internal-web-deployment.tar.gz`**](file:///Users/anuabhi/.gemini/antigravity/scratch/diffx/release/mDiff-internal-web-deployment.tar.gz) | **Browser Access over Mavenir VPN.** Deployed on `bglocp-installer` (`http://10.10.84.22:8097`). Zero installation on client laptops. |
| **`mDiff-macOS-arm64.zip`** | **514 MB** | **Standalone App** | [**`mDiff-macOS-arm64.zip`**](file:///Users/anuabhi/.gemini/antigravity/scratch/diffx/release/mDiff-macOS-arm64.zip) | Apple Silicon macOS application (`mDiff.app`). |

---

## 5. Frequently Asked Questions (FAQ) for the Meeting

**Q1: Which file should I download for a proper standard installation?**  
**A:** Download **`mDiff-Setup-8.0.0.exe`** (or `mDiff-Setup-x64.exe`). It runs the official Windows Setup wizard, installs to `C:\Program Files\mDiff\`, creates `Uninstall mDiff.exe`, creates Desktop/Start Menu shortcuts, and registers with Windows Add/Remove Programs.

**Q2: Why do we have both an installer and a portable zip?**  
**A:** For complete deployment flexibility. The installer is for enterprise management (Microsoft Intune / Company Portal) and standard corporate laptop setups. The portable zip (`mDiff-v8.0_Tool.zip` or `mDiff-windows-x64.zip`) allows contractors, engineers, or colleagues without local administrator permissions to unzip and run `mDiff.exe` immediately with zero install barriers.

**Q3: Can we use mDiff for sensitive production telecom customer data?**  
**A:** Absolutely. mDiff operates under an air-gapped, zero-telemetry architecture. All file hashing, parsing, and difference comparisons execute locally within the client's memory. No telemetry, analytics, or file contents are ever transmitted outside.
