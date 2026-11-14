import React, { useState, useEffect, useRef } from 'react';
import {
  FolderOpen,
  ArrowLeftRight,
  RefreshCw,
  Folder,
  File,
  SlidersHorizontal,
  ChevronRight,
  ChevronDown,
  ArrowUp,
  Search,
  Equal,
  ChevronLeft,
  Home,
  AlertCircle,
  Trash2,
  X,
} from 'lucide-react';
import {
  ComparisonEntry,
  FolderComparisonOptions,
  FolderComparisonResult,
  ScanProgress,
} from '@shared/types.js';
import {
  filterTree,
  FilterOptions,
  SortOptions,
  StatusFilter,
} from '@shared/comparison-engine/filter-sort.js';
import { ConfirmModalConfig } from '../../components/ConfirmModal.js';
import { NavigationTab } from '../../components/Header.js';

interface FolderCompareViewProps {
  leftFolder: string;
  rightFolder: string;
  onSetLeftFolder: (path: string) => void;
  onSetRightFolder: (path: string) => void;
  onOpenInTextCompare: (leftFile: string, rightFile: string) => void;
  onNavigateHome?: () => void;
  onRequestConfirm: (config: ConfirmModalConfig) => void;
  onUpdateStatus: (text: string, count?: number, durationMs?: number) => void;
  isWeb?: boolean;
  onNavigateTab?: (tab: NavigationTab) => void;
  onShowWebNotice?: () => void;
  zoomLevel?: number;
  onSetZoomLevel?: (zoom: number | ((prev: number) => number)) => void;
}

