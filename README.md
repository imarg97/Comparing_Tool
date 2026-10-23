# DiffX — Professional Desktop Comparison Suite

DiffX is a production-oriented desktop comparison application built for engineering teams, cloud operations, telecom deployment, and DevOps professionals. Inspired by the workflows of professional comparison suites, DiffX provides recursive folder comparison, Monaco-powered side-by-side text diffing, and semantic configuration comparison (Kubernetes, OpenShift, YAML, JSON) in an original, high-density desktop interface.

---

## Key Principles & Guarantees

- **100% Local-First & Offline**: Operates completely offline with zero outbound network calls.
- **Zero Telemetry / No Tracking**: No analytics, telemetry beacons, cloud syncing, accounts, or mandatory license checks.
- **Cryptographic Verification**: Compares file contents reliably using SHA-256 hashes—never assumes identity based on file size or modification time alone.
- **Safety First**: Overwrite, copy, and save operations require explicit confirmation and provide automatic `.bak` safety backups.
- **Security-Hardened Architecture**: Electron main process runs with `contextIsolation: true`, `nodeIntegration: false`, path-traversal prevention, and symlink loop protection.

---

## Functional Workspaces

### 1. Folder Compare
- **Recursive Directory Scanning**: Scans arbitrary folder hierarchies with live progress updates and cancellation support.
- **Precise Status Classification**:
  - `Identical`: Cryptographic content hash matches.
  - `Modified`: Content differs (modification timestamp differences are clearly displayed separately).
  - `Left Only` & `Right Only`: Files or directories present on only one side.
  - `Error`: Permissions or unreadable disk errors caught safely without crashing.
- **Dual Presentation Modes**: Switch between an expandable **Tree View** and a unified **Flat File List**.
- **Interactive Filtering & Sorting**: Filter by status (`Modified`, `Different`, `Identical`, `Left Only`, `Right Only`, `Errors`), search queries, and file extensions. Sort by Name, Status, Size, or Timestamp.
- **Configurable Ignore Rules**: Ignore directories and files matching patterns (e.g. `.git, node_modules, .DS_Store, *.log, dist`).
- **Safe Copy Operations**: Copy individual files left-to-right or right-to-left with collision checks, preview paths, and optional safety backups.
- **Direct Editor Handoff**: Double-click any file pair in the folder tree to immediately launch them in side-by-side Text Compare.

### 2. Text Compare
- **Monaco Diff Engine**: Microsoft Monaco Editor diff capabilities with full syntax highlighting (YAML, JSON, TypeScript, Python, Shell, Markdown, XML, etc.).
- **View Modes**: Switch between **Side-by-Side** and **Inline Unified** diff layouts.
- **Whitespace & Blank Line Normalization**:
  - Compare whitespace strictly.
  - Ignore leading and trailing whitespace.
  - Ignore all whitespace.
  - Ignore blank lines.
  - **Whitespace Notice**: Clearly warns when documents differ solely in whitespace or line endings.
- **Diff Navigation**: Jump forward and backward between differences using `F7` and `Shift+F7` (or toolbar buttons).
- **Safe Editing & Backups**: Edit either left or right document directly, view unsaved edit badges, revert to disk version, or save atomically with timestamped backups.
- **Large File Safety Guard**: Files exceeding 5 MB load with preview protection to ensure Monaco and UI smoothness.

### 3. K8s & Config Compare (Structured Comparison)
- **Semantic Diffing**: Parses YAML and JSON into structural ASTs to distinguish true structural value changes from non-functional formatting differences.
- **Kubernetes & OpenShift Noise Suppression**: Automatically filters noisy runtime metadata fields (`metadata.resourceVersion`, `metadata.uid`, `metadata.generation`, `metadata.creationTimestamp`, `metadata.managedFields`, `status`) so engineers can compare deployments and helm charts without false alarms.
- **Object Path Table**: Displays key paths (e.g. `spec.replicas`, `spec.template.spec.containers[0].image`) with added, removed, and modified badges.

### 4. Recent Comparisons & History
- Stores previously compared folder and file paths locally.
- **Privacy Assurance**: Only stores path strings and timestamps in local storage. Never stores file contents.
- Provides a one-click **Clear History** button and a preference toggle to disable history tracking entirely.

