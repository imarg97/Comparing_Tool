/**
 * Browser Fallback Adapter for DiffX
 * Provides client-side, zero-telemetry Web compatibility when hosted on Vercel / Web
 */

import {
  DiffxPreloadAPI,
  FolderComparisonOptions,
  FolderComparisonResult,
  SaveRequest,
  CopyRequest,
  DeleteRequest,
  StructuredDiffRequest,
  ScanProgress,
} from '@shared/types.js';
import { matchEntries, ScannedItem } from '@shared/comparison-engine/matcher.js';
import { compareStructuredData } from '@shared/comparison-engine/structured.js';
import { shouldIgnorePath } from '@shared/comparison-engine/wildcard.js';

function sha256Fallback(buffer: ArrayBuffer): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
  let H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;

  const bytes = new Uint8Array(buffer);
  const totalLen = bytes.length;
  const bitLen = totalLen * 8;

  const paddedLen = Math.ceil((totalLen + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[totalLen] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);

  const W = new Int32Array(64);
  const rightRotate = (v: number, n: number) => (v >>> n) | (v << (32 - n));

  for (let i = 0; i < paddedLen; i += 64) {
    for (let t = 0; t < 16; t++) {
      W[t] = view.getInt32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rightRotate(W[t - 15], 7) ^ rightRotate(W[t - 15], 18) ^ (W[t - 15] >>> 3);
      const s1 = rightRotate(W[t - 2], 17) ^ rightRotate(W[t - 2], 19) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
    }

    let a = H0, b = H1, c = H2, d = H3, e = H4, f = H5, g = H6, h = H7;

    for (let t = 0; t < 64; t++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    H0 = (H0 + a) | 0;
    H1 = (H1 + b) | 0;
    H2 = (H2 + c) | 0;
    H3 = (H3 + d) | 0;
    H4 = (H4 + e) | 0;
    H5 = (H5 + f) | 0;
    H6 = (H6 + g) | 0;
    H7 = (H7 + h) | 0;
  }

  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return toHex(H0) + toHex(H1) + toHex(H2) + toHex(H3) + toHex(H4) + toHex(H5) + toHex(H6) + toHex(H7);
}

async function computeBrowserHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  try {
    // In secure contexts (HTTPS or localhost), use hardware-accelerated Web Cryptography
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // Fall back if subtle crypto is blocked or throws
  }
  // Universal fallback: works in insecure HTTP (e.g. internal IP http://10.10.84.22)
  return sha256Fallback(buffer);
}

// Memory cache for browser-selected folders/files
const browserFolderStore = {
  leftFiles: new Map<string, File>(),
  rightFiles: new Map<string, File>(),
  leftFolderName: 'Left Folder',
  rightFolderName: 'Right Folder',
  singleFiles: new Map<string, File>(),
  directories: new Map<string, Map<string, File>>(),
  leftFile: null as File | null,
  rightFile: null as File | null,
};

/**
 * Creates an input element to trigger native browser directory or file selection
 */
function selectViaBrowserInput(directory: boolean): Promise<{ files: File[]; rootName: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (directory) {
      input.setAttribute('webkitdirectory', '');
      input.setAttribute('directory', '');
    } else {
      input.multiple = false;
    }

    let resolved = false;

    input.onchange = () => {
      if (resolved) return;
      resolved = true;
      if (!input.files || input.files.length === 0) {
        resolve(null);
        return;
      }
      const files = Array.from(input.files);
      const rootName = directory && files[0].webkitRelativePath
        ? files[0].webkitRelativePath.split('/')[0]
        : files[0].name;
      resolve({ files, rootName });
    };

    // Standard HTML5 cancel event when user cancels the native file dialog
    input.addEventListener('cancel', () => {
      if (resolved) return;
      resolved = true;
      resolve(null);
    });

    input.click();
  });
}

export function registerBrowserFile(pathKey: string, file: File, side?: 'left' | 'right'): void {
  browserFolderStore.singleFiles.set(pathKey, file);
  browserFolderStore.singleFiles.set(file.name, file);
  browserFolderStore.singleFiles.set(`file://${pathKey}`, file);
  browserFolderStore.singleFiles.set(`browser://${pathKey}`, file);
  if (side === 'left') {
    browserFolderStore.leftFile = file;
  } else if (side === 'right') {
    browserFolderStore.rightFile = file;
  }
}

