/**
 * Path Security & Traversal Prevention Module
 */

export function normalizeRelativePath(relPath: string): string {
  // Replace backslashes with forward slashes for consistent cross-platform keys
  const cleaned = relPath.replace(/\\/g, '/');
  // Strip leading slashes and redundant current directory markers
  return cleaned.replace(/^\/+/, '').replace(/^\.\//, '');
}

/**
 * Validates that a candidate target path does not escape the specified root directory.
 * Prevents directory traversal attacks via '..' or symlinks.
 */
export function isPathInsideRoot(candidatePath: string, rootDir: string): boolean {
  if (!candidatePath || !rootDir) return false;

  const normalizedRoot = rootDir.replace(/\\/g, '/').replace(/\/+$/, '') + '/';
  const normalizedCandidate = candidatePath.replace(/\\/g, '/').replace(/\/+$/, '');

  // Check prefix or exact root
  return (
    normalizedCandidate === rootDir.replace(/\\/g, '/').replace(/\/+$/, '') ||
    normalizedCandidate.startsWith(normalizedRoot)
  );
}

/**
 * Checks if a relative path contains path traversal sequences like '..'
 */
export function containsPathTraversal(relPath: string): boolean {
  const parts = relPath.replace(/\\/g, '/').split('/');
  return parts.some((p) => p === '..');
}
