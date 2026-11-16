# mDiff v5.0.0 Release & Delivery Dossier

**Product**: mDiff (Mavenir Diff) Enterprise Comparison Suite  
**Release Tag**: `v5.0.0`  
**Status**: **Production Ready & Deployed**  
**Remotes Synchronized**:
- Primary: [`https://github.com/imarg97/mdiff.git`](https://github.com/imarg97/mdiff.git)
- Backup: [`https://github.com/imarg97/diffx-backup.git`](https://github.com/imarg97/diffx-backup.git)
- Legacy: [`https://github.com/imarg97/diffx.git`](https://github.com/imarg97/diffx.git)
- Origin: [`https://github.com/imarg97/Comparing_Tool.git`](https://github.com/imarg97/Comparing_Tool.git)

---

## 1. Key Updates Delivered in v5.0.0

### A. Single Arrow & Connecting Bracket Line for Multi-line Gaps
- **Eliminated Repetitive Gutter Arrows**: In Text Compare and Config/XML Compare, when a diff chunk or alignment gap spans multiple lines (e.g. lines 81–93), the editor now displays a **single centered arrow** paired with an elegant **vertical guide bracket line** spanning the full chunk height.
- **Clean Margin Alignment**: Completely eliminates gutter crowding and prevents arrow icons from colliding with line numbers at gap boundaries.
- **Accurate Action**: Clicking the single chunk arrow or bracket instantly copies the block (or deletes aligned space) across panes with a single click.

### B. Real-Time Save, Auto-Refresh & Timestamps
- **Instant Timestamp Updates**: When a file is edited and saved in Text Compare, its modification timestamp is updated immediately in real time.
- **Dedicated Compare / Refresh Button**: Positioned directly between the Left and Right address boxes (alongside the Swap button) and on the toolbar (shortcut **F5**), allowing one-click instant comparison re-evaluation from disk.
- **Zero-Latency Reactive Propagation**: Saving changes in a child file automatically refreshes its status and timestamp in the parent `FolderCompareView` instantly without needing to restart the folder comparison.

### C. Right-Click File & Folder Rename
- **Context Menu Rename**: Right-clicking any file or folder in `FolderCompareView` surfaces **"Rename Left File/Folder..."** or **"Rename Right File/Folder..."**.
- **Interactive Rename Dialog**: Displays the current name, an autofocus input field, and real-time validation.
- **Security & Integrity Guards**: Enforces strict path traversal prevention, Windows reserved device name validation (`CON`, `PRN`, `AUX`, `NUL`, etc.), null-byte checks, and collision detection before modifying paths on disk.

### D. Filled Colored Folder Icons & High-Contrast Typography
- **Filled Colored Folder Icons (Beyond Compare Standard)**:
  - **Differences**: Filled bright red folder icon (`fill-red-500 text-red-700`) indicating modified content.
  - **Identical**: Rich filled amber/yellow manila folder icon (`fill-amber-400 text-amber-600`) indicating identical contents.
  - **Orphans**: Filled purple folder icon (`fill-purple-400 text-purple-700`) for left-only or right-only trees.
- **Bold Red vs Solid Dark Black Font**:
  - **Differences**: Bold red font (`text-[#c51b1b] dark:text-[#ff5c5c] font-bold`) on **BOTH** left and right panes for modified files and parent folders containing diffs.
  - **Identical**: Solid dark black font (`text-black dark:text-neutral-50 font-normal`) on **BOTH** left and right panes for identical files and folders once compared.
  - **Eliminated Muted Grays**: Fully eliminated washed-out gray text (`#71717a`) and faint icons.

### E. Session Caching (Zero Reload Latency)
- **Eliminated Reload Lag**: Navigating back to `Folder Compare` from active text sessions retains the comparison tree in memory with zero reload latency (0ms).
- **Persistent DOM State**: Scroll positions, expanded directory states, and selections are preserved seamlessly.

---

## 2. Release Distribution Packages

All production distribution packages have been compiled, tested, and packaged into `/Users/anuabhi/.gemini/antigravity/scratch/diffx/release/`:

| Distribution | Platform | File Path | Size |
| :--- | :--- | :--- | :--- |
| **Web Server Tarball** | Linux / RHEL / Docker | [mDiff-internal-web-deployment.tar.gz](file:///Users/anuabhi/.gemini/antigravity/scratch/diffx/release/mDiff-internal-web-deployment.tar.gz) | 1.5 MB |
| **Web Server Zip** | Linux / Windows Web | [mDiff-internal-web-deployment.zip](file:///Users/anuabhi/.gemini/antigravity/scratch/diffx/release/mDiff-internal-web-deployment.zip) | 5.0 MB |
| **Windows Desktop (x64)** | Windows 10/11 64-bit | [mDiff-windows-x64.zip](file:///Users/anuabhi/.gemini/antigravity/scratch/diffx/release/mDiff-windows-x64.zip) | 405 MB |
| **Windows Desktop (ARM64)**| Windows 11 ARM64 | [mDiff-windows-arm64.zip](file:///Users/anuabhi/.gemini/antigravity/scratch/diffx/release/mDiff-windows-arm64.zip) | 418 MB |
| **macOS Desktop (Apple Silicon)** | macOS 12+ (M1/M2/M3/M4) | [mDiff-macOS-arm64.zip](file:///Users/anuabhi/.gemini/antigravity/scratch/diffx/release/mDiff-macOS-arm64.zip) | 514 MB |

> [!NOTE]
> The server tarball (`mDiff-internal-web-deployment.tar.gz`) is created with standard GNU tar format with a root `mdiff/` folder and **zero `._*` dot-underscore files**, completely eliminating extraction errors or warnings on RHEL/CentOS.

---

## 3. Verification & Automated Test Results

- **Test Suite**: Vitest v3.2.7
- **Total Test Files**: 12 / 12 passed
- **Total Tests**: **95 / 95 passed (100% pass rate)**
- **Coverage**:
  - `renameSafeFile` path security, collision prevention & device validation
  - Single arrow gutter chunk with bracket line geometry
  - Filled colored folder icons (red, amber, purple) & typography states
  - `updateDirectoryStatuses` hierarchical rollup (red-to-black folder transition)
  - `dynamicFileStatusMap` & `dynamicFileMetaMap` live timestamp propagation
  - Dual-pane cross-selection & Ctrl+click manual comparison
  - Path traversal and null-byte injection security guards
  - XML parameter normalization & YAML noise stripping