export const FolderCompareView: React.FC<FolderCompareViewProps> = ({
  leftFolder,
  rightFolder,
  onSetLeftFolder,
  onSetRightFolder,
  onOpenInTextCompare,
  onNavigateHome,
  onRequestConfirm,
  onUpdateStatus,
  isWeb = false,
  onNavigateTab,
  onShowWebNotice,
  zoomLevel = 100,
  onSetZoomLevel,
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

  // Beyond Compare View Filters:
  // 'all' = Show All
  // 'different' = Show Differences
  // 'identical' = Show Same
  // 'left-only' = Show Left Orphans
  // 'right-only' = Show Right Orphans
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOptions, setSortOptions] = useState<SortOptions>({
    field: 'name',
    order: 'asc',
  });
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedEntry, setSelectedEntry] = useState<ComparisonEntry | null>(null);

  // Individual left and right file selections for cross-name / orphan comparison
  const [selectedLeftFile, setSelectedLeftFile] = useState<{
    relativePath: string;
    name: string;
  } | null>(null);
  const [selectedRightFile, setSelectedRightFile] = useState<{
    relativePath: string;
    name: string;
  } | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: ComparisonEntry;
    side?: 'left' | 'right';
    leftFile?: { relativePath: string; name: string } | null;
    rightFile?: { relativePath: string; name: string } | null;
  } | null>(null);

  // Zoom calculation
  const currentZoom = zoomLevel ?? 100;
  const rowHeight = Math.max(20, Math.round((24 * currentZoom) / 100));
  const fontSizePx = ((12 * currentZoom) / 100).toFixed(1);

  // Helper: check if a directory has any modified or orphan descendant
  const hasDiffDescendant = (entry: ComparisonEntry): boolean => {
    if (entry.status === 'modified' || entry.status === 'left-only' || entry.status === 'right-only') {
      return true;
    }
    if (entry.children && entry.children.length > 0) {
      return entry.children.some(hasDiffDescendant);
    }
    return false;
  };

  // Close context menu on outside click or Escape, and Enter key to compare selected pair
  useEffect(() => {
    const handleOutsideClick = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
      if (e.key === 'Enter') {
        if (selectedLeftFile && selectedRightFile && result) {
          e.preventDefault();
          onOpenInTextCompare(
            `${result.leftRoot}/${selectedLeftFile.relativePath}`,
            `${result.rightRoot}/${selectedRightFile.relativePath}`
          );
        }
      }
    };
    window.addEventListener('click', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedLeftFile, selectedRightFile, result]);

  // Drag and drop states across whole page
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const [dragHoverSide, setDragHoverSide] = useState<'left' | 'right' | null>(null);
  const dragCounterRef = useRef(0);

  const extractDroppedPaths = (e: React.DragEvent): string[] => {
    const paths: string[] = [];
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        let p = '';
        if (window.diffxAPI && typeof window.diffxAPI.getPathForFile === 'function') {
          try {
            p = window.diffxAPI.getPathForFile(file);
          } catch {
            // fallback
          }
        }
        if (!p) {
          p = (file as any).path || file.webkitRelativePath || file.name;
        }
        if (p) paths.push(p);
      }
    }
    return paths;
  };

  const handleDropToSide = (paths: string[], targetSide: 'left' | 'right') => {
    if (isWeb) {
      onShowWebNotice?.();
      return;
    }
    if (!paths.length) return;
    if (paths.length >= 2) {
      onSetLeftFolder(paths[0]);
      onSetRightFolder(paths[1]);
      onUpdateStatus(`Loaded Left (${paths[0]}) and Right (${paths[1]})`);
    } else if (targetSide === 'left') {
      onSetLeftFolder(paths[0]);
      onUpdateStatus(`Loaded Left directory: ${paths[0]}`);
    } else {
      onSetRightFolder(paths[0]);
      onUpdateStatus(`Loaded Right directory: ${paths[0]}`);
    }
  };

  const handleDropLeft = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingLeft(false);
    setDragHoverSide(null);
    dragCounterRef.current = 0;
    const paths = extractDroppedPaths(e);
    handleDropToSide(paths, 'left');
  };

  const handleDropRight = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingRight(false);
    setDragHoverSide(null);
    dragCounterRef.current = 0;
    const paths = extractDroppedPaths(e);
    handleDropToSide(paths, 'right');
  };

  const handleContainerDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
  };

  const handleContainerDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const side = e.clientX < midX ? 'left' : 'right';
    setDragHoverSide(side);
  };

  const handleContainerDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setDragHoverSide(null);
    }
  };

  const handleContainerDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const side = dragHoverSide || 'left';
    dragCounterRef.current = 0;
    setDragHoverSide(null);
    const paths = extractDroppedPaths(e);
    handleDropToSide(paths, side);
  };

  // Listen for scan progress from IPC
  useEffect(() => {
    if (window.diffxAPI) {
      const unsubscribe = window.diffxAPI.onScanProgress((prog) => {
        setScanProgress(prog);
      });
      return () => unsubscribe();
    }
  }, []);

  // Automatically start folder comparison whenever both folders are selected
  useEffect(() => {
    if (leftFolder && rightFolder) {
      handleStartCompare();
    }
  }, [leftFolder, rightFolder]);

  const handlePickLeft = async () => {
    if (isWeb) {
      onShowWebNotice?.();
      return;
    }
    if (window.diffxAPI) {
      const selected = await window.diffxAPI.selectDirectory(leftFolder, 'left');
      if (selected) onSetLeftFolder(selected);
    }
  };

  const handlePickRight = async () => {
    if (isWeb) {
      onShowWebNotice?.();
      return;
    }
    if (window.diffxAPI) {
      const selected = await window.diffxAPI.selectDirectory(rightFolder, 'right');
      if (selected) onSetRightFolder(selected);
    }
  };

  const handleUpLeft = () => {
    if (!leftFolder) return;
    const parts = leftFolder.replace(/\\/g, '/').split('/').filter(Boolean);
    if (parts.length > 1) {
      parts.pop();
      onSetLeftFolder('/' + parts.join('/'));
    }
  };

  const handleUpRight = () => {
    if (!rightFolder) return;
    const parts = rightFolder.replace(/\\/g, '/').split('/').filter(Boolean);
    if (parts.length > 1) {
      parts.pop();
      onSetRightFolder('/' + parts.join('/'));
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
    setSelectedLeftFile(null);
    setSelectedRightFile(null);
    setScanProgress({ currentPath: 'Starting scanner...', scannedCount: 0, phase: 'scanning-left' });
    onUpdateStatus('Comparing directory trees...');

    try {
      if (window.diffxAPI) {
        const res = await window.diffxAPI.compareFolders(leftFolder, rightFolder, options);
        setResult(res);
        // Start collapsed by default (Beyond Compare standard behavior)
        setExpandedFolders(new Set());
        onUpdateStatus('Comparison complete', res.summary.total, res.summary.scanDurationMs);
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

  const filterOptions: FilterOptions = {
    status: statusFilter,
    searchQuery,
    extensionFilter: '',
  };

  const displayedTree = result ? filterTree(result.tree, filterOptions) : [];

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (ms: number): string => {
    if (!ms) return '';
    const d = new Date(ms);
    return (
      d.toLocaleDateString([], { year: '2-digit', month: '2-digit', day: '2-digit' }) +
      ' ' +
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  };

  const handleCopyLeftToRight = (entry: ComparisonEntry) => {
    if (!result) return;
    const src = `${result.leftRoot}/${entry.relativePath}`;
    const dest = `${result.rightRoot}/${entry.relativePath}`;

    onRequestConfirm({
      isOpen: true,
      title: 'Copy to Right',
      actionType: 'copy-l2r',
      sourcePath: src,
      destinationPath: dest,
      isDestinationExisting: entry.right.exists,
      message: `Copy '${entry.name}' to the right folder?`,
      detail: entry.right.exists
        ? 'The existing right-side file will be overwritten with the left version.'
        : 'The file will be copied into the right-side folder structure.',
      onConfirm: async ({ createBackup }) => {
        if (window.diffxAPI) {
          const copyRes = await window.diffxAPI.copyFile({
            sourcePath: src,
            destinationPath: dest,
            overwrite: true,
            createBackup,
          });
          if (copyRes.success) {
            handleStartCompare();
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
      title: 'Copy to Left',
      actionType: 'copy-r2l',
      sourcePath: src,
      destinationPath: dest,
      isDestinationExisting: entry.left.exists,
      message: `Copy '${entry.name}' to the left folder?`,
      detail: entry.left.exists
        ? 'The existing left-side file will be overwritten with the right version.'
        : 'The file will be copied into the left-side folder structure.',
      onConfirm: async ({ createBackup }) => {
        if (window.diffxAPI) {
          const copyRes = await window.diffxAPI.copyFile({
            sourcePath: src,
            destinationPath: dest,
            overwrite: true,
            createBackup,
          });
          if (copyRes.success) {
            handleStartCompare();
          } else {
            setScanError(`Copy failed: ${copyRes.error}`);
          }
        }
      },
      onCancel: () => {},
    });
  };

  const handleDeleteEntry = (entry: ComparisonEntry, side: 'left' | 'right' | 'both') => {
    if (!result) return;
    setContextMenu(null);

    const isDir = entry.isDirectory;
    const itemLabel = isDir ? 'Folder' : 'File';
    const leftPath = `${result.leftRoot}/${entry.relativePath}`;
    const rightPath = `${result.rightRoot}/${entry.relativePath}`;

    let title = '';
    let msg = '';
    let detail = '';
    let targetPath = '';

    if (side === 'left') {
      title = `Delete Left ${itemLabel}`;
      msg = `Permanently delete '${entry.name}' from the Left folder?`;
      detail = `Target: ${leftPath}`;
      targetPath = leftPath;
    } else if (side === 'right') {
      title = `Delete Right ${itemLabel}`;
      msg = `Permanently delete '${entry.name}' from the Right folder?`;
      detail = `Target: ${rightPath}`;
      targetPath = rightPath;
    } else {
      title = `Delete ${itemLabel} (Both Sides)`;
      msg = `Permanently delete '${entry.name}' from BOTH Left and Right folders?`;
      detail = `Left: ${leftPath}\nRight: ${rightPath}`;
      targetPath = leftPath;
    }

    onRequestConfirm({
      isOpen: true,
      title,
      actionType: 'delete',
      sourcePath: targetPath,
      message: msg,
      detail: `${detail}\n\nThis will permanently delete the ${itemLabel.toLowerCase()} from disk. A safety backup will be created if enabled.`,
      requireBackupOption: true,
      onConfirm: async ({ createBackup }) => {
        if (!window.diffxAPI?.deleteFile) {
          onUpdateStatus('File deletion is only supported in the native desktop app.');
          return;
        }

        try {
          if (side === 'left' || side === 'both') {
            if (entry.left.exists) {
              const res = await window.diffxAPI.deleteFile({ filePath: leftPath, createBackup });
              if (!res.success) {
                setScanError(`Delete failed on Left: ${res.error}`);
                return;
              }
            }
          }
          if (side === 'right' || side === 'both') {
            if (entry.right.exists) {
              const res = await window.diffxAPI.deleteFile({ filePath: rightPath, createBackup });
              if (!res.success) {
                setScanError(`Delete failed on Right: ${res.error}`);
                return;
              }
            }
          }
          onUpdateStatus(`Deleted '${entry.name}' successfully`);
          handleStartCompare();
        } catch (err: unknown) {
          const m = err instanceof Error ? err.message : String(err);
          setScanError(`Delete error: ${m}`);
        }
      },
      onCancel: () => {},
    });
  };

  // Keyboard shortcuts: Alt+Right / Alt+Left for transferring selected file
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'ArrowRight' && selectedEntry && selectedEntry.left.exists) {
        e.preventDefault();
        handleCopyLeftToRight(selectedEntry);
      } else if (e.altKey && e.key === 'ArrowLeft' && selectedEntry && selectedEntry.right.exists) {
        e.preventDefault();
        handleCopyRightToLeft(selectedEntry);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEntry, result]);

  const toggleSort = (field: 'name' | 'size' | 'mtime') => {
    setSortOptions((prev) => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleCompareSelectedPair = () => {
    if (!result) return;
    if (selectedLeftFile && selectedRightFile) {
      onOpenInTextCompare(
        `${result.leftRoot}/${selectedLeftFile.relativePath}`,
        `${result.rightRoot}/${selectedRightFile.relativePath}`
      );
    } else if (selectedEntry && !selectedEntry.isDirectory) {
      if (selectedEntry.left.exists && selectedEntry.right.exists) {
        onOpenInTextCompare(
          `${result.leftRoot}/${selectedEntry.relativePath}`,
          `${result.rightRoot}/${selectedEntry.relativePath}`
        );
      }
    }
  };

  const handleLeftClick = (e: React.MouseEvent, node: ComparisonEntry) => {
    e.stopPropagation();
    if (node.isDirectory) {
      toggleFolder(node.relativePath);
      return;
    }
    if (!node.left.exists) return;

    if (e.ctrlKey || e.metaKey) {
      if (selectedLeftFile?.relativePath === node.relativePath) {
        setSelectedLeftFile(null);
        onUpdateStatus('Cleared Left file selection.');
        return;
      }
    }

    // Normal click or Ctrl-click: set Left file selection (stays selected)
    setSelectedLeftFile({ relativePath: node.relativePath, name: node.name });
    setSelectedEntry(node);
    if (selectedRightFile) {
      onUpdateStatus(`Selected: "${node.name}" (Left) ↔ "${selectedRightFile.name}" (Right). Right-click or press Enter to compare.`);
    } else {
      onUpdateStatus(`Selected Left file: "${node.name}". Now select or Ctrl-click a file on the Right pane.`);
    }
  };

  const handleRightClick = (e: React.MouseEvent, node: ComparisonEntry) => {
    e.stopPropagation();
    if (node.isDirectory) {
      toggleFolder(node.relativePath);
      return;
    }
    if (!node.right.exists) return;

    if (e.ctrlKey || e.metaKey) {
      if (selectedRightFile?.relativePath === node.relativePath) {
        setSelectedRightFile(null);
        onUpdateStatus('Cleared Right file selection.');
        return;
      }
    }

    // Normal click or Ctrl-click: set Right file selection (leaves Left selection intact)
    setSelectedRightFile({ relativePath: node.relativePath, name: node.name });
    setSelectedEntry(node);
    if (selectedLeftFile) {
      onUpdateStatus(`Selected: "${selectedLeftFile.name}" (Left) ↔ "${node.name}" (Right). Right-click or press Enter to compare.`);
    } else {
      onUpdateStatus(`Selected Right file: "${node.name}". Now select a file on the Left pane.`);
    }
  };

  const handleLeftDoubleClick = (node: ComparisonEntry) => {
    if (node.isDirectory) {
      toggleFolder(node.relativePath);
      return;
    }
    if (!result || !node.left.exists) return;

    if (selectedRightFile) {
      onOpenInTextCompare(
        `${result.leftRoot}/${node.relativePath}`,
        `${result.rightRoot}/${selectedRightFile.relativePath}`
      );
    } else if (node.right.exists) {
      onOpenInTextCompare(
        `${result.leftRoot}/${node.relativePath}`,
        `${result.rightRoot}/${node.relativePath}`
      );
    } else {
      setSelectedLeftFile({ relativePath: node.relativePath, name: node.name });
      onUpdateStatus(`Selected left file: "${node.name}". Now Ctrl-click a file on the right to compare.`);
    }
  };

  const handleRightDoubleClick = (node: ComparisonEntry) => {
    if (node.isDirectory) {
      toggleFolder(node.relativePath);
      return;
    }
    if (!result || !node.right.exists) return;

    if (selectedLeftFile) {
      onOpenInTextCompare(
        `${result.leftRoot}/${selectedLeftFile.relativePath}`,
        `${result.rightRoot}/${node.relativePath}`
      );
    } else if (node.left.exists) {
      onOpenInTextCompare(
        `${result.leftRoot}/${node.relativePath}`,
        `${result.rightRoot}/${node.relativePath}`
      );
    } else {
      setSelectedRightFile({ relativePath: node.relativePath, name: node.name });
      onUpdateStatus(`Selected right file: "${node.name}". Now Ctrl-click a file on the left to compare.`);
    }
  };

  // Render synchronized side-by-side split row (Beyond Compare architecture)
  const renderRow = (node: ComparisonEntry, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.relativePath);
    const isRowSelected = selectedEntry?.relativePath === node.relativePath && !selectedLeftFile && !selectedRightFile;
    const isLeftSelected = selectedLeftFile?.relativePath === node.relativePath;
    const isRightSelected = selectedRightFile?.relativePath === node.relativePath;

    const isModified = node.status === 'modified';
    const isLeftOnly = node.status === 'left-only';
    const isRightOnly = node.status === 'right-only';
    const hasDiff = node.isDirectory ? hasDiffDescendant(node) : isModified;

    // Left Side (Beyond Compare standard):
    // Changed files or folders containing diffs: bold red text (#c51b1b) and red icons/dates
    // Left-only (orphans): purple text and purple icons (#7e22ce)
    // Identical: neutral dark text
    const leftTextColor = (hasDiff || isModified)
      ? 'text-[#c51b1b] dark:text-[#ff5c5c] font-bold'
      : isLeftOnly
      ? 'text-[#7e22ce] dark:text-[#c084fc] font-bold'
      : 'text-neutral-800 dark:text-neutral-200 font-normal';

    const leftIconClass = (hasDiff || isModified)
      ? 'text-[#c51b1b]'
      : isLeftOnly
      ? 'text-[#7e22ce] dark:text-[#c084fc]'
      : node.isDirectory
      ? (isExpanded ? 'text-amber-500 fill-amber-500/20' : 'text-neutral-500')
      : 'text-neutral-400';

    const leftMetaColor = (hasDiff || isModified)
      ? 'text-[#c51b1b] dark:text-[#ff5c5c] font-medium'
      : isLeftOnly
      ? 'text-[#7e22ce] dark:text-[#c084fc]'
      : 'text-neutral-500 dark:text-neutral-400';

    // Right Side (Beyond Compare standard):
    // Changed files or folders containing diffs: GREYED OUT (#71717a light / #9ca3af dark)
    // When selected: high-contrast text for reading
    // Right-only (orphans): purple text and purple icons (#7e22ce)
    // Identical: neutral dark text
    const rightTextColor = (hasDiff || isModified)
      ? (isRowSelected || isRightSelected ? 'text-neutral-900 dark:text-neutral-100 font-medium' : 'text-[#71717a] dark:text-[#9ca3af] font-normal')
      : isRightOnly
      ? 'text-[#7e22ce] dark:text-[#c084fc] font-bold'
      : 'text-neutral-800 dark:text-neutral-200 font-normal';

    const rightIconClass = (hasDiff || isModified)
      ? (isRowSelected || isRightSelected ? 'text-neutral-700 dark:text-neutral-300' : 'text-[#888888] dark:text-[#777777]')
      : isRightOnly
      ? 'text-[#7e22ce] dark:text-[#c084fc]'
      : node.isDirectory
      ? (isExpanded ? 'text-amber-500 fill-amber-500/20' : 'text-neutral-500')
      : 'text-neutral-400';

    const rightMetaColor = (hasDiff || isModified)
      ? (isRowSelected || isRightSelected ? 'text-neutral-700 dark:text-neutral-300' : 'text-[#888888] dark:text-[#777777]')
      : isRightOnly
      ? 'text-[#7e22ce] dark:text-[#c084fc]'
      : 'text-neutral-500 dark:text-neutral-400';

    return (
      <React.Fragment key={node.relativePath}>
        <div
          onClick={() => {
            setSelectedEntry(node);
            if (node.isDirectory) {
              toggleFolder(node.relativePath);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setSelectedEntry(node);
            setContextMenu({
              x: e.clientX,
              y: e.clientY,
              node,
              leftFile: selectedLeftFile || (node.left.exists && !node.isDirectory ? { relativePath: node.relativePath, name: node.name } : null),
              rightFile: selectedRightFile || (node.right.exists && !node.isDirectory ? { relativePath: node.relativePath, name: node.name } : null),
            });
          }}
          onDoubleClick={() => {
            if (node.isDirectory) {
              toggleFolder(node.relativePath);
            } else if (result) {
              if (selectedLeftFile && selectedRightFile) {
                onOpenInTextCompare(
                  `${result.leftRoot}/${selectedLeftFile.relativePath}`,
                  `${result.rightRoot}/${selectedRightFile.relativePath}`
                );
              } else if (node.left.exists && node.right.exists) {
                onOpenInTextCompare(
                  `${result.leftRoot}/${node.relativePath}`,
                  `${result.rightRoot}/${node.relativePath}`
                );
              }
            }
          }}
          className={`flex items-center border-b border-neutral-200 dark:border-neutral-900 font-mono select-none cursor-pointer transition-colors ${
            isRowSelected
              ? 'bg-[#e0edff] dark:bg-[#1e293b] text-neutral-950 dark:text-white border-y border-blue-200/80 dark:border-blue-800/80'
              : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/60'
          }`}
          style={{ height: `${rowHeight}px`, fontSize: `${fontSizePx}px` }}
        >
          {/* ================= LEFT PANE ================= */}
          <div
            onClick={(e) => handleLeftClick(e, node)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              handleLeftDoubleClick(node);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedEntry(node);
              const leftItem = node.left.exists && !node.isDirectory ? { relativePath: node.relativePath, name: node.name } : null;
              if (leftItem) {
                setSelectedLeftFile(leftItem);
              }
              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                node,
                side: 'left',
                leftFile: leftItem || selectedLeftFile,
                rightFile: selectedRightFile,
              });
            }}
            className={`flex-1 flex items-center min-w-0 pr-1 h-full cursor-pointer transition-colors ${
              isLeftSelected
                ? 'bg-blue-100/90 dark:bg-blue-900/60 ring-2 ring-blue-600 dark:ring-blue-400 rounded-xs'
                : ''
            }`}
          >
            {node.left.exists ? (
              <div
                className="flex items-center w-full min-w-0"
                style={{ paddingLeft: `${depth * 16 + 6}px` }}
              >
                {/* Expander */}
                <div className="w-4 flex-shrink-0 flex items-center">
                  {node.isDirectory ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFolder(node.relativePath);
                      }}
                      className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                  ) : null}
                </div>

                {/* Folder/File Icon */}
                <div className="w-4 flex-shrink-0 mr-1.5 flex items-center justify-center">
                  {node.isDirectory ? (
                    <Folder className={`w-3.5 h-3.5 ${leftIconClass}`} />
                  ) : (
                    <File className={`w-3.5 h-3.5 ${leftIconClass}`} />
                  )}
                </div>

                {/* Name */}
                <span className={`truncate flex-1 min-w-0 ${leftTextColor}`}>
                  {node.name}
                </span>

                {/* Left Selected Badge */}
                {isLeftSelected && !node.isDirectory && (
                  <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] font-sans font-bold bg-blue-600 text-white shadow-xs tracking-wider flex-shrink-0">
                    LEFT
                  </span>
                )}

                {/* Left Size */}
                <span className={`w-20 text-right pr-2 text-[11px] flex-shrink-0 ${leftMetaColor}`}>
                  {node.isDirectory ? '' : formatBytes(node.left.size)}
                </span>

                {/* Left Date */}
                <span className={`w-28 text-right pr-2 text-[11px] flex-shrink-0 ${leftMetaColor}`}>
                  {formatDate(node.left.mtime)}
                </span>
              </div>
            ) : (
              // Left side blank (Right orphan)
              <div className="w-full h-full bg-neutral-100/50 dark:bg-neutral-950/80" />
            )}
          </div>

          {/* ================= CENTER GUTTER (Comparison Status - Beyond Compare Gutter) ================= */}
          <div className="w-6 h-full border-x border-[#e8e8e8] dark:border-neutral-800 bg-neutral-50/50 dark:bg-[#070707] flex items-center justify-center flex-shrink-0 text-center font-bold text-xs">
            {node.status === 'identical' && (
              <span className="text-neutral-400 dark:text-neutral-600 font-sans text-[11px]" title="Identical contents">
                =
              </span>
            )}
            {node.status === 'modified' && (
              <span
                className="w-full h-full flex items-center justify-center bg-red-500/10 text-[#c51b1b] dark:text-[#ff5c5c] font-black text-xs"
                title="Files differ in content"
              >
                ≠
              </span>
            )}
            {node.status === 'left-only' && (
              <span
                className="w-full h-full flex items-center justify-center bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-bold"
                title="Orphan (exists on left only)"
              >
                ←
              </span>
            )}
            {node.status === 'right-only' && (
              <span
                className="w-full h-full flex items-center justify-center bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-bold"
                title="Orphan (exists on right only)"
              >
                →
              </span>
            )}
            {node.status === 'error' && (
              <span className="text-rose-500 font-black text-xs" title={node.left.error || node.right.error}>
                !
              </span>
            )}
          </div>

          {/* ================= RIGHT PANE ================= */}
          <div
            onClick={(e) => handleRightClick(e, node)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              handleRightDoubleClick(node);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedEntry(node);
              const rightItem = node.right.exists && !node.isDirectory ? { relativePath: node.relativePath, name: node.name } : null;
              if (rightItem) {
                setSelectedRightFile(rightItem);
              }
              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                node,
                side: 'right',
                leftFile: selectedLeftFile,
                rightFile: rightItem || selectedRightFile,
              });
            }}
            className={`flex-1 flex items-center min-w-0 pl-1 h-full cursor-pointer transition-colors ${
              isRightSelected
                ? 'bg-purple-100/90 dark:bg-purple-900/60 ring-2 ring-purple-600 dark:ring-purple-400 rounded-xs'
                : ''
            }`}
          >
            {node.right.exists ? (
              <div
                className="flex items-center w-full min-w-0"
                style={{ paddingLeft: `${depth * 16 + 6}px` }}
              >
                {/* Expander */}
                <div className="w-4 flex-shrink-0 flex items-center">
                  {node.isDirectory ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFolder(node.relativePath);
                      }}
                      className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                  ) : null}
                </div>

                {/* Folder/File Icon */}
                <div className="w-4 flex-shrink-0 mr-1.5 flex items-center justify-center">
                  {node.isDirectory ? (
                    <Folder className={`w-3.5 h-3.5 ${rightIconClass}`} />
                  ) : (
                    <File className={`w-3.5 h-3.5 ${rightIconClass}`} />
                  )}
                </div>

                {/* Name */}
                <span className={`truncate flex-1 min-w-0 ${rightTextColor}`}>
                  {node.name}
                </span>

                {/* Right Selected Badge */}
                {isRightSelected && !node.isDirectory && (
                  <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] font-sans font-bold bg-purple-600 text-white shadow-xs tracking-wider flex-shrink-0">
                    RIGHT
                  </span>
                )}

                {/* Right Size */}
                <span className={`w-20 text-right pr-2 text-[11px] flex-shrink-0 ${rightMetaColor}`}>
                  {node.isDirectory ? '' : formatBytes(node.right.size)}
                </span>

                {/* Right Date */}
                <span className={`w-28 text-right pr-2 text-[11px] flex-shrink-0 ${rightMetaColor}`}>
                  {formatDate(node.right.mtime)}
                </span>
              </div>
            ) : (
              // Right side blank (Left orphan)
              <div className="w-full h-full bg-neutral-100/50 dark:bg-neutral-950/80" />
            )}
          </div>
        </div>

        {/* Children when directory is expanded */}
        {node.isDirectory && isExpanded && node.children && (
          <div>
            {node.children.map((child) => renderRow(child, depth + 1))}
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-black text-neutral-900 dark:text-neutral-100 overflow-hidden font-sans">
      {/* Web Limitation Notice Banner */}
      {isWeb && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-3 py-2 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200 flex-shrink-0">
          <div className="flex items-center space-x-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span className="truncate">
              <strong>Web Limitation:</strong> This folder compare feature does not work on the web app. Please download and install the application on your computer to access this feature.
            </span>
          </div>
          <div className="flex items-center space-x-1.5 flex-shrink-0 ml-3">
            <button
              onClick={() => onNavigateTab?.('text')}
              className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-[11px] transition cursor-pointer shadow-xs"
            >
              Use Text Compare
            </button>
            <button
              onClick={() => onNavigateTab?.('structured')}
              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] transition cursor-pointer shadow-xs"
            >
              Use Config & XML
            </button>
          </div>
        </div>
      )}

      {/* 1. Iconic Beyond Compare Dual Address Bars (Strict 50/50 Split) */}
      <div className="bg-[#f6f6f6] dark:bg-[#0c0c0c] border-b border-[#d0d0d0] dark:border-neutral-800 p-1 flex items-center space-x-1.5 flex-shrink-0 w-full max-w-full overflow-hidden">
        {/* Left Folder Address Box (supports drag & drop) */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingLeft(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingLeft(false);
          }}
          onDrop={handleDropLeft}
          className={`flex-1 min-w-0 flex items-center bg-white dark:bg-black border ${
            isDraggingLeft
              ? 'border-blue-500 ring-2 ring-blue-500/50 bg-blue-50/20'
              : 'border-blue-400 dark:border-blue-900/70'
          } rounded px-1.5 py-0.5 shadow-xs focus-within:ring-1 focus-within:ring-blue-500 transition`}
          title={leftFolder || 'Left directory (drop folder here)'}
        >
          <span className="w-4 h-4 rounded bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0 shadow-xs mr-1">
            L
          </span>
          <button
            onClick={handleUpLeft}
            title="Up one folder level"
            className="p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-900 text-neutral-600 dark:text-neutral-400 mr-1 flex-shrink-0"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <FolderOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mr-1 flex-shrink-0" />
          <input
            type="text"
            value={leftFolder}
            onChange={(e) => onSetLeftFolder(e.target.value)}
            placeholder="Left directory path (or drag & drop folder here)..."
            className="bg-transparent text-[11px] w-full min-w-0 focus:outline-none font-mono text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 truncate"
            title={leftFolder || 'Left directory path'}
          />
          <button
            onClick={handlePickLeft}
            title="Browse Left Directory (Yellow Folder)"
            className="ml-1 p-1 rounded bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 transition flex-shrink-0 flex items-center space-x-1 shadow-xs"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
            <span className="text-[10px] font-semibold pr-0.5">Browse</span>
          </button>
        </div>

        {/* Center Controls (Swap & Compare) */}
        <div className="flex items-center space-x-1 flex-shrink-0">
          <button
            onClick={handleSwap}
            data-action="swap"
            title="Swap Left and Right Folders"
            className="p-1 rounded bg-[#eaeaea] dark:bg-neutral-900 hover:bg-neutral-300 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-800 transition shadow-xs"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleStartCompare}
            disabled={isScanning}
            title="Compare Folders (Refresh)"
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>Compare</span>
          </button>
        </div>

        {/* Right Folder Address Box (supports drag & drop) */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingRight(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingRight(false);
          }}
          onDrop={handleDropRight}
          className={`flex-1 min-w-0 flex items-center bg-white dark:bg-black border ${
            isDraggingRight
              ? 'border-purple-500 ring-2 ring-purple-500/50 bg-purple-50/20'
              : 'border-purple-400 dark:border-purple-900/70'
          } rounded px-1.5 py-0.5 shadow-xs focus-within:ring-1 focus-within:ring-purple-500 transition`}
          title={rightFolder || 'Right directory (drop folder here)'}
        >
          <span className="w-4 h-4 rounded bg-purple-600 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0 shadow-xs mr-1">
            R
          </span>
          <button
            onClick={handleUpRight}
            title="Up one folder level"
            className="p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-900 text-neutral-600 dark:text-neutral-400 mr-1 flex-shrink-0"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <FolderOpen className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 mr-1 flex-shrink-0" />
          <input
            type="text"
            value={rightFolder}
            onChange={(e) => onSetRightFolder(e.target.value)}
            placeholder="Right directory path (or drag & drop folder here)..."
            className="bg-transparent text-[11px] w-full min-w-0 focus:outline-none font-mono text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 truncate"
            title={rightFolder || 'Right directory path'}
          />
          <button
            onClick={handlePickRight}
            title="Browse Right Directory (Yellow Folder)"
            className="ml-1 p-1 rounded bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 transition flex-shrink-0 flex items-center space-x-1 shadow-xs"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
            <span className="text-[10px] font-semibold pr-0.5">Browse</span>
          </button>
        </div>
      </div>

      {/* 2. Iconic Beyond Compare Action & Filter Bar */}
      <div className="bg-[#f0f0f0] dark:bg-[#0a0a0a] border-b border-[#c8c8c8] dark:border-neutral-800 px-3 py-1 flex items-center justify-between text-xs flex-shrink-0 select-none shadow-xs">
        {/* Left: The Famous Beyond Compare View Filter Buttons */}
        <div className="flex items-center space-x-1">
          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              title="Return to Sessions Home"
              className="p-1 rounded bg-white dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-800 transition shadow-xs mr-1"
            >
              <Home className="w-3.5 h-3.5" />
            </button>
          )}
          {/* Show All */}
          <button
            onClick={() => setStatusFilter('all')}
            data-action="filter-all"
            title="Show All (Both Same and Different)"
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs transition ${
              statusFilter === 'all'
                ? 'bg-neutral-300 dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold border border-neutral-400 dark:border-neutral-700'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-900'
            }`}
          >
            <span className="font-mono text-xs font-bold">≠ =</span>
            <span>Show All</span>
          </button>

          {/* Show Differences */}
          <button
            onClick={() => setStatusFilter('different')}
            data-action="filter-diffs"
            title="Show Differences Only"
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs transition ${
              statusFilter === 'different'
                ? 'bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 font-bold border border-red-300 dark:border-red-800'
                : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
            }`}
          >
            <span className="font-mono text-xs font-black">≠</span>
            <span>Differences</span>
            {result && (
              <span className="text-[10px] ml-0.5 opacity-80">
                ({result.summary.modified + result.summary.leftOnly + result.summary.rightOnly})
              </span>
            )}
          </button>

          {/* Show Same */}
          <button
            onClick={() => setStatusFilter('identical')}
            data-action="filter-same"
            title="Show Same (Identical Only)"
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs transition ${
              statusFilter === 'identical'
                ? 'bg-neutral-300 dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold border border-neutral-400 dark:border-neutral-700'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-900'
            }`}
          >
            <Equal className="w-3.5 h-3.5" />
            <span>Same</span>
            {result && (
              <span className="text-[10px] ml-0.5 opacity-80">({result.summary.identical})</span>
            )}
          </button>

          {/* Show Left Orphans */}
          <button
            onClick={() => setStatusFilter('left-only')}
            title="Show Left-Side Orphans Only"
            className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition ${
              statusFilter === 'left-only'
                ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 font-bold border border-blue-300 dark:border-blue-800'
                : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30'
            }`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Left Orphans</span>
            {result && (
              <span className="text-[10px] ml-0.5 opacity-80">({result.summary.leftOnly})</span>
            )}
          </button>

          {/* Show Right Orphans */}
          <button
            onClick={() => setStatusFilter('right-only')}
            title="Show Right-Side Orphans Only"
            className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition ${
              statusFilter === 'right-only'
                ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 font-bold border border-purple-300 dark:border-purple-800'
                : 'text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30'
            }`}
          >
            <ChevronRight className="w-3.5 h-3.5" />
            <span>Right Orphans</span>
            {result && (
              <span className="text-[10px] ml-0.5 opacity-80">({result.summary.rightOnly})</span>
            )}
          </button>

          <span className="h-4 w-px bg-neutral-300 dark:bg-neutral-800 mx-1" />

          {/* Expand / Collapse All */}
          <button
            onClick={expandAll}
            title="Expand All Folders"
            className="px-2 py-0.5 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-[11px] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            +* Expand
          </button>
          <button
            onClick={collapseAll}
            title="Collapse All Folders"
            className="px-2 py-0.5 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-[11px] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            -* Collapse
          </button>
        </div>

        {/* Right: Rules & Search */}
        <div className="flex items-center space-x-2">
          {/* Accessible programmatic actions for menu bar */}
          <button
            data-action="copy-l2r"
            className="sr-only"
            disabled={!selectedEntry || !selectedEntry.left.exists}
            onClick={() => selectedEntry && handleCopyLeftToRight(selectedEntry)}
          >
            Copy L to R
          </button>
          <button
            data-action="copy-r2l"
            className="sr-only"
            disabled={!selectedEntry || !selectedEntry.right.exists}
            onClick={() => selectedEntry && handleCopyRightToLeft(selectedEntry)}
          >
            Copy R to L
          </button>

          {/* Search Box */}
          <div className="flex items-center bg-white dark:bg-black border border-neutral-300 dark:border-neutral-800 rounded px-2 py-0.5 w-44">
            <Search className="w-3 h-3 text-neutral-400 mr-1.5 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="bg-transparent text-xs w-full focus:outline-none text-neutral-900 dark:text-neutral-100 placeholder-neutral-400"
            />
          </div>

          {/* Rules Dialog Trigger */}
          <button
            onClick={() => setShowOptionsModal(true)}
            title="Session Rules (Ignore Patterns, Hashing)"
            className="flex items-center space-x-1 px-2 py-1 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Rules</span>
          </button>
        </div>
      </div>

      {/* 3. Live Scan Progress / Error alerts */}
      {isScanning && scanProgress && (
        <div className="bg-blue-50 dark:bg-neutral-900 border-b border-blue-200 dark:border-neutral-800 px-3 py-1 text-xs flex items-center justify-between text-blue-700 dark:text-blue-400 animate-pulse">
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span className="font-mono">{scanProgress.currentPath || 'Analyzing directories...'}</span>
          </div>
          <span className="font-mono">{scanProgress.scannedCount} files scanned</span>
        </div>
      )}

      {scanError && (
        <div className="bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900 px-3 py-1.5 text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
          <span>{scanError}</span>
          <button onClick={() => setScanError(null)} className="font-bold text-[10px] uppercase">
            Dismiss
          </button>
        </div>
      )}

      {/* 4. The Iconic Beyond Compare Synchronized Split Grid */}
      <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-black overflow-hidden">
        {/* Table Column Headers */}
        <div className="h-6 bg-neutral-200/80 dark:bg-neutral-900 border-b border-neutral-300 dark:border-neutral-800 flex items-center text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider flex-shrink-0 select-none">
          {/* Left Side Header */}
          <div className="flex-1 flex items-center pl-3">
            <span
              onClick={() => toggleSort('name')}
              className="flex-1 cursor-pointer hover:text-black dark:hover:text-white"
            >
              Left Name {sortOptions.field === 'name' ? (sortOptions.order === 'asc' ? '▲' : '▼') : ''}
            </span>
            <span
              onClick={() => toggleSort('size')}
              className="w-20 text-right pr-2 cursor-pointer hover:text-black dark:hover:text-white"
            >
              Size {sortOptions.field === 'size' ? (sortOptions.order === 'asc' ? '▲' : '▼') : ''}
            </span>
            <span
              onClick={() => toggleSort('mtime')}
              className="w-28 text-right pr-2 cursor-pointer hover:text-black dark:hover:text-white"
            >
              Modified
            </span>
          </div>

          {/* Center Gutter Header - Bare Minimum Light Divider */}
          <div className="w-6 border-x border-[#e8e8e8] dark:border-neutral-800 text-center text-[10px] text-neutral-400 select-none">
            ≠
          </div>

          {/* Right Side Header */}
          <div className="flex-1 flex items-center pl-3">
            <span
              onClick={() => toggleSort('name')}
              className="flex-1 cursor-pointer hover:text-black dark:hover:text-white"
            >
              Right Name
            </span>
            <span
              onClick={() => toggleSort('size')}
              className="w-20 text-right pr-2 cursor-pointer hover:text-black dark:hover:text-white"
            >
              Size
            </span>
            <span
              onClick={() => toggleSort('mtime')}
              className="w-28 text-right pr-2 cursor-pointer hover:text-black dark:hover:text-white"
            >
              Modified
            </span>
          </div>
        </div>

        {/* Tree Rows Container */}
        <div
          onDragEnter={handleContainerDragEnter}
          onDragOver={handleContainerDragOver}
          onDragLeave={handleContainerDragLeave}
          onDrop={handleContainerDrop}
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              if (onSetZoomLevel) {
                if (e.deltaY < 0) {
                  onSetZoomLevel((z) => Math.min(200, (typeof z === 'number' ? z : 100) + 10));
                } else if (e.deltaY > 0) {
                  onSetZoomLevel((z) => Math.max(70, (typeof z === 'number' ? z : 100) - 10));
                }
              }
            }
          }}
          className="flex-1 overflow-y-auto relative"
          style={{ fontSize: `${fontSizePx}px` }}
        >
          {!result && !isScanning && (
            <div className="h-full flex items-stretch select-none">
              {/* Left Drop Target Zone */}
              <div
                onClick={handlePickLeft}
                className={`flex-1 flex flex-col items-center justify-center p-8 text-center cursor-pointer transition ${
                  dragHoverSide === 'left'
                    ? 'bg-blue-500/10 ring-2 ring-blue-500'
                    : 'bg-white dark:bg-black hover:bg-neutral-50 dark:hover:bg-neutral-950'
                }`}
              >
                <FolderOpen className="w-10 h-10 mb-2 stroke-[1.2] text-blue-500" />
                <h4 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                  Left Directory
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-3 max-w-[200px]">
                  Drag & drop folder here or browse
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePickLeft();
                  }}
                  className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium shadow-xs transition"
                >
                  Browse Left Folder
                </button>
              </div>

              {/* Bare Minimum Light Divider Line */}
              <div className="w-px bg-[#e5e5e5] dark:bg-neutral-800 flex-shrink-0" />

              {/* Right Drop Target Zone */}
              <div
                onClick={handlePickRight}
                className={`flex-1 flex flex-col items-center justify-center p-8 text-center cursor-pointer transition ${
                  dragHoverSide === 'right'
                    ? 'bg-purple-500/10 ring-2 ring-purple-500'
                    : 'bg-white dark:bg-black hover:bg-neutral-50 dark:hover:bg-neutral-950'
                }`}
              >
                <FolderOpen className="w-10 h-10 mb-2 stroke-[1.2] text-purple-500" />
                <h4 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                  Right Directory
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-3 max-w-[200px]">
                  Drag & drop folder here or browse
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePickRight();
                  }}
                  className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-medium shadow-xs transition"
                >
                  Browse Right Folder
                </button>
              </div>
            </div>
          )}

          {result && (
            <div>
              {displayedTree.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-500">
                  No files match the active filter criteria.
                </div>
              ) : (
                displayedTree.map((rootNode) => renderRow(rootNode))
              )}
            </div>
          )}

          {/* Active Drag-and-Drop Overlay over loaded folder tree */}
          {dragHoverSide && (
            <div className="absolute inset-0 z-40 flex pointer-events-none bg-black/40 backdrop-blur-[1px]">
              {/* Left Pane Highlight */}
              <div
                className={`flex-1 flex flex-col items-center justify-center transition border-r border-neutral-700 ${
                  dragHoverSide === 'left'
                    ? 'bg-blue-600/30 ring-4 ring-inset ring-blue-500'
                    : 'bg-black/30 opacity-40'
                }`}
              >
                <FolderOpen className="w-12 h-12 mb-2 text-blue-400 animate-bounce" />
                <span className="font-bold text-sm text-white drop-shadow-md">
                  Drop to Open as Left Folder
                </span>
                <span className="text-xs text-blue-200 mt-1">
                  Replaces current Left directory
                </span>
              </div>

              {/* Right Pane Highlight */}
              <div
                className={`flex-1 flex flex-col items-center justify-center transition ${
                  dragHoverSide === 'right'
                    ? 'bg-purple-600/30 ring-4 ring-inset ring-purple-500'
                    : 'bg-black/30 opacity-40'
                }`}
              >
                <FolderOpen className="w-12 h-12 mb-2 text-purple-400 animate-bounce" />
                <span className="font-bold text-sm text-white drop-shadow-md">
                  Drop to Open as Right Folder
                </span>
                <span className="text-xs text-purple-200 mt-1">
                  Replaces current Right directory
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4.5 Cross-Selection Comparison Action Bar (Compare files with different names) */}
      {(selectedLeftFile || selectedRightFile) && result && (
        <div className="flex-shrink-0 bg-blue-50 dark:bg-[#0c1929] border-t-2 border-blue-500 px-4 py-2.5 flex items-center justify-between shadow-lg z-30 animate-in fade-in slide-in-from-bottom-2 select-none">
          <div className="flex items-center space-x-2.5 min-w-0">
            <ArrowLeftRight className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-blue-900 dark:text-blue-200">
              {selectedLeftFile && selectedRightFile ? 'Ready to Compare:' : 'File Selected:'}
            </span>
            <div className="flex items-center space-x-2 font-mono text-[11px] truncate">
              {selectedLeftFile ? (
                <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/80 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700 font-semibold truncate max-w-[260px]" title={selectedLeftFile.relativePath}>
                  [Left] {selectedLeftFile.name}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-500 italic">
                  (select a file on Left)
                </span>
              )}
              <span className="text-neutral-400 font-bold">↔</span>
              {selectedRightFile ? (
                <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/80 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-700 font-semibold truncate max-w-[260px]" title={selectedRightFile.relativePath}>
                  [Right] {selectedRightFile.name}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-500 italic">
                  (select or Ctrl-click a file on Right)
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            {selectedLeftFile && selectedRightFile && (
              <button
                onClick={handleCompareSelectedPair}
                className="px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-xs flex items-center space-x-1.5 transition cursor-pointer"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Compare Files (Enter)</span>
              </button>
            )}
            <button
              onClick={() => {
                setSelectedLeftFile(null);
                setSelectedRightFile(null);
              }}
              className="px-2.5 py-1.5 rounded text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 text-xs transition cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* 5. Rules & Ignore Patterns Modal */}
      {showOptionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-lg max-w-md w-full shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-neutral-100 dark:bg-neutral-900 px-4 py-2.5 border-b border-neutral-300 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 flex items-center space-x-1.5">
                <SlidersHorizontal className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Session Comparison Rules</span>
              </h3>
              <button
                onClick={() => setShowOptionsModal(false)}
                className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-xs text-neutral-800 dark:text-neutral-200">
              <div>
                <label className="block font-medium mb-1">
                  Name Filters (Exclude comma-separated globs / folder names):
                </label>
                <input
                  type="text"
                  value={ignorePatternsInput}
                  onChange={(e) => setIgnorePatternsInput(e.target.value)}
                  placeholder=".git, node_modules, .DS_Store, *.log"
                  className="w-full bg-neutral-50 dark:bg-black border border-neutral-300 dark:border-neutral-800 rounded px-2.5 py-1.5 font-mono text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Content Comparison:</label>
                <div className="space-y-1.5">
                  <label className="flex items-center space-x-2 cursor-pointer">
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
                      <strong>Binary SHA-256 Content Hash</strong> (Strict content verification)
                    </span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
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
                      <strong>Timestamp and Size Only</strong> (Fastest on network shares)
                    </span>
                  </label>
                </div>
              </div>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.caseSensitive}
                  onChange={(e) =>
                    setOptions((prev) => ({ ...prev, caseSensitive: e.target.checked }))
                  }
                  className="rounded border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-blue-600"
                />
                <span>Case-sensitive filename matching</span>
              </label>
            </div>

            <div className="bg-neutral-100 dark:bg-neutral-900 px-4 py-2 border-t border-neutral-300 dark:border-neutral-800 flex justify-end space-x-2">
              <button
                onClick={() => setShowOptionsModal(false)}
                className="px-3 py-1 rounded text-xs bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 text-neutral-800 dark:text-neutral-200"
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
                className="px-4 py-1 rounded text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
              >
                Apply Rules
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Right-Click Context Menu */}
      {contextMenu && (() => {
        const candidateLeft = contextMenu.leftFile || selectedLeftFile || (contextMenu.node.left.exists && !contextMenu.node.isDirectory ? { relativePath: contextMenu.node.relativePath, name: contextMenu.node.name } : null);
        const candidateRight = contextMenu.rightFile || selectedRightFile || (contextMenu.node.right.exists && !contextMenu.node.isDirectory ? { relativePath: contextMenu.node.relativePath, name: contextMenu.node.name } : null);
        const canCompareCrossPair = Boolean(candidateLeft && candidateRight && result);
        const isSameFileCompare = Boolean(
          !canCompareCrossPair &&
          !contextMenu.node.isDirectory &&
          contextMenu.node.left.exists &&
          contextMenu.node.right.exists &&
          result
        );

        return (
          <div
            className="fixed z-50 min-w-[240px] max-w-[320px] bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md shadow-2xl py-1.5 text-xs font-sans text-neutral-800 dark:text-neutral-200 animate-in fade-in zoom-in-95 duration-75 select-none"
            style={{
              top: Math.min(contextMenu.y, window.innerHeight - 300),
              left: Math.min(contextMenu.x, window.innerWidth - 270),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1. TOP-LEVEL PRIMARY ACTION: COMPARE PROMPT */}
            {canCompareCrossPair && candidateLeft && candidateRight && result && (
              <div className="px-1.5 pb-1.5 border-b border-neutral-200 dark:border-neutral-800">
                <button
                  onClick={() => {
                    setContextMenu(null);
                    onOpenInTextCompare(
                      `${result.leftRoot}/${candidateLeft.relativePath}`,
                      `${result.rightRoot}/${candidateRight.relativePath}`
                    );
                  }}
                  className="w-full text-left px-3 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold flex items-center space-x-2.5 rounded shadow-sm transition cursor-pointer"
                >
                  <ArrowLeftRight className="w-4 h-4 text-white flex-shrink-0" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[12px] font-bold text-white tracking-wide">
                      ⇄ Compare Files Now
                    </span>
                    <span className="text-[10px] font-mono text-blue-100 truncate">
                      {candidateLeft.name} ↔ {candidateRight.name}
                    </span>
                  </div>
                </button>
              </div>
            )}

            {isSameFileCompare && result && (
              <div className="px-1.5 pb-1.5 border-b border-neutral-200 dark:border-neutral-800">
                <button
                  onClick={() => {
                    const node = contextMenu.node;
                    setContextMenu(null);
                    onOpenInTextCompare(
                      `${result.leftRoot}/${node.relativePath}`,
                      `${result.rightRoot}/${node.relativePath}`
                    );
                  }}
                  className="w-full text-left px-3 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold flex items-center space-x-2 rounded shadow-sm transition cursor-pointer"
                >
                  <ArrowLeftRight className="w-4 h-4 text-white flex-shrink-0" />
                  <span className="text-[12px] font-bold text-white truncate">
                    ⇄ Compare "{contextMenu.node.name}"
                  </span>
                </button>
              </div>
            )}

            {/* Header / Target Name */}
            <div className="px-3 py-1.5 border-b border-neutral-200 dark:border-neutral-800 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 truncate flex items-center space-x-1.5">
              {contextMenu.node.isDirectory ? (
                <Folder className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              ) : (
                <File className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
              )}
              <span className="truncate">{contextMenu.node.name}</span>
            </div>

            {/* Manual Selection Options */}
            {contextMenu.node.left.exists && !contextMenu.node.isDirectory && (
              <button
                onClick={() => {
                  setSelectedLeftFile({ relativePath: contextMenu.node.relativePath, name: contextMenu.node.name });
                  setContextMenu(null);
                  onUpdateStatus(`Selected "${contextMenu.node.name}" as Left file. Now select a Right file to compare.`);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-600 dark:hover:text-blue-400 flex items-center space-x-2 text-neutral-700 dark:text-neutral-300 transition cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <span>Select as Left File</span>
              </button>
            )}

            {contextMenu.node.right.exists && !contextMenu.node.isDirectory && (
              <button
                onClick={() => {
                  setSelectedRightFile({ relativePath: contextMenu.node.relativePath, name: contextMenu.node.name });
                  setContextMenu(null);
                  onUpdateStatus(`Selected "${contextMenu.node.name}" as Right file. Now select a Left file to compare.`);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-purple-50 dark:hover:bg-purple-950/60 hover:text-purple-600 dark:hover:text-purple-400 flex items-center space-x-2 text-neutral-700 dark:text-neutral-300 transition cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                <span>Select as Right File</span>
              </button>
            )}

            {(selectedLeftFile || selectedRightFile) && (
              <button
                onClick={() => {
                  setSelectedLeftFile(null);
                  setSelectedRightFile(null);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 flex items-center space-x-2 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                <span>Clear File Selections</span>
              </button>
            )}

            {/* Copy actions */}
            {contextMenu.node.left.exists && (
              <button
                onClick={() => {
                  const node = contextMenu.node;
                  setContextMenu(null);
                  handleCopyLeftToRight(node);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center space-x-2 text-neutral-700 dark:text-neutral-300 transition cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-blue-500" />
                <span>Copy Left &rarr; Right</span>
              </button>
            )}

            {contextMenu.node.right.exists && (
              <button
                onClick={() => {
                  const node = contextMenu.node;
                  setContextMenu(null);
                  handleCopyRightToLeft(node);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center space-x-2 text-neutral-700 dark:text-neutral-300 transition cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5 flex-shrink-0 text-purple-500" />
                <span>Copy Right &rarr; Left</span>
              </button>
            )}

            {/* Delete Options */}
            <div className="my-1 border-t border-neutral-200 dark:border-neutral-800" />

            {contextMenu.node.left.exists && (
              <button
                onClick={() => handleDeleteEntry(contextMenu.node, 'left')}
                className="w-full text-left px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/60 hover:text-red-600 dark:hover:text-red-400 flex items-center space-x-2 text-red-600 dark:text-red-400 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Delete Left {contextMenu.node.isDirectory ? 'Folder' : 'File'}</span>
              </button>
            )}

            {contextMenu.node.right.exists && (
              <button
                onClick={() => handleDeleteEntry(contextMenu.node, 'right')}
                className="w-full text-left px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/60 hover:text-red-600 dark:hover:text-red-400 flex items-center space-x-2 text-red-600 dark:text-red-400 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Delete Right {contextMenu.node.isDirectory ? 'Folder' : 'File'}</span>
              </button>
            )}

            {contextMenu.node.left.exists && contextMenu.node.right.exists && (
              <button
                onClick={() => handleDeleteEntry(contextMenu.node, 'both')}
                className="w-full text-left px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/60 hover:text-red-600 dark:hover:text-red-400 flex items-center space-x-2 text-red-600 dark:text-red-400 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Delete Both Sides</span>
              </button>
            )}

            {/* Open in explorer / finder */}
            {result && (
              <>
                <div className="my-1 border-t border-neutral-200 dark:border-neutral-800" />
                <button
                  onClick={() => {
                    const node = contextMenu.node;
                    setContextMenu(null);
                    const p = node.left.exists
                      ? `${result.leftRoot}/${node.relativePath}`
                      : `${result.rightRoot}/${node.relativePath}`;
                    window.diffxAPI?.openInSystemExplorer?.(p);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center space-x-2 text-neutral-600 dark:text-neutral-400 transition cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Show in System Explorer</span>
                </button>
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
};
