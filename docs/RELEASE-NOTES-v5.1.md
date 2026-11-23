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

### A. Diff Overview Map Smooth Sliding & Non-Snapping Navigation
- **Freeform Drag & Slide**: The far-left vertical minimap bar now supports fluid pointer dragging (`onPointerDown` + `setPointerCapture` + `onPointerMove`). Sliding or clicking through non-differential parts scrolls smoothly to the exact clicked/dragged line without snapping to diff chunks.
- **Removed 20px Proximity Snapping**: Removed the hardcoded 20px proximity snap and global closest-chunk lookup on track clicks that previously threw the user into nearby diff sections while sliding through non-differential code.
- **Accurate Viewport Indicator**: The blue viewport thumb frame precisely mirrors the active visible line range in the editor (`visibleStartLine` to `visibleEndLine`), rendering with sub-pixel responsiveness.
- **Explicit Chunk Markers**: Direct clicking on individual diff markers (`div` with `stopPropagation`) jumps cleanly to that chunk; clicking or sliding on the track scrolls freely.

### B. Precision Aligned Line Details Inspector
- **Diff-Aware Line Pair Mapping**: Implemented `getAlignedLineNumbers` in the comparison engine (`diff-copy.ts`). It accurately maps line positions between Left and Right across additions, deletions, and gaps using Monaco line change deltas (`mapLineNumber`).
- **Zero False-Positive Differences in Unchanged Areas**: When comparing lines in non-differential areas (e.g., line 2351 on Left and line 2401 on Right where 50 lines were inserted earlier), the inspector matches the aligned lines, displaying exact matching content with green **"Lines identical"** status instead of false diff warnings.
- **Independent Viewport Scroll & Cursor States**: Scrolling the editor updates the viewport thumb frame without corrupting active line inspection state.
- **Gap Truncation & Null Handling**: When the cursor rests on an alignment gap or one-sided insertion, the opposite side renders `-: <empty>` with full copy support.

### C. Comprehensive Automated Test Suite
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

- **Windows x64 Executable Package**: `mDiff-windows-x64.zip` (Portable `mDiff.exe`, zero admin required)
- **Windows ARM64 Executable Package**: `mDiff-windows-arm64.zip` (Portable `mDiff.exe`, zero admin required)
- **macOS Apple Silicon Package**: `mDiff-macOS-arm64.zip` (`mDiff.app`, notarization/codesign ready)
- **Air-Gapped Lab Server Deployment Tarball**: `mDiff-internal-web-deployment.tar.gz` (Clean tarball with 0 `._*` AppleDouble metadata files, universal Python 3 / Docker / Podman runners)
- **Air-Gapped Lab Server Deployment Zip**: `mDiff-internal-web-deployment.zip`
