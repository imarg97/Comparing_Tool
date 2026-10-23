/**
 * DiffX — Professional Desktop Comparison Suite
 * Shared Types & IPC Definitions
 */

export type EntryStatus = 'identical' | 'modified' | 'left-only' | 'right-only' | 'error';

export interface FileMetadata {
  exists: boolean;
  size: number;
  mtime: number;
  hash?: string;
  isDirectory: boolean;
  isSymlink: boolean;
  symlinkTarget?: string;
  error?: string;
  readable: boolean;
}

export interface ComparisonEntry {
  relativePath: string;
  name: string;
  isDirectory: boolean;
  status: EntryStatus;
  mtimeDiff: boolean;
  sizeDiff: boolean;
  left: FileMetadata;
  right: FileMetadata;
  children?: ComparisonEntry[];
}

export interface ComparisonSummary {
  total: number;
  identical: number;
  modified: number;
  leftOnly: number;
  rightOnly: number;
  error: number;
  totalBytesLeft: number;
  totalBytesRight: number;
  scanDurationMs: number;
}

export interface FolderComparisonOptions {
  ignorePatterns: string[];
  caseSensitive: boolean;
  followSymlinks: boolean;
  compareContentStrategy: 'hash' | 'quick-size-mtime';
}

export interface FolderComparisonResult {
  leftRoot: string;
  rightRoot: string;
  options: FolderComparisonOptions;
  summary: ComparisonSummary;
  tree: ComparisonEntry[];
  flatList: ComparisonEntry[];
  timestamp: number;
}

export interface ScanProgress {
  currentPath: string;
  scannedCount: number;
  phase: 'scanning-left' | 'scanning-right' | 'comparing' | 'complete';
}

export interface FileContentResult {
  path: string;
  content: string;
  encoding: string;
  size: number;
  mtime: number;
  isTruncated: boolean;
  hash: string;
  error?: string;
}

export interface TextCompareOptions {
  ignoreWhitespace: 'none' | 'trim' | 'all';
  ignoreBlankLines: boolean;
  ignoreCase: boolean;
}

export interface CopyRequest {
  sourcePath: string;
  destinationPath: string;
  overwrite: boolean;
  createBackup: boolean;
}

export interface CopyResult {
  success: boolean;
  sourcePath: string;
  destinationPath: string;
  backupPath?: string;
  error?: string;
}

export interface SaveRequest {
  filePath: string;
  content: string;
  createBackup?: boolean;
}

export interface SaveResult {
  success: boolean;
  filePath: string;
  bytesWritten: number;
  backupPath?: string;
  error?: string;
}

export type StructuredFormat = 'yaml' | 'json' | 'xml';

export interface StructuredDiffRequest {
  leftContent: string;
  rightContent: string;
  format: StructuredFormat;
  ignoreKeys: string[];
  filterKubernetesNoise: boolean;
}

export interface StructuredDiffItem {
  keyPath: string;
  status: 'added' | 'removed' | 'modified';
  leftValue: unknown;
  rightValue: unknown;
  message: string;
}

export interface StructuredDiffResult {
  identical: boolean;
  items: StructuredDiffItem[];
  cleanLeft: string;
  cleanRight: string;
  parseError?: string;
}

export interface RecentComparison {
  id: string;
  type: 'folder' | 'text' | 'structured';
  leftPath: string;
  rightPath: string;
  timestamp: number;
  label?: string;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  defaultIgnorePatterns: string[];
  caseSensitive: boolean;
  confirmDestructiveActions: boolean;
  createBackups: boolean;
  enableHistory: boolean;
}

/**
 * Narrow, typed IPC contract exposed securely to the Electron renderer
 */
export interface DiffxPreloadAPI {
  // Dialogs
  selectDirectory: (defaultPath?: string, side?: 'left' | 'right') => Promise<string | null>;
  selectFile: (defaultPath?: string, side?: 'left' | 'right') => Promise<string | null>;
  showConfirmDialog: (options: { title: string; message: string; detail?: string; type?: 'info' | 'warning' | 'question' }) => Promise<boolean>;

  // Folder Compare
  compareFolders: (leftPath: string, rightPath: string, options: FolderComparisonOptions) => Promise<FolderComparisonResult>;
  cancelFolderComparison: () => Promise<void>;
  onScanProgress: (callback: (progress: ScanProgress) => void) => () => void;

  // Text / File Operations
  readFile: (filePath: string, maxBytes?: number, side?: 'left' | 'right') => Promise<FileContentResult>;
  saveFile: (request: SaveRequest) => Promise<SaveResult>;
  copyFile: (request: CopyRequest) => Promise<CopyResult>;

  // Structured Compare
  compareStructured: (request: StructuredDiffRequest) => Promise<StructuredDiffResult>;

  // System
  openInSystemExplorer: (targetPath: string) => Promise<boolean>;
  getAppVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
}

declare global {
  interface Window {
    diffxAPI?: DiffxPreloadAPI;
  }
}
