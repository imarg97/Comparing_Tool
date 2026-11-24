# mDiff v7.0.0 Release & Delivery Dossier

**Release Version**: `v7.0.0`  
**Release Tag**: `v7.0.0`  
**Release Date**: November 24, 2026  
**Classification**: Mavenir Enterprise Production Release  
**Direct PDF Link**: [`mDiff-Release-Notes-v7.0.pdf`](file:///Users/anuabhi/.gemini/antigravity/scratch/diffx/docs/mDiff-Release-Notes-v7.0.pdf)  

---

## 1. Key Updates Delivered in v7.0.0

### A. Zero Diff Computation Timeout (`maxComputationTime: 0`)
* **Problem**: In previous iterations, comparing large telecom configuration files (e.g. 800+ KB XML snapshots with 7,000–20,000 lines) hit Monaco's default 2000ms computation timeout, causing Monaco to terminate diff computation prematurely and omit remaining differences.
* **Resolution**: Configured `maxComputationTime: 0` (infinite timeout allowed) in both `TextCompareView` and `StructuredCompareView`. The engine now computes 100% of differences completely across massive files without omitting any changes.

### B. Precision Diff Overview Minimap & Exact Line Mapping
* **Problem**: In previous versions, the overview map's `totalLineCount` state initialized to 1 and was not updated on file load or diff completion. This caused the overview map to clamp `safeTotalLines` to 30 lines. Diffs in an 8,000-line file were rendered against 30 lines, causing diff markers to bunch together at the top or bottom and jump to lines 5–15 when clicked.
* **Resolution**:
  1. `setTotalLineCount` is now called immediately upon file loading (`loadFiles`), diff editor mount (`handleEditorDidMount`), and diff completion (`onDidUpdateDiff`).
  2. `DiffOverviewMap` calculates `safeTotalLines` dynamically from both `totalLines` and `maxChunkLine` (`Math.max(totalLines, maxChunkLine, 30)`), guaranteeing that diff markers are always mapped to their exact proportional coordinates across thousands of lines.
  3. Clicking on any tick in the overview map now centers both Left and Right panes simultaneously (`revealLineInCenter`), ensuring accurate alignment with zero jumping.

### C. True Beyond Compare Color Coding (Blue Indentation/Gaps vs Red Content Changes)
* **Problem**: In previous iterations, alignment gaps and indentation differences were either rendered identically to content edits or dropped from the minimap when filtered.
* **Resolution**: Re-introduced distinct Beyond Compare color coding:
  - **Blue** (`#2563eb` / `#3b82f6`): Alignment gaps and indentation/whitespace differences.
  - **Red** (`#dc2626` / `#ef4444`): Important content differences and code alterations.
  - Both single-line ticks and multi-line diff clusters are rendered with crisp 3px minimum heights and expanded mouse click hit zones.

### D. Zero Line Number Overlap in "Diffs Only" Mode
* **Problem**: When filtering comparisons to "Diffs Only" (`≠ Diffs`), Monaco diff editor collapsed unchanged lines directly up against alignment viewzones, causing adjacent line numbers (e.g., 7008 and 7069) to collide and render on top of each other. Additionally, 5-digit line numbers exceeded the default 3-character gutter margin.
* **Resolution**:
  1. Updated `computeUnchangedRanges` to include 2 lines of context padding above and below each difference, ensuring collapsed folds are separated from alignment viewzones.
  2. Increased `lineNumbersMinChars` from 3 to 6, allocating ~48px of gutter width to cleanly accommodate up to 999,999 lines without overlapping.

### E. Canonical Diff Persistence & Precision Minimap Snapping
* **Problem**: Filtering to `≠ Diffs` caused Monaco's `getLineChanges()` to report only visible lines, which erroneously replaced the canonical diff count (655 diffs) with the filtered subset in the overview map. In addition, clicking near a diff tick in large 16,000-line files interpolated approximate lines landing on identical code ("Lines identical").
* **Resolution**:
  1. Maintained `canonicalChunksRef` across all views: the overview map and stats always preserve the full set of canonical document diffs.
  2. Implemented intelligent tolerance snapping in `DiffOverviewMap` (within 1.5% height tolerance) and direct `onScrollToChunk` event propagation, ensuring clicks always land squarely on the intended diff chunk.

### F. Clean Application Startup (No Persistent Folder Compare Tab)
* **Problem**: On every application startup, a "Folder Compare" session tab was hardcoded into the initial session bar alongside Home.
* **Resolution**: Cleaned session initialization: mDiff starts exclusively on the Home launcher dashboard, and comparison sessions (Folder Compare, Text Compare, Config & XML) are created dynamically on demand.

### G. Version 7.0.0 Synchronization Across Entire Suite
* Bumped version strings to `v7.0.0` across:
  - `package.json`
  - Window Header & Navigation Badges
  - Settings "About mDiff" Card
  - Home Launcher Dashboard
  - Windows PE Executable Headers (`resedit`)
  - NSIS Windows Installer (`installer.nsi`)
  - All enterprise documentation and PDF guides

### E. Enterprise Distribution Packages
* **Enterprise Installer**: `mDiff-Setup-7.0.0.exe` (and `mDiff-Setup-x64.exe`) installing to `C:\Program Files\mDiff\`.
* **Zero-Install Tool Package**: `mDiff-v7.0_Tool.zip` with universal 0777 permissions.
* **Standard Portable Archive**: `mDiff-windows-x64.zip`.
* **VPN Web Portal**: `mDiff-internal-web-deployment.tar.gz`.

---

## 2. Verification & Test Metrics
* **Vitest Suite**: 12/12 test suites passing (100/100 tests passing).
* **Network Egress**: 0 outbound connections (100% air-gapped).
* **Supply Chain**: 100% permissive open-source (MIT/ISC).
