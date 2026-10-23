/**
 * Comparison Engine — Filtering & Sorting Utilities
 */

import { ComparisonEntry, EntryStatus } from '../types.js';

export type StatusFilter = 'all' | 'different' | 'identical' | 'modified' | 'left-only' | 'right-only' | 'error';
export type SortField = 'name' | 'path' | 'status' | 'size' | 'mtime';
export type SortOrder = 'asc' | 'desc';

export interface FilterOptions {
  status: StatusFilter;
  searchQuery: string;
  extensionFilter: string;
}

export interface SortOptions {
  field: SortField;
  order: SortOrder;
}

export function filterFlatList(entries: ComparisonEntry[], options: FilterOptions): ComparisonEntry[] {
  const query = options.searchQuery.trim().toLowerCase();
  const ext = options.extensionFilter.trim().toLowerCase();

  return entries.filter((entry) => {
    // 1. Status Filter
    if (options.status === 'different') {
      if (entry.status === 'identical') return false;
    } else if (options.status !== 'all') {
      if (entry.status !== options.status) return false;
    }

    // 2. Search Query Filter
    if (query) {
      const pathMatch = entry.relativePath.toLowerCase().includes(query);
      const nameMatch = entry.name.toLowerCase().includes(query);
      if (!pathMatch && !nameMatch) return false;
    }

    // 3. Extension Filter
    if (ext && !entry.isDirectory) {
      const entryExt = entry.name.includes('.') ? `.${entry.name.split('.').pop()?.toLowerCase()}` : '';
      if (!entryExt.includes(ext)) return false;
    }

    return true;
  });
}

export function filterTree(nodes: ComparisonEntry[], options: FilterOptions): ComparisonEntry[] {
  const query = options.searchQuery.trim().toLowerCase();
  const ext = options.extensionFilter.trim().toLowerCase();

  function nodeMatches(node: ComparisonEntry): boolean {
    if (options.status === 'different') {
      if (node.status === 'identical') return false;
    } else if (options.status !== 'all') {
      if (node.status !== options.status) return false;
    }

    if (query) {
      const pathMatch = node.relativePath.toLowerCase().includes(query);
      const nameMatch = node.name.toLowerCase().includes(query);
      if (!pathMatch && !nameMatch) return false;
    }

    if (ext && !node.isDirectory) {
      const nodeExt = node.name.includes('.') ? `.${node.name.split('.').pop()?.toLowerCase()}` : '';
      if (!nodeExt.includes(ext)) return false;
    }

    return true;
  }

  function filterRecursive(node: ComparisonEntry): ComparisonEntry | null {
    if (!node.isDirectory) {
      return nodeMatches(node) ? { ...node } : null;
    }

    const filteredChildren: ComparisonEntry[] = [];
    if (node.children) {
      for (const child of node.children) {
        const matchingChild = filterRecursive(child);
        if (matchingChild) {
          filteredChildren.push(matchingChild);
        }
      }
    }

    // Directory is included if it directly matches or if any child matches
    if (filteredChildren.length > 0 || nodeMatches(node)) {
      return {
        ...node,
        children: filteredChildren,
      };
    }

    return null;
  }

  const result: ComparisonEntry[] = [];
  for (const root of nodes) {
    const filtered = filterRecursive(root);
    if (filtered) result.push(filtered);
  }

  return result;
}

export function sortEntries(entries: ComparisonEntry[], options: SortOptions): ComparisonEntry[] {
  const statusRank: Record<EntryStatus, number> = {
    modified: 1,
    'left-only': 2,
    'right-only': 3,
    error: 4,
    identical: 5,
  };

  const sorted = [...entries].sort((a, b) => {
    // Keep directories first if desired, or sort cleanly
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }

    let diff = 0;
    switch (options.field) {
      case 'name':
        diff = a.name.localeCompare(b.name);
        break;
      case 'path':
        diff = a.relativePath.localeCompare(b.relativePath);
        break;
      case 'status':
        diff = statusRank[a.status] - statusRank[b.status];
        if (diff === 0) diff = a.relativePath.localeCompare(b.relativePath);
        break;
      case 'size': {
        const aSize = Math.max(a.left.size, a.right.size);
        const bSize = Math.max(b.left.size, b.right.size);
        diff = aSize - bSize;
        break;
      }
      case 'mtime': {
        const aMtime = Math.max(a.left.mtime, a.right.mtime);
        const bMtime = Math.max(b.left.mtime, b.right.mtime);
        diff = aMtime - bMtime;
        break;
      }
    }

    return options.order === 'asc' ? diff : -diff;
  });

  return sorted;
}
