# mDiff — Comprehensive User Guide & How-to-Use Manual

**Application**: mDiff (Mavenir Diff) Comparison Suite  
**Version**: `v3.7.0`  
**Platforms**: Web (`http://10.10.84.22:8097`), Windows 10/11 (`mDiff.exe`), macOS (`mDiff.app`)  
**Design Standard**: Beyond Compare Enterprise Fidelity & Visual Parity  

---

## 1. Overview & Core Philosophy

**mDiff** is an enterprise-grade, high-performance file, directory, and structured configuration comparison suite built for telecom network engineers, system administrators, and software developers. 

mDiff combines:
- **Zero-Latency Client-Side Diffing**: Diff calculations execute strictly on the local machine using client-side CPU and memory.
- **Beyond Compare Monospace Typography**: Employs corporate standard monospace fonts (`Consolas`, `Lucida Console`, `DejaVu Sans Mono`) with bold weight (`700`) for effortless readability on cellular configs and complex logs.
- **Box-Free Difference Highlighting**: Clean pastel row striping with bold red text on changed characters replaces clunky boxes and pill overlays.
- **Air-Gapped & Zero-Telemetry**: Does not transmit files, keystrokes, diff results, or telemetry to external servers.

---

## 2. Getting Started & Sessions Hub

Upon launching mDiff or clicking the logo in the top bar, you are presented with the **Sessions Hub** (`Ctrl+4` / `Cmd+4`):

```
+-----------------------------------------------------------------------------------+
|  [Sessions Hub]                                                                   |
|                                                                                   |
|  [Folder Compare] (App Only)     [Text Compare]             [Config & XML Compare]|
|   Compare directories, trees,     Compare any text, source   Semantic comparison   |
|   SHA-256 hashes, & sync files.   code, scripts, or logs.    for XML, YAML, JSON.  |
+-----------------------------------------------------------------------------------+
```

You can switch between modes at any time using the top navigation bar or keyboard shortcuts:
- **Folder Compare**: `Ctrl+1` / `Cmd+1` *(Desktop native app only)*
- **Text Compare**: `Ctrl+2` / `Cmd+2`
- **Config & XML Compare**: `Ctrl+3` / `Cmd+3`
- **Sessions**: `Ctrl+4` / `Cmd+4`
- **Preferences**: `Ctrl+5` / `Cmd+5`

---

## 3. Comparison Modes Deep-Dive

### A. Text Compare (`Ctrl+2` / `Cmd+2`)
Designed for source code, telecom scripts, log files, and general text.

1. **Loading Files**:
   - Click **Browse** on the Left or Right pane to choose local files via native OS dialogs.
   - **Drag and Drop**: Drag files from your desktop or file manager directly onto the Left or Right editor pane.
   - **Direct Paste / In-Place Editing**: You can paste text directly into either editor or type freely.
2. **Beyond Compare Visual Theme**:
   - **Light Theme**: Crisp bold black text (`#000000`) on a clean white background.
   - **Dark Theme**: Ultra-high contrast bold white text (`#ffffff`) on a pitch-black background (`#000000`).
   - **Difference Rows**: Highlighted with soft pastel rose striping (`#fdecec` light / `#2b1215` dark).
   - **Inline Differences**: Characters that differ (e.g. VLAN IDs `2516` vs `205`, IP octets `10.247.15.161` vs `10.219.229.80`) appear in **bold red text** (`#dc2626` light / `#ff5c5c` dark) with **zero obscuring boxes or borders**.
3. **Difference Navigation**:
   - Jump to the next difference: Press **`F7`** or click **Next Diff (Down Arrow)** in the toolbar.
   - Jump to the previous difference: Press **`Shift+F7`** or click **Prev Diff (Up Arrow)**.
4. **Copying & Merging Changes**:
   - **Chunk Copy**: Click the arrow in the center gutter to copy an entire difference block from Left to Right or Right to Left.
   - **Selected Lines Copy**: Highlight specific lines and click the copy buttons in the toolbar.
   - **Full Reconcile**: Copy all differences across panes with one click.
