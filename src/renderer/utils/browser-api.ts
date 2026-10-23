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
  StructuredDiffRequest,
  ScanProgress,
} from '@shared/types.js';
import { matchEntries, ScannedItem } from '@shared/comparison-engine/matcher.js';
import { compareStructuredData } from '@shared/comparison-engine/structured.js';
import { shouldIgnorePath } from '@shared/comparison-engine/wildcard.js';

async function computeBrowserHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
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

    input.onchange = () => {
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

    // If cancelled
    window.addEventListener(
      'focus',
      () => {
        setTimeout(() => {
          if (!input.files || input.files.length === 0) {
            resolve(null);
          }
        }, 800);
      },
      { once: true }
    );

    input.click();
  });
}

export function registerBrowserFile(pathKey: string, file: File): void {
  browserFolderStore.singleFiles.set(pathKey, file);
  browserFolderStore.singleFiles.set(`file://${pathKey}`, file);
  browserFolderStore.singleFiles.set(`browser://${pathKey}`, file);
}

export function createBrowserFallbackAPI(): DiffxPreloadAPI {
  let progressListener: ((progress: ScanProgress) => void) | null = null;

  return {
    selectDirectory: async (_defaultPath?: string, side?: 'left' | 'right') => {
      const res = await selectViaBrowserInput(true);
      if (!res) return null;
      const dirUri = `browser://${res.rootName}`;
      const filesMap = new Map<string, File>();

      for (const f of res.files) {
        const rel = f.webkitRelativePath
          ? f.webkitRelativePath.split('/').slice(1).join('/')
          : f.name;
        filesMap.set(rel, f);
      }

      browserFolderStore.directories.set(dirUri, filesMap);

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

      const returnedPath = file.webkitRelativePath && file.webkitRelativePath.includes('/')
        ? file.webkitRelativePath
        : file.name;

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

      // Read from browser file store or generate sample demo entries if paths are sample strings
      if (browserFolderStore.leftFiles.size === 0 && browserFolderStore.rightFiles.size === 0) {
        // Provide rich sample demo dataset for Web visitors
        return createSampleWebComparison(leftPath, rightPath, options);
      }

      // Hash left files
      let count = 0;
      for (const [relPath, file] of browserFolderStore.leftFiles.entries()) {
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

      // Hash right files
      count = 0;
      for (const [relPath, file] of browserFolderStore.rightFiles.entries()) {
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

      // 5. Fallback lookup by relative segment
      if (!stored) {
        for (const [key, f] of browserFolderStore.singleFiles.entries()) {
          if (filePath.endsWith(key) || key.endsWith(filePath)) {
            stored = f;
            break;
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
      // In browser, trigger a download of the modified file
      const blob = new Blob([request.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = request.filePath.split('/').pop() || 'file.txt';
      a.click();
      URL.revokeObjectURL(url);

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

    compareStructured: async (request: StructuredDiffRequest) => {
      return compareStructuredData(request);
    },

    openInSystemExplorer: async () => true,
    getAppVersion: async () => '1.0.0 (Web Preview)',
    getPlatform: async () => 'browser',
  };
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
