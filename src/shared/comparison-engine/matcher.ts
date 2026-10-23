/**
 * Comparison Engine — Entry Classification & Hierarchy Builder
 */

import {
  ComparisonEntry,
  ComparisonSummary,
  EntryStatus,
  FileMetadata,
  FolderComparisonOptions,
} from '../types.js';

export interface ScannedItem {
  relativePath: string;
  name: string;
  isDirectory: boolean;
  metadata: FileMetadata;
}

export function matchEntries(
  leftItems: Map<string, ScannedItem>,
  rightItems: Map<string, ScannedItem>,
  options: FolderComparisonOptions
): { flatList: ComparisonEntry[]; tree: ComparisonEntry[]; summary: ComparisonSummary } {
  const allKeys = new Set<string>();

  // Use map to preserve canonical case while indexing
  const leftKeyMap = new Map<string, string>();
  for (const key of leftItems.keys()) {
    const lookupKey = options.caseSensitive ? key : key.toLowerCase();
    leftKeyMap.set(lookupKey, key);
    allKeys.add(lookupKey);
  }

  const rightKeyMap = new Map<string, string>();
  for (const key of rightItems.keys()) {
    const lookupKey = options.caseSensitive ? key : key.toLowerCase();
    rightKeyMap.set(lookupKey, key);
    allKeys.add(lookupKey);
  }

  const flatList: ComparisonEntry[] = [];

  const emptyMetadata = (isDirectory: boolean = false): FileMetadata => ({
    exists: false,
    size: 0,
    mtime: 0,
    isDirectory,
    isSymlink: false,
    readable: false,
  });

  for (const lookupKey of allKeys) {
    const leftOriginalKey = leftKeyMap.get(lookupKey);
    const rightOriginalKey = rightKeyMap.get(lookupKey);

    const leftItem = leftOriginalKey ? leftItems.get(leftOriginalKey) : undefined;
    const rightItem = rightOriginalKey ? rightItems.get(rightOriginalKey) : undefined;

    const relativePath = leftOriginalKey || rightOriginalKey || lookupKey;
    const isDir = Boolean((leftItem && leftItem.isDirectory) || (rightItem && rightItem.isDirectory));
    const name = relativePath.split('/').pop() || relativePath;

    const leftMeta: FileMetadata = leftItem ? leftItem.metadata : emptyMetadata(isDir);
    const rightMeta: FileMetadata = rightItem ? rightItem.metadata : emptyMetadata(isDir);

    let status: EntryStatus = 'identical';
    let mtimeDiff = false;
    let sizeDiff = false;

    if (leftMeta.error || rightMeta.error) {
      status = 'error';
    } else if (leftMeta.exists && !rightMeta.exists) {
      status = 'left-only';
    } else if (!leftMeta.exists && rightMeta.exists) {
      status = 'right-only';
    } else if (leftMeta.isDirectory !== rightMeta.isDirectory) {
      // One is a directory, the other is a file
      status = 'modified';
    } else if (!isDir) {
      // Both are files
      sizeDiff = leftMeta.size !== rightMeta.size;
      mtimeDiff = Math.abs(leftMeta.mtime - rightMeta.mtime) >= 1000; // >=1s threshold for filesystem timestamp differences

      if (options.compareContentStrategy === 'hash') {
        if (!leftMeta.hash || !rightMeta.hash) {
          // If hash is missing on a file that exists and should be readable
          status = leftMeta.readable && rightMeta.readable ? 'modified' : 'error';
        } else if (leftMeta.hash === rightMeta.hash) {
          status = 'identical';
        } else {
          status = 'modified';
        }
      } else {
        // Quick size & mtime strategy
        if (sizeDiff || mtimeDiff) {
          status = 'modified';
        } else {
          status = 'identical';
        }
      }
    } else {
      // Both are directories; base directory status will be computed after tree folding
      status = 'identical';
      mtimeDiff = Math.abs(leftMeta.mtime - rightMeta.mtime) > 1000;
    }

    flatList.push({
      relativePath,
      name,
      isDirectory: isDir,
      status,
      mtimeDiff,
      sizeDiff,
      left: leftMeta,
      right: rightMeta,
    });
  }

  // Sort flat list alphabetically by relative path
  flatList.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  // Build Tree
  const tree = buildHierarchy(flatList);

  // Compute directory rollup status
  updateDirectoryStatuses(tree);

  // Compute summary metrics (count non-directory files primarily, with separate directory indicators)
  const summary: ComparisonSummary = {
    total: 0,
    identical: 0,
    modified: 0,
    leftOnly: 0,
    rightOnly: 0,
    error: 0,
    totalBytesLeft: 0,
    totalBytesRight: 0,
    scanDurationMs: 0,
  };

  for (const entry of flatList) {
    if (entry.left.exists) summary.totalBytesLeft += entry.left.size;
    if (entry.right.exists) summary.totalBytesRight += entry.right.size;

    // For summary statistics, count files and empty/leaf directories
    if (!entry.isDirectory) {
      summary.total++;
      if (entry.status === 'identical') summary.identical++;
      else if (entry.status === 'modified') summary.modified++;
      else if (entry.status === 'left-only') summary.leftOnly++;
      else if (entry.status === 'right-only') summary.rightOnly++;
      else if (entry.status === 'error') summary.error++;
    }
  }

  return { flatList, tree, summary };
}

function buildHierarchy(flatList: ComparisonEntry[]): ComparisonEntry[] {
  const rootNodes: ComparisonEntry[] = [];
  const dirMap = new Map<string, ComparisonEntry>();

  // Ensure directories are indexed
  for (const entry of flatList) {
    if (entry.isDirectory) {
      entry.children = [];
      dirMap.set(entry.relativePath, entry);
    }
  }

  for (const entry of flatList) {
    const segments = entry.relativePath.split('/');
    if (segments.length === 1) {
      rootNodes.push(entry);
    } else {
      const parentPath = segments.slice(0, -1).join('/');
      const parent = dirMap.get(parentPath);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push(entry);
      } else {
        rootNodes.push(entry);
      }
    }
  }

  return rootNodes;
}

function updateDirectoryStatuses(nodes: ComparisonEntry[]): EntryStatus {
  for (const node of nodes) {
    if (node.isDirectory && node.children && node.children.length > 0) {
      let hasError = false;
      let hasModified = false;
      let hasLeftOnly = false;
      let hasRightOnly = false;
      let allIdentical = true;

      for (const child of node.children) {
        const childStatus = child.isDirectory ? updateDirectoryStatuses([child]) : child.status;

        if (childStatus === 'error') hasError = true;
        if (childStatus === 'modified') hasModified = true;
        if (childStatus === 'left-only') hasLeftOnly = true;
        if (childStatus === 'right-only') hasRightOnly = true;
        if (childStatus !== 'identical') allIdentical = false;
      }

      if (node.status === 'left-only' || node.status === 'right-only') {
        // Keep unilateral side classification if directory only exists on one side
      } else if (hasError) {
        node.status = 'error';
      } else if (hasModified || (hasLeftOnly && hasRightOnly)) {
        node.status = 'modified';
      } else if (hasLeftOnly) {
        node.status = 'modified'; // Container has internal differences
      } else if (hasRightOnly) {
        node.status = 'modified';
      } else if (allIdentical) {
        node.status = 'identical';
      }
    }
  }

  return nodes.length > 0 ? nodes[0].status : 'identical';
}
