# mDiff — Comprehensive User Guide & How-to-Use Manual

**Application**: mDiff (Mavenir Diff) Comparison Suite  
**Version**: `v5.1.0`  
**Platforms**: Web (`http://10.10.84.22:8097`), Windows 10/11 (`mDiff.exe`), macOS (`mDiff.app`)  
**Design Standard**: Beyond Compare Enterprise Fidelity & Visual Parity  

---

## 1. Overview & Core Philosophy

**mDiff** is an enterprise-grade, high-performance file, directory, and structured configuration comparison suite built for telecom network engineers, system administrators, and software developers. 

mDiff combines:
- **Diff Overview Map Smooth Dragging & Freeform Navigation (v5.1.0)**: The far-left vertical minimap bar allows freeform dragging and clicking without snapping to diff chunks. It reflects the exact visible viewport (`visibleStartLine` to `visibleEndLine`) in real time, while individual diff markers can be clicked directly to jump.
- **Precision Aligned Line Details Inspector (v5.1.0)**: In both Text and Structured Compare, the bottom split inspection bar accurately matches lines between Left and Right across gaps and insertions, displaying green **"Lines identical"** status without false differences in unchanged sections.
- **Dynamic Difference Updating**: When files are synchronized, edited, or copied between panes, difference statuses update dynamically in real time. The left-side red font and center gutter (`≠`) immediately change back to clean black font and `=`.
- **Hierarchical Red-to-Black Folder Transition**: Parent directories containing differences display red folder icons and bold red text. As soon as all child differences are synchronized, the parent folder icon and name dynamically transition to solid dark black (`text-neutral-900`) with zero lag.
- **In-Memory Session Caching**: Folder comparisons remain persistently mounted and cached in memory across session tab switches. Switching from active text editing (`.bashrc`, `others.sh`, `values.yaml`) back to Folder Compare takes 0ms with zero re-scanning.
- **Home Screen Dashboard as Default Launch**: Applications open directly to the clean Beyond Compare-styled launcher dashboard with 5 comparison session options (Folder Compare, Text Compare, Config & XML, Folder Sync, and Table & Data).
- **Beyond Compare Monospace Typography**: Employs corporate standard monospace fonts (`Consolas`, `Lucida Console`, `DejaVu Sans Mono`) at `13px` / line height `20px` with clean regular weight (`400`) for standard code tokens, ensuring clear, comfortable reading without visual strain.
- **Beyond Compare Dynamic Session Tab Bar**: Tab 1 hosts the active Folder comparison session (e.g. `📁 IMC_31_0_Mexico_site3 <-> IMC_11_0_29_0 ✕`), while double-clicking any file spawns a dedicated file session tab (e.g. `📄 values.yaml ✕` with green accent badge). Tabs can be individually closed (`✕`) or opened with the `[+]` button.
- **Beyond Compare Color Palette**:
  - **Left Side**: Modified files and parent folders containing diffs appear in **bold red text** (`#c51b1b`) with red folder/file icons and timestamps.
  - **Right Side**: Clean, solid regular black font (`text-neutral-900` light / `text-neutral-100` dark) for all identical and modified items—no washed out gray text or gray icons.
  - **Orphans**: Files or folders existing only on one side are highlighted in distinct **purple text** (`#7e22ce`) and purple icons on both left and right.
  - **Identical Files**: Clean regular black font on both sides with `=` in the center divider.
  - **Row Selection**: Soft sky blue highlight (`#e0edff`).
- **Interactive Zoom**: Zoom in and out smoothly from **70% to 200%** using **`Ctrl` + mouse wheel (roller button)** or `Ctrl + +`, `Ctrl + -`, and `Ctrl + 0` (reset), supported across both the Monaco code editor and directory trees.
- **Universal Python 3 Server Engine**: Deployable anywhere from Python 3.6 to 3.13+ on RHEL/CentOS with zero external dependencies and built-in SPA routing.
- **Air-Gapped & Zero-Telemetry**: Does not transmit files, keystrokes, diff results, or telemetry to external servers.

---

## 2. Getting Started & Beyond Compare Session Tabs

Upon launching mDiff, the top bar presents the **Beyond Compare Session Tab Bar**:

```
+-------------------------------------------------------------------------------------------------------+
| mDiff v5.1.0  [📁 IMC_31_0_Mexico_site3 <-> IMC_11_0_29_0 ✕]  [📄 values.yaml ✕]  [+]   [-] 100% [+]  |
+-------------------------------------------------------------------------------------------------------+
```

1. **Folder Session Tab**: Always displays the exact folder names being compared (e.g. `IMC_31_0_Mexico_site3 <-> IMC_11_0_29_0`).
2. **File Session Tabs**: Double-clicking any file in Folder Compare (such as `values.yaml` or `Chart.yaml`) automatically opens it as a dedicated tab with an active green accent badge (`#22c55e`).
3. **Closing & New Sessions**: Click `✕` on any tab to close it, or click `[+]` to open a new comparison session.
4. **Interactive Zoom Controls**: The `[-] 100% [+]` toolbar widget provides one-click zooming, or use `Ctrl` + mouse wheel.
5. **Sessions Hub**: Click **Sessions** (`Ctrl+4`) at any time to return to the launcher screen.

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
   - Select Left Root and Right Root directories via the **Browse** buttons or by dragging and dropping folders directly onto the Left / Right headers.
   - The recursive scanner indexes directory trees in background threads with zero UI freezing.