export function createBrowserFallbackAPI(): DiffxPreloadAPI {
  let progressListener: ((progress: ScanProgress) => void) | null = null;

  return {
    getPathForFile: (file: File) => {
      const explicit = (file as any).path;
      if (explicit) return explicit;
      if (file.webkitRelativePath && file.webkitRelativePath.includes('/')) {
        return file.webkitRelativePath;
      }
      return file.name;
    },

    selectDirectory: async (_defaultPath?: string, side?: 'left' | 'right') => {
      const res = await selectViaBrowserInput(true);
      if (!res) return null;
      const dirUri = res.rootName;
      const filesMap = new Map<string, File>();

      for (const f of res.files) {
        const rel = f.webkitRelativePath
          ? f.webkitRelativePath.split('/').slice(1).join('/')
          : f.name;
        filesMap.set(rel, f);
      }

      browserFolderStore.directories.set(dirUri, filesMap);
      browserFolderStore.directories.set(`browser://${dirUri}`, filesMap);

      if (side === 'left') {
        browserFolderStore.leftFiles = filesMap;
        browserFolderStore.leftFolderName = res.rootName;
      } else if (side === 'right') {
        browserFolderStore.rightFiles = filesMap;
        browserFolderStore.rightFolderName = res.rootName;
      }

      return dirUri;
    },

    selectFile: async (_defaultPath?: string, side?: 'left' | 'right') => {
      const res = await selectViaBrowserInput(false);
      if (!res || res.files.length === 0) return null;
      const file = res.files[0];

      // Save pane-specific reference without prompting the user
      if (side === 'left') {
        browserFolderStore.leftFile = file;
      } else if (side === 'right') {
        browserFolderStore.rightFile = file;
      }

      let returnedPath = '';

      if (_defaultPath && (_defaultPath.includes('/') || _defaultPath.includes('\\'))) {
        const lastSlash = Math.max(_defaultPath.lastIndexOf('/'), _defaultPath.lastIndexOf('\\'));
        if (lastSlash > 0) {
          const dir = _defaultPath.substring(0, lastSlash);
          const sep = _defaultPath.includes('\\') ? '\\' : '/';
          returnedPath = `${dir}${sep}${file.name}`;
        }
      }

      if (!returnedPath) {
        if ((file as any).path) {
          returnedPath = (file as any).path;
        } else if (file.webkitRelativePath && file.webkitRelativePath.includes('/')) {
          returnedPath = file.webkitRelativePath;
        } else {
          returnedPath = file.name;
        }
      }

      // Index file under multiple possible lookup paths for seamless loading
      browserFolderStore.singleFiles.set(returnedPath, file);
      browserFolderStore.singleFiles.set(file.name, file);
      if (side) {
        browserFolderStore.singleFiles.set(`${side}/${file.name}`, file);
        browserFolderStore.singleFiles.set(`${side === 'left' ? 'L' : 'R'}/${file.name}`, file);
      }

      return returnedPath;
    },

    showConfirmDialog: async (options) => {
      const confirmed = window.confirm(`${options.title}\n\n${options.message}\n\n${options.detail || ''}`);
      return confirmed;
    },

    compareFolders: async (leftPath: string, rightPath: string, options: FolderComparisonOptions) => {
      const startTime = Date.now();
      const leftItems = new Map<string, ScannedItem>();
      const rightItems = new Map<string, ScannedItem>();

      // Check if directories map has files for leftPath or rightPath
      const leftFiles =
        browserFolderStore.directories.get(leftPath) ||
        browserFolderStore.directories.get(`browser://${leftPath}`) ||
        (browserFolderStore.leftFiles.size > 0 ? browserFolderStore.leftFiles : null);

      const rightFiles =
        browserFolderStore.directories.get(rightPath) ||
        browserFolderStore.directories.get(`browser://${rightPath}`) ||
        (browserFolderStore.rightFiles.size > 0 ? browserFolderStore.rightFiles : null);

      // If no files were loaded yet into browser memory, generate rich sample comparison matching the paths
      if ((!leftFiles || leftFiles.size === 0) && (!rightFiles || rightFiles.size === 0)) {
        return createSampleWebComparison(leftPath, rightPath, options);
      }

      // Hash left files
      if (leftFiles) {
        let count = 0;
        for (const [relPath, file] of leftFiles.entries()) {
          if (shouldIgnorePath(relPath, options.ignorePatterns, options.caseSensitive)) continue;
          count++;
          if (progressListener) {
            progressListener({ currentPath: relPath, scannedCount: count, phase: 'scanning-left' });
          }
          const hash = await computeBrowserHash(file);
          leftItems.set(relPath, {
            relativePath: relPath,
            name: file.name,
            isDirectory: false,
            metadata: {
              exists: true,
              size: file.size,
              mtime: file.lastModified,
              hash,
              isDirectory: false,
              isSymlink: false,
              readable: true,
            },
          });
        }
      }

      // Hash right files
      if (rightFiles) {
        let count = 0;
        for (const [relPath, file] of rightFiles.entries()) {
          if (shouldIgnorePath(relPath, options.ignorePatterns, options.caseSensitive)) continue;
          count++;
          if (progressListener) {
            progressListener({ currentPath: relPath, scannedCount: count, phase: 'scanning-right' });
          }
          const hash = await computeBrowserHash(file);
          rightItems.set(relPath, {
            relativePath: relPath,
            name: file.name,
            isDirectory: false,
            metadata: {
              exists: true,
              size: file.size,
              mtime: file.lastModified,
              hash,
              isDirectory: false,
              isSymlink: false,
              readable: true,
            },
          });
        }
      }

      const { flatList, tree, summary } = matchEntries(leftItems, rightItems, options);
      summary.scanDurationMs = Date.now() - startTime;

      return {
        leftRoot: leftPath,
        rightRoot: rightPath,
        options,
        summary,
        tree,
        flatList,
        timestamp: Date.now(),
      };
    },

    cancelFolderComparison: async () => {},

    onScanProgress: (callback) => {
      progressListener = callback;
      return () => {
        progressListener = null;
      };
    },

    readFile: async (filePath: string, _maxBytes?: number, side?: 'left' | 'right') => {
      let stored: File | undefined | null = null;

      // 1. If pane side is specified, prefer the file chosen specifically for that side
      if (side === 'left' && browserFolderStore.leftFile) {
        if (!filePath || filePath.endsWith(browserFolderStore.leftFile.name) || browserFolderStore.leftFile.name === filePath) {
          stored = browserFolderStore.leftFile;
        }
      } else if (side === 'right' && browserFolderStore.rightFile) {
        if (!filePath || filePath.endsWith(browserFolderStore.rightFile.name) || browserFolderStore.rightFile.name === filePath) {
          stored = browserFolderStore.rightFile;
        }
      }

      // 2. Direct match in singleFiles
      if (!stored) {
        stored = browserFolderStore.singleFiles.get(filePath);
      }

      // 3. Normalized match (strip leading prefixes or slashes)
      if (!stored) {
        const normalized = filePath.replace(/^(file:\/\/|browser:\/\/)/, '').replace(/^\/+/, '');
        stored = browserFolderStore.singleFiles.get(normalized);
      }

      // 4. Search directory stores if selected via folder picker
      if (!stored) {
        for (const [dirUri, map] of browserFolderStore.directories.entries()) {
          if (filePath.startsWith(dirUri)) {
            const sub = filePath.replace(dirUri, '').replace(/^\/+/, '');
            if (map.has(sub)) {
              stored = map.get(sub);
              break;
            }
          }
        }
      }

      // 5. Fallback lookup by relative segment or basename
      if (!stored) {
        const basename = filePath.split(/[/\\]/).pop();
        for (const [key, f] of browserFolderStore.singleFiles.entries()) {
          if (filePath.endsWith(key) || key.endsWith(filePath) || (basename && f.name === basename)) {
            stored = f;
            break;
          }
        }

        if (!stored) {
          const savedText = (basename && localStorage.getItem(`diffx_saved_${basename}`)) || localStorage.getItem(`diffx_saved_${filePath}`);
          if (savedText !== null) {
            return {
              path: filePath,
              content: savedText,
              encoding: 'utf-8',
              size: savedText.length,
              mtime: Date.now(),
              isTruncated: false,
              hash: 'saved-in-app-hash',
            };
          }
        }
      }

      if (stored) {
        const text = await stored.text();
        const hash = await computeBrowserHash(stored);
        return {
          path: filePath,
          content: text,
          encoding: 'utf-8',
          size: stored.size,
          mtime: stored.lastModified,
          isTruncated: false,
          hash,
        };
      }

      // If empty or unfound, return clean empty content or note
      return {
        path: filePath,
        content: ``,
        encoding: 'utf-8',
        size: 0,
        mtime: Date.now(),
        isTruncated: false,
        hash: 'demo-hash',
        error: filePath ? `File '${filePath}' not found in browser storage.` : undefined,
      };
    },

    saveFile: async (request: SaveRequest) => {
      // In browser, save in ephemeral memory cache and trigger native browser file download
      const rawName = request.filePath.split(/[/\\]/).pop() || 'file.txt';
      const cleanName = rawName.replace(/[\0\r\n\t]/g, '').replace(/[^a-zA-Z0-9._\-]/g, '_');

      // Update in-memory file cache
      const updatedFile = new File([request.content], cleanName);
      browserFolderStore.singleFiles.set(request.filePath, updatedFile);
      browserFolderStore.singleFiles.set(cleanName, updatedFile);

      // Direct disk download trigger for browser users
      try {
        if (typeof document !== 'undefined') {
          const blob = new Blob([request.content], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = cleanName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        }
      } catch {
        // non-fatal
      }

      return {
        success: true,
        filePath: request.filePath,
        bytesWritten: request.content.length,
      };
    },

    copyFile: async (request: CopyRequest) => {
      return {
        success: true,
        sourcePath: request.sourcePath,
        destinationPath: request.destinationPath,
      };
    },

    deleteFile: async (request: DeleteRequest) => {
      return {
        success: true,
        filePath: request.filePath,
      };
    },

    compareStructured: async (request: StructuredDiffRequest) => {
      return compareStructuredData(request);
    },

    openInSystemExplorer: async () => true,
    getAppVersion: async () => '3.7.0 (Security Hardened Web Release)',
    getPlatform: async () => 'browser',
    isBrowser: true,
  };
}

export function isBrowserEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return !window.diffxAPI || Boolean(window.diffxAPI.isBrowser);
}

