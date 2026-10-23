import { describe, it, expect } from 'vitest';
import { shouldIgnorePath } from '../../src/shared/comparison-engine/wildcard.js';

describe('Wildcard & Ignore Pattern Matching', () => {
  const ignorePatterns = ['.git', 'node_modules', '*.log', '.DS_Store', 'dist'];

  it('ignores standard directory names anywhere in path', () => {
    expect(shouldIgnorePath('.git', ignorePatterns)).toBe(true);
    expect(shouldIgnorePath('.git/config', ignorePatterns)).toBe(true);
    expect(shouldIgnorePath('src/node_modules/package.json', ignorePatterns)).toBe(true);
    expect(shouldIgnorePath('dist/bundle.js', ignorePatterns)).toBe(true);
  });

  it('ignores file extensions matching globs', () => {
    expect(shouldIgnorePath('app.log', ignorePatterns)).toBe(true);
    expect(shouldIgnorePath('logs/production.log', ignorePatterns)).toBe(true);
    expect(shouldIgnorePath('app.log.backup', ignorePatterns)).toBe(false);
  });

  it('keeps valid non-ignored files', () => {
    expect(shouldIgnorePath('src/index.ts', ignorePatterns)).toBe(false);
    expect(shouldIgnorePath('README.md', ignorePatterns)).toBe(false);
    expect(shouldIgnorePath('configs/service.yaml', ignorePatterns)).toBe(false);
  });

  it('respects case sensitivity flag', () => {
    expect(shouldIgnorePath('BUILD.LOG', ['*.log'], true)).toBe(false);
    expect(shouldIgnorePath('BUILD.LOG', ['*.log'], false)).toBe(true);
  });
});
