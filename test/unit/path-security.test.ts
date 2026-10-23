import { describe, it, expect } from 'vitest';
import {
  containsPathTraversal,
  isPathInsideRoot,
  normalizeRelativePath,
} from '../../src/shared/comparison-engine/path-security.js';

describe('Path Security & Traversal Prevention', () => {
  it('detects directory traversal sequences', () => {
    expect(containsPathTraversal('../etc/passwd')).toBe(true);
    expect(containsPathTraversal('foo/bar/../../secret')).toBe(true);
    expect(containsPathTraversal('..')).toBe(true);
    expect(containsPathTraversal('foo/../bar')).toBe(true);
    expect(containsPathTraversal('valid/nested/file.txt')).toBe(false);
  });

  it('validates paths inside root directory', () => {
    expect(isPathInsideRoot('/home/user/project/file.txt', '/home/user/project')).toBe(true);
    expect(isPathInsideRoot('/home/user/project/sub/dir/app.js', '/home/user/project')).toBe(true);
    expect(isPathInsideRoot('/home/user/other-project/file.txt', '/home/user/project')).toBe(false);
    expect(isPathInsideRoot('/etc/shadow', '/home/user/project')).toBe(false);
  });

  it('normalizes relative paths across operating systems', () => {
    expect(normalizeRelativePath('folder\\sub\\file.txt')).toBe('folder/sub/file.txt');
    expect(normalizeRelativePath('./folder/sub/file.txt')).toBe('folder/sub/file.txt');
    expect(normalizeRelativePath('/root/file.txt')).toBe('root/file.txt');
  });
});