function createSampleWebComparison(
  leftPath: string,
  rightPath: string,
  options: FolderComparisonOptions
): FolderComparisonResult {
  const leftItems = new Map<string, ScannedItem>();
  const rightItems = new Map<string, ScannedItem>();

  leftItems.set('config.yaml', {
    relativePath: 'config.yaml',
    name: 'config.yaml',
    isDirectory: false,
    metadata: { exists: true, size: 240, mtime: Date.now() - 3600000, hash: 'h1', isDirectory: false, isSymlink: false, readable: true },
  });
  rightItems.set('config.yaml', {
    relativePath: 'config.yaml',
    name: 'config.yaml',
    isDirectory: false,
    metadata: { exists: true, size: 290, mtime: Date.now(), hash: 'h2', isDirectory: false, isSymlink: false, readable: true },
  });

  leftItems.set('package.json', {
    relativePath: 'package.json',
    name: 'package.json',
    isDirectory: false,
    metadata: { exists: true, size: 850, mtime: Date.now(), hash: 'pkg_identical', isDirectory: false, isSymlink: false, readable: true },
  });
  rightItems.set('package.json', {
    relativePath: 'package.json',
    name: 'package.json',
    isDirectory: false,
    metadata: { exists: true, size: 850, mtime: Date.now(), hash: 'pkg_identical', isDirectory: false, isSymlink: false, readable: true },
  });

  leftItems.set('telecom-core.env', {
    relativePath: 'telecom-core.env',
    name: 'telecom-core.env',
    isDirectory: false,
    metadata: { exists: true, size: 120, mtime: Date.now(), hash: 'env_left', isDirectory: false, isSymlink: false, readable: true },
  });

  rightItems.set('deploy.sh', {
    relativePath: 'deploy.sh',
    name: 'deploy.sh',
    isDirectory: false,
    metadata: { exists: true, size: 480, mtime: Date.now(), hash: 'sh_right', isDirectory: false, isSymlink: false, readable: true },
  });

  const { flatList, tree, summary } = matchEntries(leftItems, rightItems, options);

  return {
    leftRoot: leftPath || 'demo://production-cluster',
    rightRoot: rightPath || 'demo://staging-cluster',
    options,
    summary,
    tree,
    flatList,
    timestamp: Date.now(),
  };
}
