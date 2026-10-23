import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { scanDirectory } from '../../src/main/fs-engine/scanner.js';
import { matchEntries } from '../../src/shared/comparison-engine/matcher.js';
import { FolderComparisonOptions } from '../../src/shared/types.js';

describe('End-to-End Directory Scanner & Matcher with Local Fixtures', () => {
  const fixturesDir = path.resolve(__dirname, '../fixtures');
  const leftDir = path.join(fixturesDir, 'left');
  const rightDir = path.join(fixturesDir, 'right');

  const options: FolderComparisonOptions = {
    ignorePatterns: [],
    caseSensitive: true,
    followSymlinks: false,
    compareContentStrategy: 'hash',
  };

  it('scans fixtures recursively and correctly reconciles entries', async () => {
    const leftScan = await scanDirectory(leftDir, options, { isCancelled: false }, 'scanning-left');
    const rightScan = await scanDirectory(rightDir, options, { isCancelled: false }, 'scanning-right');

    expect(leftScan.size).toBeGreaterThan(0);
    expect(rightScan.size).toBeGreaterThan(0);

    const { flatList, summary } = matchEntries(leftScan, rightScan, options);

    // Verify identical.txt
    const identicalEntry = flatList.find((e) => e.relativePath === 'identical.txt');
    expect(identicalEntry).toBeDefined();
    expect(identicalEntry?.status).toBe('identical');

    // Verify modified.txt
    const modifiedEntry = flatList.find((e) => e.relativePath === 'modified.txt');
    expect(modifiedEntry).toBeDefined();
    expect(modifiedEntry?.status).toBe('modified');

    // Verify left_only.txt
    const leftOnlyEntry = flatList.find((e) => e.relativePath === 'left_only.txt');
    expect(leftOnlyEntry).toBeDefined();
    expect(leftOnlyEntry?.status).toBe('left-only');

    // Verify right_only.txt
    const rightOnlyEntry = flatList.find((e) => e.relativePath === 'right_only.txt');
    expect(rightOnlyEntry).toBeDefined();
    expect(rightOnlyEntry?.status).toBe('right-only');

    // Verify nested/service.yaml
    const nestedEntry = flatList.find((e) => e.relativePath === 'nested/service.yaml');
    expect(nestedEntry).toBeDefined();
    expect(nestedEntry?.status).toBe('modified'); // Different resourceVersion

    // Verify summary statistics
    expect(summary.identical).toBeGreaterThanOrEqual(1);
    expect(summary.modified).toBeGreaterThanOrEqual(2);
    expect(summary.leftOnly).toBeGreaterThanOrEqual(1);
    expect(summary.rightOnly).toBeGreaterThanOrEqual(1);
    expect(summary.error).toBe(0);
  });
});
