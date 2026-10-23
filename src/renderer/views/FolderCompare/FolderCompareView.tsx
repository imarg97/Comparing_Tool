import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  ArrowLeftRight,
  Play,
  Square,
  Search,
  Filter,
  SlidersHorizontal,
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  AlertCircle,
  Copy,
  RefreshCw,
  FolderTree as FolderTreeIcon,
  List as ListIcon,
  FileCode,
} from 'lucide-react';
import {
  ComparisonEntry,
  EntryStatus,
  FolderComparisonOptions,
  FolderComparisonResult,
  ScanProgress,
} from '@shared/types.js';
import {
  filterFlatList,
  filterTree,
  FilterOptions,
  sortEntries,
  SortOptions,
  StatusFilter,
} from '@shared/comparison-engine/filter-sort.js';
import { ConfirmModalConfig } from '../../components/ConfirmModal.js';

interface FolderCompareViewProps {
  leftFolder: string;
  rightFolder: string;
  onSetLeftFolder: (path: string) => void;
  onSetRightFolder: (path: string) => void;
  onOpenInTextCompare: (leftFile: string, rightFile: string) => void;
  onRequestConfirm: (config: ConfirmModalConfig) => void;
  onUpdateStatus: (text: string, count?: number, durationMs?: number) => void;
}