### 5. Settings & License Inventory
- Configure default ignore patterns, case sensitivity, and backup preferences.
- Built-in third-party open-source license inventory (`LICENSES.md`).

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Cmd/Ctrl + 1` | Switch to Folder Compare |
| `Cmd/Ctrl + 2` | Switch to Text Compare |
| `Cmd/Ctrl + 3` | Switch to K8s & Config Compare |
| `Cmd/Ctrl + 4` | Switch to Recent Comparisons |
| `Cmd/Ctrl + 5` | Switch to Preferences & Settings |
| `Cmd/Ctrl + R` | Refresh active comparison |
| `Cmd/Ctrl + Alt + S` | Swap Left and Right sides |
| `F7` / `Alt + Down` | Jump to next difference |
| `Shift + F7` / `Alt + Up` | Jump to previous difference |
| `Cmd/Ctrl + S` | Save file changes in editor (with confirmation) |
| `Cmd/Ctrl + /` | Open Keyboard Shortcuts modal |

---

## Technical Stack & Architecture

```
diffx/
├── src/
│   ├── main/                       # Electron Main Process
│   │   ├── fs-engine/              # Native filesystem scanner & hasher
│   │   │   ├── hasher.ts           # Streaming SHA-256 computation
│   │   │   ├── scanner.ts          # Recursive directory scanner & progress
│   │   │   └── safe-fs.ts          # Atomic writing, backups, traversal guard
│   │   ├── index.ts                # App lifecycle, macOS menu, window creation
│   │   ├── ipc.ts                  # Typed IPC dispatcher & security validation
│   │   └── preload.ts              # Secure narrow contextBridge API
│   ├── shared/                     # Pure TypeScript Engine (React-independent)
│   │   ├── comparison-engine/      # Matcher, filter, wildcard, structured, whitespace
│   │   └── types.ts                # Central domain models & IPC interfaces
│   └── renderer/                   # React 19 + Tailwind CSS + Monaco Editor
│       ├── components/             # Header, StatusBar, ConfirmModal, ShortcutsModal
│       ├── views/                  # FolderCompare, TextCompare, StructuredCompare, etc.
│       ├── App.tsx                 # Core application shell & navigation
│       └── main.tsx                # React entrypoint
├── test/
│   ├── fixtures/                   # Deterministic test directories (left & right)
│   └── unit/                       # Vitest suites for engine, security & fs
├── dist/                           # Compiled frontend bundle (Vite)
├── dist-electron/                  # Compiled Electron main & preload
├── release/                        # Packaged macOS & Windows application bundles
├── package.json
└── tsconfig.json
```

---

## Getting Started

### Prerequisites
- Node.js >= 20 (Node.js 22+ recommended)
- npm >= 10

### 1. Installation
```bash
npm install
```

### 2. Run Tests
Execute the unit test suite covering classification, hash verification, whitespace normalization, path security, and directory scanning:
```bash
npm test
```

### 3. Run Type Checking & Linter
```bash
npm run lint
```

### 4. Build Application
Compile both the React web application and the Electron main process:
```bash
npm run build
```

### 5. Launch in Development Mode
Start Vite dev server and launch the desktop window:
```bash
npm run dev
# in a separate terminal:
npm start
```

### 6. Package Desktop Application
Build a standalone executable desktop application:
```bash
npm run package
```
On macOS, this packages the native application into `release/mac-arm64/DiffX.app`.

---

## Security Model

DiffX is designed with a defense-in-depth security posture:
1. **Sandboxed Window**: `contextIsolation: true` and `nodeIntegration: false` prevent arbitrary script execution from accessing Node.js.
2. **Path Traversal Guard**: Prevents attempts to write or read outside designated targets via `..` or maliciously crafted relative paths.
3. **Symlink Cycle Protection**: Directory symlinks are not followed by default to prevent infinite recursion, disk exhaustion, and unexpected writes outside the comparison root.
4. **Non-Destructive Defaults**: No destructive actions (overwrites, deletions, synchronization) occur automatically. Every file modification requires explicit confirmation.

---

## Known Limitations & Roadmap

- **Phase 3 Planned Capabilities**:
  - Three-way folder merge.
  - Image side-by-side overlay diffing.
  - Archive (.zip, .tar.gz) in-place comparison.
  - CSV / Tabular column-aligned diffing.
- **Phase 5 Optional AI Explanations**:
  - Optional local-LLM assistant interface for operational change impact summaries (disabled by default, strictly opt-in).
