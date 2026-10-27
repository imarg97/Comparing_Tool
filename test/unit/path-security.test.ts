import { describe, it, expect } from 'vitest';
import {
  containsPathTraversal,
  isPathInsideRoot,
  normalizeRelativePath,
  canonicalizePath,
  isWindowsReservedDeviceName,
} from '../../src/shared/comparison-engine/path-security.js';

describe('Path Security & Traversal Prevention', () => {
  it('detects directory traversal sequences', () => {
    expect(containsPathTraversal('../etc/passwd')).toBe(true);
    expect(containsPathTraversal('foo/bar/../../secret')).toBe(true);
    expect(containsPathTraversal('..')).toBe(true);
    expect(containsPathTraversal('foo/../bar')).toBe(true);
    expect(containsPathTraversal('valid/nested/file.txt')).toBe(false);
  });

  it('detects encoded traversal sequences and null bytes', () => {
    expect(containsPathTraversal('foo/%2e%2e/bar')).toBe(true);
    expect(containsPathTraversal('foo/bar\0.txt')).toBe(true);
    expect(containsPathTraversal('foo/..%2fbar')).toBe(true);
  });

  it('canonicalizes paths collapsing redundant slashes and dots', () => {
    expect(canonicalizePath('/home/user/./project/../other/file.txt')).toBe('/home/user/other/file.txt');
    expect(canonicalizePath('C:\\Users\\User\\..\\Admin\\secret.txt')).toBe('C:/Users/Admin/secret.txt');
    expect(canonicalizePath('/root/../../etc/passwd')).toBe('/etc/passwd');
  });

  it('validates paths inside root directory and blocks traversal escapes', () => {
    expect(isPathInsideRoot('/home/user/project/file.txt', '/home/user/project')).toBe(true);
    expect(isPathInsideRoot('/home/user/project/sub/dir/app.js', '/home/user/project')).toBe(true);
    expect(isPathInsideRoot('/home/user/other-project/file.txt', '/home/user/project')).toBe(false);
    expect(isPathInsideRoot('/etc/shadow', '/home/user/project')).toBe(false);

    // Critical security check: candidate attempting traversal out of root
    expect(isPathInsideRoot('/home/user/project/../../etc/passwd', '/home/user/project')).toBe(false);
    expect(isPathInsideRoot('/home/user/project/../other', '/home/user/project')).toBe(false);
    expect(isPathInsideRoot('/home/user/project/sub/../../project/file.txt', '/home/user/project')).toBe(true);
  });

  it('identifies Windows reserved device names', () => {
    expect(isWindowsReservedDeviceName('CON')).toBe(true);
    expect(isWindowsReservedDeviceName('prn.txt')).toBe(true);
    expect(isWindowsReservedDeviceName('aux')).toBe(true);
    expect(isWindowsReservedDeviceName('NUL')).toBe(true);
    expect(isWindowsReservedDeviceName('COM1')).toBe(true);
    expect(isWindowsReservedDeviceName('LPT9')).toBe(true);
    expect(isWindowsReservedDeviceName('safe_file.txt')).toBe(false);
    expect(isWindowsReservedDeviceName('contact.json')).toBe(false);
  });

  it('normalizes relative paths across operating systems', () => {
    expect(normalizeRelativePath('folder\\sub\\file.txt')).toBe('folder/sub/file.txt');
    expect(normalizeRelativePath('./folder/sub/file.txt')).toBe('folder/sub/file.txt');
    expect(normalizeRelativePath('/root/file.txt')).toBe('root/file.txt');
  });
});
