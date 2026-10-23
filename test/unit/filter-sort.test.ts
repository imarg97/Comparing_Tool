import { describe, it, expect } from 'vitest';
import {
  filterFlatList,
  sortEntries,
} from '../../src/shared/comparison-engine/filter-sort.js';
import { ComparisonEntry } from '../../src/shared/types.js';

describe('Filtering & Sorting Engine', () => {
  const dummyEntries: ComparisonEntry[] = [
    {
      relativePath: 'app.ts',
      name: 'app.ts',
      isDirectory: false,
      status: 'identical',
      mtimeDiff: false,
      sizeDiff: false,
      left: { exists: true, size: 100, mtime: 100, isDirectory: false, isSymlink: false, readable: true },
      right: { exists: true, size: 100, mtime: 100, isDirectory: false, isSymlink: false, readable: true },
    },
    {
      relativePath: 'config.yaml',
      name: 'config.yaml',
      isDirectory: false,
      status: 'modified',
      mtimeDiff: true,
      sizeDiff: true,
      left: { exists: true, size: 200, mtime: 200, isDirectory: false, isSymlink: false, readable: true },
      right: { exists: true, size: 250, mtime: 250, isDirectory: false, isSymlink: false, readable: true },
    },
    {
      relativePath: 'left-only.log',
      name: 'left-only.log',
      isDirectory: false,
      status: 'left-only',
      mtimeDiff: false,
      sizeDiff: false,
      left: { exists: true, size: 50, mtime: 150, isDirectory: false, isSymlink: false, readable: true },
      right: { exists: false, size: 0, mtime: 0, isDirectory: false, isSymlink: false, readable: false },
    },
  ];

  it('filters by status', () => {
    const modifiedOnly = filterFlatList(dummyEntries, {
      status: 'modified',
      searchQuery: '',
      extensionFilter: '',
    });
    expect(modifiedOnly.length).toBe(1);
    expect(modifiedOnly[0].name).toBe('config.yaml');

    const differentOnly = filterFlatList(dummyEntries, {
      status: 'different',
      searchQuery: '',
      extensionFilter: '',
    });
    expect(differentOnly.length).toBe(2);
  });

  it('filters by search query and extension', () => {
    const searched = filterFlatList(dummyEntries, {
      status: 'all',
      searchQuery: 'config',
      extensionFilter: '',
    });
    expect(searched.length).toBe(1);
    expect(searched[0].name).toBe('config.yaml');

    const extFiltered = filterFlatList(dummyEntries, {
      status: 'all',
      searchQuery: '',
      extensionFilter: '.log',
    });
    expect(extFiltered.length).toBe(1);
    expect(extFiltered[0].name).toBe('left-only.log');
  });

  it('sorts entries by status precedence (modified first)', () => {
    const sorted = sortEntries(dummyEntries, { field: 'status', order: 'asc' });
    expect(sorted[0].status).toBe('modified');
    expect(sorted[1].status).toBe('left-only');
    expect(sorted[2].status).toBe('identical');
  });

  it('sorts entries by size', () => {
    const sorted = sortEntries(dummyEntries, { field: 'size', order: 'desc' });
    expect(sorted[0].name).toBe('config.yaml'); // max size 250
    expect(sorted[1].name).toBe('app.ts'); // 100
    expect(sorted[2].name).toBe('left-only.log'); // 50
  });
});
