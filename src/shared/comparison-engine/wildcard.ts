/**
 * Wildcard & Ignore Pattern Matching
 */

export function patternToRegex(pattern: string, caseSensitive: boolean): RegExp {
  const flags = caseSensitive ? '' : 'i';
  const trimmed = pattern.trim();

  // Escape special regex characters except * and ?
  let regexStr = trimmed
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');

  // If pattern does not contain slash, it matches anywhere in the path segment or file name
  if (!pattern.includes('/')) {
    regexStr = `(^|/)${regexStr}($|/)`;
  } else {
    // Exact or prefix match
    regexStr = `^${regexStr}`;
  }

  return new RegExp(regexStr, flags);
}

export function shouldIgnorePath(
  relPath: string,
  ignorePatterns: string[],
  caseSensitive: boolean = true
): boolean {
  if (!ignorePatterns || ignorePatterns.length === 0) return false;

  const normalized = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const segments = normalized.split('/');
  const fileName = segments[segments.length - 1];

  for (const pattern of ignorePatterns) {
    if (!pattern || pattern.trim() === '') continue;
    const cleanPattern = pattern.trim();

    // Fast check for exact segment match
    if (!cleanPattern.includes('*') && !cleanPattern.includes('?')) {
      const matchKey = caseSensitive ? cleanPattern : cleanPattern.toLowerCase();
      const targetName = caseSensitive ? fileName : fileName.toLowerCase();

      if (targetName === matchKey) return true;

      // Check if any directory segment matches
      if (!cleanPattern.includes('/')) {
        const hasMatchingSegment = segments.some((seg) =>
          caseSensitive ? seg === matchKey : seg.toLowerCase() === matchKey
        );
        if (hasMatchingSegment) return true;
      }
    }

    try {
      const regex = patternToRegex(cleanPattern, caseSensitive);
      if (regex.test(normalized) || regex.test(fileName)) {
        return true;
      }
    } catch {
      // Fallback simple substring
      if (normalized.includes(cleanPattern)) return true;
    }
  }

  return false;
}