export const FolderCompareView: React.FC<FolderCompareViewProps> = ({
  leftFolder,
  rightFolder,
  onSetLeftFolder,
  onSetRightFolder,
  onOpenInTextCompare,
  onRequestConfirm,
  onUpdateStatus,
}) => {
  // Options state
  const [options, setOptions] = useState<FolderComparisonOptions>({
    ignorePatterns: ['.git', 'node_modules', '.DS_Store', '*.log', 'dist'],
    caseSensitive: true,
    followSymlinks: false,
    compareContentStrategy: 'hash',
  });
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [ignorePatternsInput, setIgnorePatternsInput] = useState(
    options.ignorePatterns.join(', ')
  );

  // Scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [result, setResult] = useState<FolderComparisonResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // View presentation state
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [extensionFilter, setExtensionFilter] = useState('');
  const [sortOptions, setSortOptions] = useState<SortOptions>({
    field: 'name',
    order: 'asc',
  });
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedEntry, setSelectedEntry] = useState<ComparisonEntry | null>(null);

  // Listen for scan progress from IPC
  useEffect(() => {
    if (window.diffxAPI) {
      const unsubscribe = window.diffxAPI.onScanProgress((prog) => {
        setScanProgress(prog);
      });
      return () => unsubscribe();
    }
  }, []);

  const handlePickLeft = async () => {
    if (window.diffxAPI) {
      const selected = await window.diffxAPI.selectDirectory(leftFolder);
      if (selected) onSetLeftFolder(selected);
    }
  };

  const handlePickRight = async () => {
    if (window.diffxAPI) {
      const selected = await window.diffxAPI.selectDirectory(rightFolder);
      if (selected) onSetRightFolder(selected);
    }
  };

  const handleSwap = () => {
    const temp = leftFolder;
    onSetLeftFolder(rightFolder);
    onSetRightFolder(temp);
  };

  const handleStartCompare = async () => {
    if (!leftFolder || !rightFolder) {
      setScanError('Please select both Left and Right directories to compare.');
      return;
    }

    setScanError(null);
    setIsScanning(true);
    setScanProgress({ currentPath: 'Starting scanner...', scannedCount: 0, phase: 'scanning-left' });
    onUpdateStatus('Comparing directory trees...');

    try {
      if (window.diffxAPI) {
        const res = await window.diffxAPI.compareFolders(leftFolder, rightFolder, options);
        setResult(res);
        // Expand root directories initially
        const initialExpanded = new Set<string>();
        for (const root of res.tree) {
          if (root.isDirectory) initialExpanded.add(root.relativePath);
        }
        setExpandedFolders(initialExpanded);
        onUpdateStatus('Comparison complete', res.summary.total, res.summary.scanDurationMs);
      } else {
        // Fallback preview data when running in browser test harness
        setScanError('Native filesystem API not available in browser mode.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setScanError(`Comparison failed: ${msg}`);
      onUpdateStatus('Comparison failed');
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  };

  const handleCancelCompare = async () => {
    if (window.diffxAPI) {
      await window.diffxAPI.cancelFolderComparison();
      setIsScanning(false);
      setScanProgress(null);
      onUpdateStatus('Scan cancelled by user');
    }
  };

  const toggleFolder = (relPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(relPath)) next.delete(relPath);
      else next.add(relPath);
      return next;
    });
  };

  const expandAll = () => {
    if (!result) return;
    const allDirs = new Set<string>();
    for (const item of result.flatList) {
      if (item.isDirectory) allDirs.add(item.relativePath);
    }
    setExpandedFolders(allDirs);
  };

  const collapseAll = () => {
    setExpandedFolders(new Set());
  };

  // Filter & Sort
  const filterOptions: FilterOptions = {
    status: statusFilter,
    searchQuery,
    extensionFilter,
  };

  const displayedFlatList = result
    ? sortEntries(filterFlatList(result.flatList, filterOptions), sortOptions)
    : [];

  const displayedTree = result ? filterTree(result.tree, filterOptions) : [];

  // Helper formatting
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const toggleSort = (field: 'name' | 'status' | 'size' | 'mtime') => {
    setSortOptions((prev) => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getStatusBadge = (status: EntryStatus, mtimeDiff: boolean) => {
    switch (status) {
      case 'identical':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
            Identical
          </span>
        );
      case 'modified':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-950/60 text-amber-300 border border-amber-800/80">
            Modified {mtimeDiff ? '• time diff' : ''}
          </span>
        );
      case 'left-only':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-950/60 text-blue-300 border border-blue-800/80">
            Left Only
          </span>
        );
      case 'right-only':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-950/60 text-purple-300 border border-purple-800/80">
            Right Only
          </span>
        );
      case 'error':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-950/60 text-rose-300 border border-rose-800/80">
            Error
          </span>
        );
    }
  };

  const handleCopyLeftToRight = (entry: ComparisonEntry) => {
    if (!result) return;
    const src = `${result.leftRoot}/${entry.relativePath}`;
    const dest = `${result.rightRoot}/${entry.relativePath}`;

    onRequestConfirm({
      isOpen: true,
      title: 'Copy File Left to Right',
      actionType: 'copy-l2r',
      sourcePath: src,
      destinationPath: dest,
      isDestinationExisting: entry.right.exists,
      message: `Are you sure you want to copy '${entry.name}' to the right directory?`,
      detail: entry.right.exists
        ? 'The existing right-side file will be replaced with this version.'
        : 'A new file will be created in the right-side directory structure.',
      onConfirm: async ({ createBackup }) => {
        if (window.diffxAPI) {
          const copyRes = await window.diffxAPI.copyFile({
            sourcePath: src,
            destinationPath: dest,
            overwrite: true,
            createBackup,
          });
          if (copyRes.success) {
            handleStartCompare(); // Refresh
          } else {
            setScanError(`Copy failed: ${copyRes.error}`);
          }
        }
      },
      onCancel: () => {},
    });
  };

  const handleCopyRightToLeft = (entry: ComparisonEntry) => {
    if (!result) return;
    const src = `${result.rightRoot}/${entry.relativePath}`;
    const dest = `${result.leftRoot}/${entry.relativePath}`;

    onRequestConfirm({
      isOpen: true,
      title: 'Copy File Right to Left',
      actionType: 'copy-r2l',
      sourcePath: src,
      destinationPath: dest,
      isDestinationExisting: entry.left.exists,
      message: `Are you sure you want to copy '${entry.name}' to the left directory?`,
      detail: entry.left.exists
        ? 'The existing left-side file will be replaced with this version.'
        : 'A new file will be created in the left-side directory structure.',
      onConfirm: async ({ createBackup }) => {
        if (window.diffxAPI) {
          const copyRes = await window.diffxAPI.copyFile({
            sourcePath: src,
            destinationPath: dest,
            overwrite: true,
            createBackup,
          });
          if (copyRes.success) {
            handleStartCompare(); // Refresh
          } else {
            setScanError(`Copy failed: ${copyRes.error}`);
          }
        }
      },
      onCancel: () => {},
    });
  };

  // Render tree node recursively
  const renderTreeNode = (node: ComparisonEntry, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.relativePath);
    const isSelected = selectedEntry?.relativePath === node.relativePath;

    return (
      <React.Fragment key={node.relativePath}>
        <div
          onClick={() => setSelectedEntry(node)}
          onDoubleClick={() => {
            if (node.isDirectory) {
              toggleFolder(node.relativePath);
            } else if (result) {
              onOpenInTextCompare(
                `${result.leftRoot}/${node.relativePath}`,
                `${result.rightRoot}/${node.relativePath}`
              );
            }
          }}
          className={`group flex items-center h-7 text-xs border-b border-slate-900/60 select-none cursor-pointer hover:bg-slate-800/60 ${
            isSelected ? 'bg-blue-950/40 border-l-2 border-l-blue-500' : ''
          }`}
          style={{ paddingLeft: `${depth * 18 + 8}px` }}
        >
          {/* Expand / Collapse or File Icon */}
          <div className="w-5 flex-shrink-0 flex items-center">
            {node.isDirectory ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFolder(node.relativePath);
                }}
                className="text-slate-400 hover:text-slate-200"
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <span className="w-3.5" />
            )}
          </div>

          <div className="w-5 flex-shrink-0 text-slate-400 mr-1.5">
            {node.isDirectory ? (
              <Folder className={`w-3.5 h-3.5 ${isExpanded ? 'text-amber-400' : 'text-slate-400'}`} />
            ) : (
              <File className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>

          {/* Name & Relative Path */}
          <div className="flex-1 min-w-0 pr-2 flex items-center space-x-2">
            <span
              className={`truncate font-mono ${
                node.status === 'modified'
                  ? 'text-amber-300 font-medium'
                  : node.status === 'left-only'
                  ? 'text-blue-300'
                  : node.status === 'right-only'
                  ? 'text-purple-300'
                  : node.status === 'error'
                  ? 'text-rose-400'
                  : 'text-slate-300'
              }`}
            >
              {node.name}
            </span>
            {node.left.isSymlink && (
              <span className="text-[10px] text-slate-500 font-mono">(symlink)</span>
            )}
          </div>

          {/* Status Badge */}
          <div className="w-28 flex-shrink-0">
            {getStatusBadge(node.status, node.mtimeDiff)}
          </div>

          {/* Left Size & Mtime */}
          <div className="w-24 text-right pr-3 font-mono text-[11px] text-slate-400 flex-shrink-0">
            {node.left.exists ? (node.isDirectory ? 'dir' : formatBytes(node.left.size)) : '-'}
          </div>

          {/* Right Size & Mtime */}
          <div className="w-24 text-right pr-3 font-mono text-[11px] text-slate-400 flex-shrink-0">
            {node.right.exists ? (node.isDirectory ? 'dir' : formatBytes(node.right.size)) : '-'}
          </div>

          {/* Actions on hover */}
          <div className="w-24 flex items-center justify-end space-x-1 pr-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            {!node.isDirectory && (
              <>
                <button
                  title="Open in Text Compare"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (result) {
                      onOpenInTextCompare(
                        `${result.leftRoot}/${node.relativePath}`,
                        `${result.rightRoot}/${node.relativePath}`
                      );
                    }
                  }}
                  className="p-1 rounded hover:bg-slate-700 text-slate-300"
                >
                  <FileCode className="w-3.5 h-3.5" />
                </button>
                <button
                  title="Copy Left to Right"
                  disabled={!node.left.exists}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyLeftToRight(node);
                  }}
                  className="p-1 rounded hover:bg-slate-700 text-blue-400 disabled:opacity-30"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  title="Copy Right to Left"
                  disabled={!node.right.exists}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyRightToLeft(node);
                  }}
                  className="p-1 rounded hover:bg-slate-700 text-purple-400 disabled:opacity-30"
                >
                  <Copy className="w-3.5 h-3.5 rotate-180" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Children if expanded */}
        {node.isDirectory && isExpanded && node.children && (
          <div>
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden text-slate-200">
      {/* 1. Directory Selection Bar */}
      <div className="bg-slate-900 border-b border-slate-800 p-2.5 flex items-center space-x-2 flex-shrink-0">
        {/* Left Directory */}
        <div className="flex-1 flex items-center bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 focus-within:border-blue-500 transition">
          <FolderOpen className="w-4 h-4 text-blue-400 mr-2 flex-shrink-0" />
          <input
            type="text"
            value={leftFolder}
            onChange={(e) => onSetLeftFolder(e.target.value)}
            placeholder="Select Left Directory..."
            className="bg-transparent text-xs w-full focus:outline-none font-mono text-slate-200 placeholder-slate-500"
          />
          <button
            onClick={handlePickLeft}
            className="ml-1.5 text-xs px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-sans border border-slate-700 transition"
          >
            Browse
          </button>
        </div>

        {/* Swap Button */}
        <button
          onClick={handleSwap}
          title="Swap Left and Right Directories (Cmd+Alt+S)"
          className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex-shrink-0"
        >
          <ArrowLeftRight className="w-4 h-4" />
        </button>

        {/* Right Directory */}
        <div className="flex-1 flex items-center bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 focus-within:border-blue-500 transition">
          <FolderOpen className="w-4 h-4 text-purple-400 mr-2 flex-shrink-0" />
          <input
            type="text"
            value={rightFolder}
            onChange={(e) => onSetRightFolder(e.target.value)}
            placeholder="Select Right Directory..."
            className="bg-transparent text-xs w-full focus:outline-none font-mono text-slate-200 placeholder-slate-500"
          />
          <button
            onClick={handlePickRight}
            className="ml-1.5 text-xs px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-sans border border-slate-700 transition"
          >
            Browse
          </button>
        </div>

        {/* Compare / Cancel Button */}
        {isScanning ? (
          <button
            onClick={handleCancelCompare}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs shadow transition flex-shrink-0"
          >
            <Square className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>
        ) : (
          <button
            onClick={handleStartCompare}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow transition flex-shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Compare</span>
          </button>
        )}

        {/* Options Button */}
        <button
          onClick={() => setShowOptionsModal(true)}
          title="Comparison Rules & Ignore Patterns"
          className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex-shrink-0"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Active Scan Progress or Summary Banner */}
      {isScanning && scanProgress && (
        <div className="bg-blue-950/40 border-b border-blue-900/60 px-3 py-1.5 text-xs flex items-center justify-between animate-pulse">
          <div className="flex items-center space-x-2 text-blue-300">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span className="font-medium uppercase text-[10px] tracking-wider text-blue-400">
              {scanProgress.phase}:
            </span>
            <span className="font-mono text-slate-300 truncate max-w-xl">
              {scanProgress.currentPath || 'Analyzing...'}
            </span>
          </div>
          <span className="font-mono text-slate-400">
            {scanProgress.scannedCount} items scanned
          </span>
        </div>
      )}

      {scanError && (
        <div className="bg-rose-950/60 border-b border-rose-900/80 px-3 py-2 text-xs flex items-center justify-between text-rose-200">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{scanError}</span>
          </div>
          <button
            onClick={() => setScanError(null)}
            className="text-[10px] uppercase font-bold text-rose-400 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {result && !isScanning && (
        <div className="bg-slate-900/90 border-b border-slate-800 px-3 py-1.5 flex items-center justify-between text-xs flex-shrink-0">
          {/* Summary counters */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 text-[11px]">Results:</span>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                statusFilter === 'all'
                  ? 'bg-slate-700 text-white font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              All: {result.summary.total}
            </button>
            <button
              onClick={() => setStatusFilter('modified')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                statusFilter === 'modified'
                  ? 'bg-amber-900/80 text-amber-200 font-bold border border-amber-600'
                  : 'bg-amber-950/30 text-amber-400 border border-amber-900/40'
              }`}
            >
              Modified: {result.summary.modified}
            </button>
            <button
              onClick={() => setStatusFilter('left-only')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                statusFilter === 'left-only'
                  ? 'bg-blue-900/80 text-blue-200 font-bold border border-blue-600'
                  : 'bg-blue-950/30 text-blue-400 border border-blue-900/40'
              }`}
            >
              Left Only: {result.summary.leftOnly}
            </button>
            <button
              onClick={() => setStatusFilter('right-only')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                statusFilter === 'right-only'
                  ? 'bg-purple-900/80 text-purple-200 font-bold border border-purple-600'
                  : 'bg-purple-950/30 text-purple-400 border border-purple-900/40'
              }`}
            >
              Right Only: {result.summary.rightOnly}
            </button>
            <button
              onClick={() => setStatusFilter('identical')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                statusFilter === 'identical'
                  ? 'bg-slate-700 text-slate-200 font-bold'
                  : 'bg-slate-800/40 text-slate-400'
              }`}
            >
              Identical: {result.summary.identical}
            </button>
            {result.summary.error > 0 && (
              <button
                onClick={() => setStatusFilter('error')}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                  statusFilter === 'error'
                    ? 'bg-rose-900 text-rose-200 font-bold border border-rose-500'
                    : 'bg-rose-950/40 text-rose-400 border border-rose-900'
                }`}
              >
                Errors: {result.summary.error}
              </button>
            )}
          </div>

          <div className="text-[11px] font-mono text-slate-500">
            Scan duration: {result.summary.scanDurationMs}ms • Left: {formatBytes(result.summary.totalBytesLeft)} • Right: {formatBytes(result.summary.totalBytesRight)}
          </div>
        </div>
      )}

      {/* 3. Toolbar Controls (Search, Filter, View Mode, Tree expansion) */}
      <div className="bg-slate-900 border-b border-slate-800 px-3 py-1.5 flex items-center justify-between text-xs flex-shrink-0">
        <div className="flex items-center space-x-2">
          {/* Search Box */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded px-2 py-1 w-52 focus-within:border-blue-500 transition">
            <Search className="w-3.5 h-3.5 text-slate-500 mr-1.5 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by filename or path..."
              className="bg-transparent text-xs w-full focus:outline-none text-slate-200 placeholder-slate-500"
            />
          </div>

          {/* Extension Filter */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded px-2 py-1 w-28 focus-within:border-blue-500 transition">
            <Filter className="w-3 h-3 text-slate-500 mr-1 flex-shrink-0" />
            <input
              type="text"
              value={extensionFilter}
              onChange={(e) => setExtensionFilter(e.target.value)}
              placeholder="e.g. .yaml"
              className="bg-transparent text-xs w-full focus:outline-none text-slate-200 placeholder-slate-500 font-mono"
            />
          </div>

          {/* View mode toggle */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded p-0.5">
            <button
              onClick={() => setViewMode('tree')}
              title="Tree View"
              className={`p-1 rounded text-xs transition ${
                viewMode === 'tree' ? 'bg-slate-800 text-blue-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderTreeIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="Flat File List"
              className={`p-1 rounded text-xs transition ${
                viewMode === 'list' ? 'bg-slate-800 text-blue-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {viewMode === 'tree' && (
            <div className="flex items-center space-x-1 pl-1">
              <button
                onClick={expandAll}
                className="text-[11px] px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="text-[11px] px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700"
              >
                Collapse All
              </button>
            </div>
          )}
        </div>

        {/* Quick actions for selected entry */}
        {selectedEntry && !selectedEntry.isDirectory && result && (
          <div className="flex items-center space-x-2 animate-in fade-in">
            <span className="text-slate-400 font-mono text-[11px] truncate max-w-xs">
              Selected: <strong className="text-slate-200">{selectedEntry.name}</strong>
            </span>
            <button
              onClick={() =>
                onOpenInTextCompare(
                  `${result.leftRoot}/${selectedEntry.relativePath}`,
                  `${result.rightRoot}/${selectedEntry.relativePath}`
                )
              }
              className="flex items-center space-x-1 text-xs px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium shadow"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Compare in Text Editor</span>
            </button>
          </div>
        )}
      </div>

      {/* 4. Comparison Workspace (Tree or List View) */}
      <div className="flex-1 flex flex-col min-h-0 bg-slate-950 overflow-hidden">
        {/* Table Column Headers */}
        <div className="bg-slate-900/60 border-b border-slate-800 px-3 py-1 flex items-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex-shrink-0 select-none">
          <div
            onClick={() => toggleSort('name')}
            className="flex-1 cursor-pointer hover:text-slate-200 transition"
          >
            Name & Relative Path {sortOptions.field === 'name' ? (sortOptions.order === 'asc' ? '▲' : '▼') : ''}
          </div>
          <div
            onClick={() => toggleSort('status')}
            className="w-28 cursor-pointer hover:text-slate-200 transition"
          >
            Status {sortOptions.field === 'status' ? (sortOptions.order === 'asc' ? '▲' : '▼') : ''}
          </div>
          <div
            onClick={() => toggleSort('size')}
            className="w-24 text-right pr-3 cursor-pointer hover:text-slate-200 transition"
          >
            Left Size {sortOptions.field === 'size' ? (sortOptions.order === 'asc' ? '▲' : '▼') : ''}
          </div>
          <div
            onClick={() => toggleSort('size')}
            className="w-24 text-right pr-3 cursor-pointer hover:text-slate-200 transition"
          >
            Right Size
          </div>
          <div className="w-24 text-right pr-2">Actions</div>
        </div>

        {/* Entries Container */}
        <div className="flex-1 overflow-y-auto">
          {!result && !isScanning && (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center">
              <FolderTreeIcon className="w-12 h-12 text-slate-600 mb-3 stroke-[1.2]" />
              <h4 className="text-base font-semibold text-slate-300 mb-1">
                No Folder Comparison Loaded
              </h4>
              <p className="text-xs max-w-md text-slate-400 mb-4">
                Choose Left and Right directories above and click <strong>Compare</strong> to recursively analyze differences, modifications, and orphan files.
              </p>
            </div>
          )}

          {result && viewMode === 'tree' && (
            <div className="py-1">
              {displayedTree.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No items match the current filters.
                </div>
              ) : (
                displayedTree.map((rootNode) => renderTreeNode(rootNode))
              )}
            </div>
          )}

          {result && viewMode === 'list' && (
            <div className="divide-y divide-slate-900/60">
              {displayedFlatList.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No items match the current filters.
                </div>
              ) : (
                displayedFlatList.map((entry) => {
                  const isSelected = selectedEntry?.relativePath === entry.relativePath;
                  return (
                    <div
                      key={entry.relativePath}
                      onClick={() => setSelectedEntry(entry)}
                      onDoubleClick={() => {
                        if (!entry.isDirectory && result) {
                          onOpenInTextCompare(
                            `${result.leftRoot}/${entry.relativePath}`,
                            `${result.rightRoot}/${entry.relativePath}`
                          );
                        }
                      }}
                      className={`group flex items-center h-7 px-3 text-xs select-none cursor-pointer hover:bg-slate-800/60 ${
                        isSelected ? 'bg-blue-950/40 border-l-2 border-l-blue-500' : ''
                      }`}
                    >
                      <div className="w-5 flex-shrink-0 text-slate-400 mr-2">
                        {entry.isDirectory ? (
                          <Folder className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <File className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 pr-2 flex items-center space-x-2">
                        <span
                          className={`truncate font-mono ${
                            entry.status === 'modified'
                              ? 'text-amber-300 font-medium'
                              : entry.status === 'left-only'
                              ? 'text-blue-300'
                              : entry.status === 'right-only'
                              ? 'text-purple-300'
                              : entry.status === 'error'
                              ? 'text-rose-400'
                              : 'text-slate-300'
                          }`}
                        >
                          {entry.relativePath}
                        </span>
                      </div>

                      <div className="w-28 flex-shrink-0">
                        {getStatusBadge(entry.status, entry.mtimeDiff)}
                      </div>

                      <div className="w-24 text-right pr-3 font-mono text-[11px] text-slate-400 flex-shrink-0">
                        {entry.left.exists ? (entry.isDirectory ? 'dir' : formatBytes(entry.left.size)) : '-'}
                      </div>

                      <div className="w-24 text-right pr-3 font-mono text-[11px] text-slate-400 flex-shrink-0">
                        {entry.right.exists ? (entry.isDirectory ? 'dir' : formatBytes(entry.right.size)) : '-'}
                      </div>

                      <div className="w-24 flex items-center justify-end space-x-1 pr-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        {!entry.isDirectory && (
                          <>
                            <button
                              title="Open in Text Compare"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (result) {
                                  onOpenInTextCompare(
                                    `${result.leftRoot}/${entry.relativePath}`,
                                    `${result.rightRoot}/${entry.relativePath}`
                                  );
                                }
                              }}
                              className="p-1 rounded hover:bg-slate-700 text-slate-300"
                            >
                              <FileCode className="w-3.5 h-3.5" />
                            </button>
                            <button
                              title="Copy Left to Right"
                              disabled={!entry.left.exists}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyLeftToRight(entry);
                              }}
                              className="p-1 rounded hover:bg-slate-700 text-blue-400 disabled:opacity-30"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              title="Copy Right to Left"
                              disabled={!entry.right.exists}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyRightToLeft(entry);
                              }}
                              className="p-1 rounded hover:bg-slate-700 text-purple-400 disabled:opacity-30"
                            >
                              <Copy className="w-3.5 h-3.5 rotate-180" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* 5. Options & Ignore Rules Modal */}
      {showOptionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-slate-800 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-slate-100 flex items-center space-x-2">
                <SlidersHorizontal className="w-4 h-4 text-blue-400" />
                <span>Folder Comparison Rules</span>
              </h3>
              <button
                onClick={() => setShowOptionsModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4 text-xs">
              {/* Ignore Patterns */}
              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Ignore Patterns (comma-separated globs / folder names):
                </label>
                <input
                  type="text"
                  value={ignorePatternsInput}
                  onChange={(e) => setIgnorePatternsInput(e.target.value)}
                  placeholder=".git, node_modules, .DS_Store, *.log"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-blue-500"
                />
                <span className="text-[11px] text-slate-500 block mt-1">
                  Wildcards like *.log and directory names are ignored recursively.
                </span>
              </div>

              {/* Comparison Strategy */}
              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Content Comparison Strategy:
                </label>
                <div className="space-y-1.5">
                  <label className="flex items-center space-x-2 cursor-pointer text-slate-300">
                    <input
                      type="radio"
                      name="strategy"
                      checked={options.compareContentStrategy === 'hash'}
                      onChange={() =>
                        setOptions((prev) => ({ ...prev, compareContentStrategy: 'hash' }))
                      }
                      className="text-blue-600"
                    />
                    <span>
                      <strong>Cryptographic Content Hash (SHA-256)</strong> — Recommended for absolute content identity verification.
                    </span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer text-slate-300">
                    <input
                      type="radio"
                      name="strategy"
                      checked={options.compareContentStrategy === 'quick-size-mtime'}
                      onChange={() =>
                        setOptions((prev) => ({ ...prev, compareContentStrategy: 'quick-size-mtime' }))
                      }
                      className="text-blue-600"
                    />
                    <span>
                      <strong>Quick Size & Timestamp Only</strong> — Faster on massive remote drives, but does not verify byte contents.
                    </span>
                  </label>
                </div>
              </div>

              {/* Case Sensitivity */}
              <label className="flex items-center space-x-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={options.caseSensitive}
                  onChange={(e) =>
                    setOptions((prev) => ({ ...prev, caseSensitive: e.target.checked }))
                  }
                  className="rounded border-slate-700 bg-slate-800 text-blue-600"
                />
                <span>Case-sensitive filename matching</span>
              </label>

              {/* Follow Symlinks */}
              <label className="flex items-center space-x-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={options.followSymlinks}
                  onChange={(e) =>
                    setOptions((prev) => ({ ...prev, followSymlinks: e.target.checked }))
                  }
                  className="rounded border-slate-700 bg-slate-800 text-blue-600"
                />
                <span>Follow directory symlinks (Disabled by default to prevent cycles)</span>
              </label>
            </div>

            <div className="bg-slate-800/40 px-4 py-2.5 border-t border-slate-800 flex justify-end space-x-2">
              <button
                onClick={() => setShowOptionsModal(false)}
                className="px-3 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const cleaned = ignorePatternsInput
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                  setOptions((prev) => ({ ...prev, ignorePatterns: cleaned }));
                  setShowOptionsModal(false);
                }}
                className="px-4 py-1 rounded text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium shadow"
              >
                Apply & Save Rules
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