2. **Beyond Compare Collapsed Tree Paradigm**:
   - **Default Initial Collapsed View**: Following the Beyond Compare paradigm, directories start collapsed at the root level upon comparison. This allows engineers navigating multi-gigabyte or deeply nested folder structures to immediately see high-level summary counts without being overwhelmed by thousands of expanded sub-files.
   - **Click Anywhere on Folder to Open / Close**: Clicking anywhere along a folder row (folder icon, name, or metadata) instantly toggles folder expansion open or closed (no need to hunt for the small chevron arrow).
   - **Global Expand / Collapse**: Use the `+^ Expand` and `-^ Collapse` buttons in the toolbar to expand or collapse all subdirectories at once.
3. **Right-Click Context Menu, Rename & Safe Deletion**:
   - Right-click any file or folder (e.g. `desktop.ini`, temporary caches, or orphan files) to reveal the contextual action menu:
     - **Rename Left File/Folder...** / **Rename Right File/Folder...**: Safely rename an item on either side directly within the app without leaving to file explorer.
     - **Delete Left File...** / **Delete Right File...**: Safely remove an unwanted file or folder from either side with an explicit confirmation dialog.
     - **Delete Both Sides...**: Simultaneously delete corresponding items from both directories.
     - **Compare in Text Editor**: Immediately open the selected file pair directly in Text Compare (`Ctrl+2`).
     - **Copy Left to Right** / **Copy Right to Left**: Synchronize individual files.
     - **Show in System Explorer**: Open the containing folder in Windows Explorer or macOS Finder.
   - **Safe Rename & Deletion Engine**: Prevents path traversal (`..`), protects Windows reserved devices (`CON`, `PRN`, `AUX`, `NUL`), prevents collision with existing files, and optionally creates timestamped `.bak.<timestamp>` safety copies before removal.
   - **Filled Colored Folder Icons (Beyond Compare Standard)**:
     - **Differences**: Filled bright red folder icon (`fill-red-500 text-red-700`) with bold red text on **BOTH** sides.
     - **Identical**: Rich filled amber/yellow manila folder icon (`fill-amber-400 text-amber-600`) with solid dark black font on **BOTH** sides.
     - **Orphans**: Filled purple folder icon (`fill-purple-400 text-purple-700`) with bold purple text.
   - **Real-Time Timestamps & Instant Auto-Refresh**: Saving changes in child files immediately updates timestamps on the folder comparison tree with zero latency. A dedicated **Compare (F5)** button between the address boxes re-checks disk files instantly.
4. **Cross-Name & Orphan Manual File Comparison (Beyond Compare Manual Alignment)**:
   In telecom configurations, corresponding configuration files often have different site-specific prefixes or names (for example, `ixla-server-cnims-imcsm-userdata` on Site 1 vs `pval-ns-cnims-imc1-imcsm-userdata` on Site 2). Because the filenames differ, standard directory comparison displays each as an orphan file. mDiff provides complete flexibility to pair and compare any two files with different names:
   - **Method 1 (`Ctrl + Click`)**:
     1. Hold `Ctrl` (or `Cmd` on macOS) and click the file on the **Left Pane** (e.g. `ixla-server-cnims-imcsm-userdata`). The left item is highlighted with an active blue selection ring.
     2. Hold `Ctrl` and click the corresponding file on the **Right Pane** (e.g. `pval-ns-cnims-imc1-imcsm-userdata`). The right item is highlighted with an active blue selection ring.
     3. A prominent comparison action bar automatically appears at the bottom:
        `Ready to Compare: [ixla-server-cnims-imcsm-userdata] ↔ [pval-ns-cnims-imc1-imcsm-userdata]   [Compare Selected (Enter)] [Clear]`
     4. Press **`Enter`** or click **`Compare Selected`** to open both files side-by-side in Text Compare immediately!
     5. The session tab displays both names clearly: `[📄 ixla-server-cnims-imcsm-userdata ↔ pval-ns-cnims-imc1-imcsm-userdata ✕]` with the active green accent badge (`#22c55e`).
   - **Method 2 (Double-Click)**:
     With one file selected on either side, simply double-click the file on the opposite side to immediately open both in Text Compare.
   - **Method 3 (Right-Click Context Menu)**:
     Right-click any file and choose **`Select as Left File for Compare`** or **`Select as Right File for Compare`**, or right-click the second file and select **`Compare with Left/Right [Selected File]`**.
5. **Comparison Criteria**:
   - **Timestamp & File Size**: Instant initial reconciliation.
   - **Cryptographic SHA-256 Hash**: Deep bit-level verification of file contents.
5. **Difference Filtering**:
   - Toggle **All** (show every file), **Diffs** (show only differing or orphan files), or **Same** (show identical files).
   - Filter by **Left Orphans** or **Right Orphans** to identify files unique to one side.
6. **Safe In-Place Synchronization**:
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
| **`Ctrl + Wheel`** | Mouse Wheel Zoom | Zoom in or out (70% - 200%) on editor and folder tree |
| **`Ctrl + +`** / `Ctrl + =` | Zoom In | Increase font and row scale by +10% |
| **`Ctrl + -`** | Zoom Out | Decrease font and row scale by -10% |
| **`Ctrl + 0`** | Reset Zoom | Reset zoom scale back to default 100% |
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
