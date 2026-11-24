# mDiff v5.1.0 Release & Delivery Dossier

**Product**: mDiff (Mavenir Diff) Enterprise Comparison Suite  
**Release Tag**: `v5.1.0`  
**Status**: **Production Ready & Deployed**  
**Remotes Synchronized**:
- Primary: [`https://github.com/imarg97/mdiff.git`](https://github.com/imarg97/mdiff.git)
- Backup: [`https://github.com/imarg97/diffx-backup.git`](https://github.com/imarg97/diffx-backup.git)
- Legacy: [`https://github.com/imarg97/diffx.git`](https://github.com/imarg97/diffx.git)
- Origin: [`https://github.com/imarg97/Comparing_Tool.git`](https://github.com/imarg97/Comparing_Tool.git)

---

## 1. Key Updates Delivered in v5.1.0

### A. Windows Program Files Setup Installer & Company Portal / Intune Readiness
- **Professional Windows Setup Installer (`mDiff-Setup-5.1.0.exe` / `mDiff-Setup-x64.exe`)**:
  - Built with native NSIS (Modern User Interface 2) using `/SOLID lzma` compression, reducing the full 424MB application footprint down to **~95 MB** for rapid downloading and deployment.
  - Installs cleanly into standard **`C:\Program Files\mDiff\`** (`$PROGRAMFILES64\mDiff`), matching standard enterprise software architecture.
- **Embedded Uninstaller (`Uninstall mDiff.exe`)**:
  - Automatically generates and embeds a dedicated uninstaller (`Uninstall mDiff.exe`) directly in `C:\Program Files\mDiff\`, matching the exact directory layout seen in corporate enterprise deployments (e.g. Mavenir Company Portal / Microsoft Intune).
- **Windows Add/Remove Programs & Registry Integration**:
  - Registers under `HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\mDiff` with complete enterprise metadata: `DisplayName`, `DisplayVersion` (`5.1.0`), `Publisher` (`Mavenir`), `DisplayIcon`, `InstallLocation`, `UninstallString`, `QuietUninstallString`, and calculated `EstimatedSize`.
- **Silent Installation for Microsoft Intune / SCCM**:
  - Fully supports silent unattended deployment via `/S` command-line switch:
    - Silent install: `mDiff-Setup-5.1.0.exe /S`
    - Silent uninstall: `"C:\Program Files\mDiff\Uninstall mDiff.exe" /S`
  - Ready for immediate upload and publishing to the **Mavenir Company Portal (Microsoft Intune)**.
- **Start Menu & Desktop Shortcuts**:
  - Creates Start Menu program group (`Start Menu\Programs\mDiff\mDiff.lnk` and `Uninstall mDiff.lnk`) and Desktop shortcut.

### B. Ultra-Smooth Copy-Paste & Left-to-Right Shifting
- **Snappy 0.8s Highlight Pulse**:
  - Reduced the difference copy highlight duration from a sluggish 2.2s down to **0.8s** with a fluid `cubic-bezier(0.16, 1, 0.3, 1)` easing curve. Repeated copy-pasting feels instant, lightweight, and responsive.
- **Immediate Reactive Line Inspection**:
  - The bottom Line Detail Inspector now updates **immediately** across all copy paths:
    - Gutter arrow clicks (`⇨` / `⇦`)
    - Selection copy
    - Toolbar copy buttons
    - Line Detail Inspector transfer buttons
    - Beyond Compare keyboard shortcuts (`Alt+Right` / `Alt+Left`)
  - As soon as content is copied across panes, the inspector instantly displays **"Lines identical"** character-by-character without requiring a manual cursor move or re-click.
- **Zero-Bouncing Synchronous Gap Collapse**:
  - Editor gap view zones are collapsed synchronously before edit application, eliminating visual jitter or cursor jumping when shifting code across alignment gaps.

### C. Diff Overview Map Smooth Sliding & Non-Snapping Navigation
- **Freeform Drag & Slide**: The far-left vertical minimap bar supports fluid pointer dragging (`onPointerDown` + `setPointerCapture` + `onPointerMove`). Sliding or clicking through non-differential parts scrolls smoothly to the exact clicked/dragged line without snapping to diff chunks.
- **Removed 20px Proximity Snapping**: Removed the hardcoded 20px proximity snap and global closest-chunk lookup on track clicks that previously threw the user into nearby diff sections while sliding through non-differential code.
- **Accurate Viewport Indicator**: The blue viewport thumb frame precisely mirrors the active visible line range in the editor (`visibleStartLine` to `visibleEndLine`), rendering with sub-pixel responsiveness.
- **Explicit Chunk Markers**: Direct clicking on individual diff markers jumps cleanly to that chunk; clicking or sliding on the track scrolls freely.

### D. Precision Aligned Line Details Inspector
- **Diff-Aware Line Pair Mapping**: Implemented `getAlignedLineNumbers` in the comparison engine (`diff-copy.ts`). It accurately maps line positions between Left and Right across additions, deletions, and gaps using Monaco line change deltas (`mapLineNumber`).
- **Zero False-Positive Differences in Unchanged Areas**: When comparing lines in non-differential areas (e.g., line 2351 on Left and line 2401 on Right where 50 lines were inserted earlier), the inspector matches the aligned lines, displaying exact matching content with green **"Lines identical"** status instead of false diff warnings.
- **Independent Viewport Scroll & Cursor States**: Scrolling the editor updates the viewport thumb frame without corrupting active line inspection state.
- **Gap Truncation & Null Handling**: When the cursor rests on an alignment gap or one-sided insertion, the opposite side renders `-: <empty>` with full copy support.

### E. Comprehensive Automated Test Suite
- Vitest suite expanded to **100 of 100 passing tests (100% pass rate)**.
- Added comprehensive test suite for `getAlignedLineNumbers` covering:
  - Identical documents with no chunks.
  - Large gap/insertion offsets (50-line delta matching line 2351 on Left to line 2401 on Right).
  - Offsets within replacement diff chunks.
  - Gap insertions on Left and Right sides.
  - Non-positive line number safety guards.

---

## 2. Release Distribution Packages

All production distribution packages have been compiled, tested, and packaged into `/Users/anuabhi/.gemini/antigravity/scratch/diffx/release/`:

| Package File | Size | Format | Description |
| :--- | :---: | :---: | :--- |
| **`mDiff-Setup-5.1.0.exe`** | **95.5 MB** | **Windows NSIS Setup** | **Official Program Files Installer (`C:\Program Files\mDiff\`) with `Uninstall mDiff.exe`. Silent `/S` flag for Microsoft Intune / Company Portal.** |
| **`mDiff-Setup-x64.exe`** | **95.5 MB** | **Windows NSIS Setup** | **Identical to `mDiff-Setup-5.1.0.exe` (standard enterprise IT naming).** |
| **`mDiff-Setup-arm64.exe`** | **90.7 MB** | **Windows NSIS Setup** | **Native ARM64 Program Files Installer for Snapdragon Copilot+ Windows laptops.** |
| **`mDiff-windows-x64.zip`** | **405 MB** | **Portable Zip** | **Extract and run `mDiff.exe`. Zero installation / zero admin privileges required.** |
| **`mDiff-windows-arm64.zip`** | **418 MB** | **Portable Zip** | **Portable package for Windows ARM64 laptops.** |
| **`mDiff-macOS-arm64.zip`** | **514 MB** | **Standalone `.app`** | **Apple Silicon macOS application (`mDiff.app`).** |
| **`mDiff-internal-web-deployment.tar.gz`** | **2.5 MB** | **Tarball** | **Clean tarball with 0 `._*` Apple metadata files, multi-threaded `serve.py` / Docker / Podman runners for `10.10.84.22:8097`.** |
| **`mDiff-internal-web-deployment.zip`** | **9.2 MB** | **Zip** | **Alternative web deployment archive.** |