5. **Line Detail Inspector**:
   - Docked at the bottom of the screen.
   - Whenever you click a line in either editor, the Inspector shows an enlarged, single-line breakdown comparing the Left and Right text character-by-character.

---

### B. Config & XML Compare (`Ctrl+3` / `Cmd+3`)
Designed specifically for cellular network parameters, Kubernetes manifests, and structured configurations.

1. **Automatic Format Detection**:
   - Automatically parses and validates **XML** (`.xml`), **YAML** (`.yaml`, `.yml`), and **JSON** (`.json`).
2. **Semantic Normalization**:
   - Normalizes attribute order (e.g. `<vlan id="205" name="mgmt"/>` vs `<vlan name="mgmt" id="205"/>` are recognized as semantically identical).
   - Strips cosmetic whitespace and comment differences when requested.
3. **Noise Filtering**:
   - Built-in filter suppresses dynamic runtime noise (such as Kubernetes `resourceVersion`, `managedFields`, `generation`, `creationTimestamp`, and `status`).

---

### C. Folder Compare (`Ctrl+1` / `Cmd+1`) *(Native Desktop App)*
Designed for entire directory trees, firmware bundles, and release folders.

1. **Selecting Directories**:
   - Select Left Root and Right Root directories.
   - The recursive scanner indexes the directory trees in background threads.
2. **Comparison Criteria**:
   - **Timestamp & File Size**: Instant initial reconciliation.
   - **Cryptographic SHA-256 Hash**: Deep bit-level verification of file contents.
3. **Difference Filtering**:
   - Toggle **All** (show every file), **Diffs** (show only differing or orphan files), or **Same** (show identical files).
4. **Safe In-Place Synchronization**:
   - Copy files from Left to Right or Right to Left directly.
   - **Safety Backup Copy**: Automatically generates a timestamped `.bak.timestamp` copy before overwriting any file on disk.

> **Note on Web Folder Compare**: If you click Folder Compare on the web version, mDiff displays an informative notice explaining browser sandbox boundaries and provides direct links to launch Text Compare, Config Compare, or download the desktop `.exe`.

---

## 4. Keyboard Shortcuts Quick Reference

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| **`F7`** | Next Difference | Jump cursor and viewport to the next changed block |
| **`Shift + F7`** | Previous Difference | Jump cursor and viewport to the previous changed block |
| **`Ctrl + 1`** | Folder Compare | Switch to directory comparison mode (Desktop) |
| **`Ctrl + 2`** | Text Compare | Switch to side-by-side text comparison mode |
| **`Ctrl + 3`** | Config & XML Compare | Switch to structured XML/YAML/JSON compare |
| **`Ctrl + 4`** | Sessions Launcher | Return to home sessions screen |
| **`Ctrl + 5`** | Preferences | Open settings and ignore rules |
| **`Ctrl + F`** | Find | Open Monaco search widget in the active editor |
| **`Ctrl + H`** | Replace | Open Monaco search and replace widget |
| **`Ctrl + Z`** | Undo | Undo editor modification |
| **`Ctrl + Y`** / `Ctrl+Shift+Z` | Redo | Redo editor modification |
| **`Cmd + /`** / `Ctrl + /` | Shortcuts Modal | Display keyboard shortcut cheat sheet overlay |

---

## 5. Preferences & Comparison Rules (`Ctrl+5`)

Accessible via the gear icon or **Preferences**:

1. **Default Ignore Patterns**:
   - Configure comma-separated glob patterns to ignore during comparisons:
     ```
     .git, node_modules, .DS_Store, *.log, dist
     ```
2. **Case-Sensitive Matching**:
   - Enforce exact file-name case matching (`SiteConfig.xml` != `siteconfig.xml`), or disable for Windows-style case insensitivity.
3. **Safety Confirmations**:
   - **Require explicit confirmation before copying or saving**: Prompts for confirmation to prevent accidental overwrites.
   - **Create safety backup copy (`.bak.timestamp`)**: Automatically archives old files before replacing them.
4. **Privacy & History**:
   - **Save Recent Comparison Paths**: Remembers previous folder paths locally on your device for rapid reopening.
   - **Clear History Now**: One-click button to purge all locally stored file path references.
