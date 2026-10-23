import { describe, it, expect } from 'vitest';
import { matchEntries, ScannedItem } from '../../src/shared/comparison-engine/matcher.js';
import { FolderComparisonOptions } from '../../src/shared/types.js';

describe('Comparison Engine — Matcher', () => {
  const defaultOptions: FolderComparisonOptions = {
    ignorePatterns: [],
    caseSensitive: true,
    followSymlinks: false,
    compareContentStrategy: 'hash',
  };

  it('correctly classifies identical, modified, left-only, and right-only entries', () => {
    const leftItems = new Map<string, ScannedItem>();
    const rightItems = new Map<string, ScannedItem>();

    // 1. Identical file
    leftItems.set('identical.txt', {
      relativePath: 'identical.txt',
      name: 'identical.txt',
      isDirectory: false,
      metadata: {
        exists: true,
        size: 100,
        mtime: 1000,
        hash: 'hash-abc',
        isDirectory: false,
        isSymlink: false,
        readable: true,
      },
    });
    rightItems.set('identical.txt', {
      relativePath: 'identical.txt',
      name: 'identical.txt',
      isDirectory: false,
      metadata: {
        exists: true,
        size: 100,
        mtime: 2000, // Different mtime
        hash: 'hash-abc', // Same hash
        isDirectory: false,
        isSymlink: false,
        readable: true,
      },
    });

    // 2. Modified file
    leftItems.set('config.yaml', {
      relativePath: 'config.yaml',
      name: 'config.yaml',
      isDirectory: false,
      metadata: {
        exists: true,
        size: 200,
        mtime: 1000,
        hash: 'hash-left',
        isDirectory: false,
        isSymlink: false,
        readable: true,
      },
    });
    rightItems.set('config.yaml', {
      relativePath: 'config.yaml',
      name: 'config.yaml',
      isDirectory: false,
      metadata: {
        exists: true,
        size: 250,
        mtime: 1500,
        hash: 'hash-right',
        isDirectory: false,
        isSymlink: false,
        readable: true,
      },
    });

    // 3. Left-only file
    leftItems.set('left-unique.txt', {
      relativePath: 'left-unique.txt',
      name: 'left-unique.txt',
      isDirectory: false,
      metadata: {
        exists: true,
        size: 50,
        mtime: 1000,
        hash: 'hash-left-unique',
        isDirectory: false,
        isSymlink: false,
        readable: true,
      },
    });

    // 4. Right-only file
    rightItems.set('right-unique.txt', {
      relativePath: 'right-unique.txt',
      name: 'right-unique.txt',
      isDirectory: false,
      metadata: {
        exists: true,
        size: 80,
        mtime: 2000,
        hash: 'hash-right-unique',
        isDirectory: false,
        isSymlink: false,
        readable: true,
      },
    });

    const { flatList, summary } = matchEntries(leftItems, rightItems, defaultOptions);

    const identicalEntry = flatList.find((e) => e.relativePath === 'identical.txt');
    expect(identicalEntry).toBeDefined();
    expect(identicalEntry?.status).toBe('identical');
    expect(identicalEntry?.mtimeDiff).toBe(true); // Content identical despite mtime difference

    const modifiedEntry = flatList.find((e) => e.relativePath === 'config.yaml');
    expect(modifiedEntry).toBeDefined();
    expect(modifiedEntry?.status).toBe('modified');
    expect(modifiedEntry?.sizeDiff).toBe(true);

    const leftOnlyEntry = flatList.find((e) => e.relativePath === 'left-unique.txt');
    expect(leftOnlyEntry).toBeDefined();
    expect(leftOnlyEntry?.status).toBe('left-only');

    const rightOnlyEntry = flatList.find((e) => e.relativePath === 'right-unique.txt');
    expect(rightOnlyEntry).toBeDefined();
    expect(rightOnlyEntry?.status).toBe('right-only');

    expect(summary.total).toBe(4);
    expect(summary.identical).toBe(1);
    expect(summary.modified).toBe(1);
    expect(summary.leftOnly).toBe(1);
    expect(summary.rightOnly).toBe(1);
  });

  it('marks unreadable files as error status', () => {
    const leftItems = new Map<string, ScannedItem>();
    const rightItems = new Map<string, ScannedItem>();

    leftItems.set('locked.txt', {
      relativePath: 'locked.txt',
      name: 'locked.txt',
      isDirectory: false,
      metadata: {
        exists: true,
        size: 0,
        mtime: 0,
        isDirectory: false,
        isSymlink: false,
        readable: false,
        error: 'EACCES: permission denied',
      },
    });

    rightItems.set('locked.txt', {
      relativePath: 'locked.txt',
      name: 'locked.txt',
      isDirectory: false,
      metadata: {
        exists: true,
        size: 10,
        mtime: 1000,
        hash: 'hash-val',
        isDirectory: false,
        isSymlink: false,
        readable: true,
      },
    });

    const { flatList, summary } = matchEntries(leftItems, rightItems, defaultOptions);
    const entry = flatList.find((e) => e.relativePath === 'locked.txt');
    expect(entry?.status).toBe('error');
    expect(summary.error).toBe(1);
  });
});
