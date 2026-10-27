/**
 * Path Security & Traversal Prevention Module
 */

/**
 * Normalizes relative path for cross-platform keys (forward slashes, stripped prefixes)
 */
export function normalizeRelativePath(relPath: string): string {
  if (!relPath) return '';
  const cleaned = relPath.replace(/\\/g, '/');
  return cleaned.replace(/^\/+/, '').replace(/^\.\//, '');
}

/**
 * Canonicalizes a path string by collapsing redundant slashes, '.' and '..' segments
 * without relying on platform-specific Node APIs (safe for both browser and Node).
 */
export function canonicalizePath(p: string): string {
  if (!p || typeof p !== 'string') return '';
  if (p.includes('\0')) return '';

  // Decode URI encoding if present
  let decoded = p;
  try {
    decoded = decodeURIComponent(p);
  } catch {
    // Malformed URI encoding
    return '';
  }

  // Replace backslashes with forward slashes
  let normalized = decoded.replace(/\\/g, '/');

  // Check for Windows drive letter (e.g. C:/ or c:/)
  const driveMatch = normalized.match(/^([a-zA-Z]:)(\/.*|$)/);
  let prefix = '';
  if (driveMatch) {
    prefix = driveMatch[1] + '/';
    normalized = driveMatch[2] ? driveMatch[2].replace(/^\/+/, '') : '';
  } else if (normalized.startsWith('/')) {
    prefix = '/';
    normalized = normalized.replace(/^\/+/, '');
  }

  const parts = normalized.split('/').filter((part) => part !== '' && part !== '.');
  const stack: string[] = [];

  for (const part of parts) {
    if (part === '..') {
      if (stack.length > 0 && stack[stack.length - 1] !== '..') {
        stack.pop();
      } else if (!prefix) {
        stack.push('..');
      }
    } else {
      stack.push(part);
    }
  }

  return prefix + stack.join('/');
}

/**
 * Validates that a candidate target path does not escape the specified root directory.
 * Resolves directory traversal attacks via '..' and verifies root containment.
 */
export function isPathInsideRoot(candidatePath: string, rootDir: string): boolean {
  if (!candidatePath || !rootDir) return false;
  if (candidatePath.includes('\0') || rootDir.includes('\0')) return false;

  const canonicalRoot = canonicalizePath(rootDir).replace(/\/+$/, '');
  const canonicalCandidate = canonicalizePath(candidatePath).replace(/\/+$/, '');

  if (!canonicalRoot || !canonicalCandidate) return false;

  // Exact match
  if (canonicalCandidate === canonicalRoot) return true;

  // Root must be a prefix followed by slash
  const rootWithSlash = canonicalRoot + '/';

  // Support case-insensitive file systems (macOS and Windows)
  const isCaseInsensitive =
    typeof process !== 'undefined' && (process.platform === 'darwin' || process.platform === 'win32');

  if (isCaseInsensitive) {
    return canonicalCandidate.toLowerCase().startsWith(rootWithSlash.toLowerCase());
  }

  return canonicalCandidate.startsWith(rootWithSlash);
}

/**
 * Checks if a relative or absolute path contains path traversal sequences like '..'
 * or null bytes or encoded traversal attempts.
 */
export function containsPathTraversal(relPath: string): boolean {
  if (!relPath || typeof relPath !== 'string') return false;
  if (relPath.includes('\0')) return true;

  let decoded = relPath;
  try {
    decoded = decodeURIComponent(relPath);
  } catch {
    return true;
  }

  const normalized = decoded.replace(/\\/g, '/');
  const parts = normalized.split('/');

  for (const part of parts) {
    if (part === '..' || part === '%2e%2e' || part.includes('..')) {
      return true;
    }
  }

  // Also verify that canonicalizing doesn't produce leading '..'
  const canonical = canonicalizePath(relPath);
  if (canonical.startsWith('..') || canonical.includes('/../')) {
    return true;
  }

  return false;
}

/**
 * Identifies Windows reserved device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
 */
export function isWindowsReservedDeviceName(fileName: string): boolean {
  if (!fileName || typeof fileName !== 'string') return false;
  const base = fileName.split(/[/\\]/).pop()?.split('.')[0] || '';
  const reservedRegex = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
  return reservedRegex.test(base);
}

