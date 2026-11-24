# mDiff — Enterprise IT Security & System Administration Q&A Dossier

**Target Audience**: Corporate IT Security, InfoSec, Endpoint Management (Intune/SCCM), and System Administrators  
**Operating System Focus**: Enterprise Windows 10/11 (with corporate EDR, BitLocker, AppLocker/WDAC) & macOS  
**Application**: mDiff (Mavenir Diff) Comparison Suite (`v7.0.0`)  
**Architecture**: Offline Electron Desktop Application & Zero-Telemetry Web Adapter  
**Author**: im_arg  

---

## 1. Executive Summary & Verification Highlights

**mDiff v7.0.0** is an enterprise-grade, high-performance file, directory, and structured configuration comparison tool designed as a completely offline, zero-cost, high-privacy alternative to commercial tools like Beyond Compare.

- **100% Offline & Air-Gapped**: Zero outbound telemetry, zero background network traffic, zero analytics beacons.
- **Local Native Execution**: Runs purely within standard Windows/macOS user-space without requiring Administrator or UAC elevation.
- **Supply Chain Integrity**: Every single dependency is licensed under permissive MIT or ISC terms. All syntax highlighting and diff calculation engines (including Microsoft's Monaco Editor) are bundled locally on-disk.
- **Windows Executable Integration**: Built with embedded multi-resolution PE (Portable Executable) icon resources (16×16, 32×32, 48×48, 64×64, 128×128, 256×256 RGBA) directly in the binary header, ensuring uniform visual branding across Windows Explorer, the Taskbar, and window title bars.

---

## 2. Network, Data Loss Prevention (DLP) & Privacy

### Q2.1: Does mDiff send any proprietary company code, files, or telemetry out to external cloud servers?
**Direct Answer: Absolutely not.**  
mDiff is **100% air-gapped and offline-by-design**:
- **Zero Telemetry**: No Google Analytics, Mixpanel, Sentry, Datadog, or tracking beacons exist in the codebase.
- **Zero Network Egress**: When comparing files, diffing directories, or editing code, all computation executes strictly on the local CPU inside the local process.
- **Local Asset Bundling**: Monaco Editor (VS Code’s diff engine) and all syntax highlighting packages are bundled locally inside `dist/`. No assets or web workers are requested from public CDNs (e.g., `cdn.jsdelivr.net`).
- **Audit Verification**: Can be run inside an isolated firewall or with Ethernet/Wi-Fi completely disabled with zero degradation in functionality.

---

### Q2.2: Does mDiff open any local listening ports, HTTP servers, or socket listeners?
**Direct Answer: No.**  
In production desktop mode:
- The desktop binary loads the bundled user interface via Chromium's internal protocol (`file://`).
- No internal Express, Node, or WebSocket server is spawned.
- No local ports (e.g., `localhost:8080` or `5173`) are opened or bound in packaged builds. Netstat scans (`netstat -ano | findstr mDiff`) show zero listening ports associated with `mDiff.exe`.

---

### Q2.3: What Content Security Policy (CSP) is enforced?
**Direct Answer**: A hardened, restrictive Content Security Policy is strictly enforced in `index.html`:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' blob:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:;" />
```
- Remote script domains (`https:`) are completely disallowed.
- Evaluated strings (`'unsafe-eval'`) are completely disallowed.
- Web workers are restricted strictly to local blob and origin scripts.

---

## 3. Windows 11 Execution, Privileges & System Integrity

### Q3.1: Does mDiff require Administrator rights (UAC elevation) to run or install?
**Direct Answer: No Administrator rights are required.**  
- mDiff runs in standard **User Space (Least Privilege Principle)**.
- It is delivered as a portable unpacked folder (`win-unpacked` containing `mDiff.exe`).
- An employee can extract the folder into their user profile (e.g., `C:\Users\%USERNAME%\AppData\Local\Programs\mDiff` or `Desktop`) and launch it immediately without triggering a Windows User Account Control (UAC) prompt or needing IT helpdesk credentials.

---

### Q3.2: Does mDiff install any Windows Services, background tasks, or registry startup keys?
**Direct Answer: None.**  
- **No Background Services**: mDiff registers zero Windows Services.
- **No Autoruns**: mDiff does not touch `HKLM\Software\Microsoft\Windows\CurrentVersion\Run` or `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`.
- **No Scheduled Tasks**: No tasks are added to the Windows Task Scheduler.
- **Zero Process Residuals**: When the user exits the application (`Alt+F4` or File > Exit), all Electron and Chromium child processes terminate immediately.

---

### Q3.3: Does mDiff write to protected Windows system directories?
**Direct Answer: No.**  
- mDiff never attempts to write to `C:\Windows`, `C:\Windows\System32`, `C:\Program Files`, or other protected system roots.
- Application state (theme and UI preferences) is stored strictly in the standard Chromium LocalStorage sandbox inside `%APPDATA%\mDiff`.
- File save and copy actions only modify the explicit target files or folders that the user selects via standard Windows File Open/Save dialogs.

---

### Q3.4: How does mDiff prevent accidental file corruption or data loss when merging code?
**Direct Answer: Atomic writes and automatic timestamped backups.**  
- **Automatic Safety Backups**: Whenever a file is overwritten or copied over an existing file, mDiff creates a backup copy: `filename.bak.<timestamp>`.
- **Atomic Temp-File Replacement**: Rather than writing directly into the target file, mDiff writes content to a temporary file (`.mdiff_tmp_<random>`), flushes it to disk, and performs an atomic rename. If power fails or the process is halted mid-save, the original file remains intact.
- **Read-Only Comparisons**: Opening and diffing files and directories is strictly read-only. No file is modified until the user explicitly clicks the Save button or Copy button.

---

### Q3.5: How does mDiff handle Windows Reserved Device Names (e.g., CON, PRN, AUX, NUL)?
**Direct Answer: Proactive filtering at the filesystem bridge.**  
Historically on Windows, applications that attempt to open legacy DOS device names like `CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, or `LPT1-9` can freeze the thread or trigger filesystem driver exceptions.  
mDiff includes an explicit validation function `isWindowsReservedDeviceName` in `path-security.ts`:
- Any attempt to read, write, or copy to these reserved names is intercepted and rejected with a security exception before any Windows OS syscall is issued.

---

## 4. Application Security & Vulnerability Safeguards

### Q4.1: How is the Electron architecture secured against Renderer-to-Node escape?
**Direct Answer: Four layers of defense-in-depth:**
1. **Chromium Sandbox Enabled (`sandbox: true`)**: The renderer process runs inside the standard Chromium OS sandbox.
2. **Context Isolation Enforced (`contextIsolation: true`)**: The renderer JavaScript execution context is isolated from the preload script.
3. **Node Integration Disabled (`nodeIntegration: false`)**: The renderer process has zero access to Node.js APIs (`fs`, `child_process`, `net`, `process`).
4. **Strict Preload Bridge**: Preload script exposes only explicit, strongly-typed asynchronous IPC invokers (`window.mdiffAPI`) through Electron’s `contextBridge.exposeInMainWorld`.

---

### Q4.2: Can a malicious repository or zip file trigger Path Traversal (`../../`)?
**Direct Answer: No.**  
mDiff implements a pure TypeScript path canonicalization module `canonicalizePath`:
- Resolves and collapses all redundant `/`, `.`, and `..` segments before containment verification.
- Enforces strict root-directory checks (`isPathInsideRoot`).
- Validates both `sourcePath` and `destinationPath` on all file operations.
- Intercepts and rejects null bytes (`\0`) and URL-encoded traversal patterns (`%2e%2e`).

---

### Q4.3: How does mDiff handle external links or attempts to open web pages?
**Direct Answer: Hardened window open and navigation handlers:**
1. **Window Open Interception**: `setWindowOpenHandler` denies all internal new-window requests and routes external `http:`/`https:` links to the operating system's default browser via `shell.openExternal`.
2. **Navigation Lockdown**: The `will-navigate` event blocks navigation away from the bundled `file://` protocol.
3. **Webview Disabled**: The `will-attach-webview` event immediately prevents `<webview>` tag injection.
