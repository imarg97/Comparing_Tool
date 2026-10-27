/**
 * Secure Recursive Directory Scanner (Main Process)
 */

import * as fs from 'fs';
import * as path from 'path';
import { FolderComparisonOptions, ScanProgress } from '../../shared/types.js';
import { shouldIgnorePath } from '../../shared/comparison-engine/wildcard.js';
import { isPathInsideRoot } from '../../shared/comparison-engine/path-security.js';
import { ScannedItem } from '../../shared/comparison-engine/matcher.js';
import { computeFileHash } from './hasher.js';

export interface ScanContext {
  isCancelled: boolean;
  onProgress?: (progress: ScanProgress) => void;
}

export async function scanDirectory(
  rootDir: string,
  options: FolderComparisonOptions,
  context: ScanContext,
  phase: 'scanning-left' | 'scanning-right'
): Promise<Map<string, ScannedItem>> {
  const items = new Map<string, ScannedItem>();
  const visitedRealpaths = new Set<string>();

  let resolvedRoot: string = '';
  // Resolve root strictly relative to current working directory or absolute path
  const normalizedCandidate = path.resolve(rootDir);

  try {
    if (fs.existsSync(normalizedCandidate)) {
      resolvedRoot = fs.realpathSync(normalizedCandidate);
    }
  } catch {
    // fallback to direct realpath attempt
  }

  if (!resolvedRoot) {
    try {
      resolvedRoot = fs.realpathSync(rootDir);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      items.set('', {
        relativePath: '',
        name: path.basename(rootDir),
        isDirectory: true,
        metadata: {
          exists: false,
          size: 0,
          mtime: 0,
          isDirectory: true,
          isSymlink: false,
          readable: false,
          error: `Cannot resolve directory: ${errorMsg}`,
        },
      });
      return items;
    }
  }

  visitedRealpaths.add(resolvedRoot);
  let scannedCount = 0;

  async function walk(currentDir: string, currentRelDir: string) {
    if (context.isCancelled) return;

    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const rel = currentRelDir.replace(/\\/g, '/');
      items.set(rel, {
        relativePath: rel,
        name: path.basename(currentDir),
        isDirectory: true,
        metadata: {
          exists: true,
          size: 0,
          mtime: 0,
          isDirectory: true,
          isSymlink: false,
          readable: false,
          error: `Permission or read error: ${errorMsg}`,
        },
      });
      return;
    }

    for (const entry of entries) {
      if (context.isCancelled) return;

      const fullPath = path.join(currentDir, entry.name);
      const relPath = currentRelDir ? `${currentRelDir}/${entry.name}` : entry.name;
      const normalizedRelPath = relPath.replace(/\\/g, '/');

      // Check ignore patterns
      if (shouldIgnorePath(normalizedRelPath, options.ignorePatterns, options.caseSensitive)) {
        continue;
      }

      scannedCount++;
      if (scannedCount % 50 === 0 && context.onProgress) {
        context.onProgress({
          currentPath: normalizedRelPath,
          scannedCount,
          phase,
        });
      }

      let isSymlink = entry.isSymbolicLink();
      let symlinkTarget: string | undefined;

      if (isSymlink) {
        try {
          symlinkTarget = await fs.promises.readlink(fullPath);
        } catch {
          symlinkTarget = '<unknown>';
        }

        // If followSymlinks is enabled, verify target does not escape resolvedRoot
        if (options.followSymlinks) {
          try {
            const realTarget = fs.realpathSync(fullPath);
            if (!isPathInsideRoot(realTarget, resolvedRoot)) {
              items.set(normalizedRelPath, {
                relativePath: normalizedRelPath,
                name: entry.name,
                isDirectory: false,
                metadata: {
                  exists: true,
                  size: 0,
                  mtime: 0,
                  isDirectory: false,
                  isSymlink: true,
                  symlinkTarget: symlinkTarget || realTarget,
                  readable: false,
                  error: 'Symlink points outside root directory; traversal blocked for security.',
                },
              });
              continue;
            }
          } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            items.set(normalizedRelPath, {
              relativePath: normalizedRelPath,
              name: entry.name,
              isDirectory: false,
              metadata: {
                exists: true,
                size: 0,
                mtime: 0,
                isDirectory: false,
                isSymlink: true,
                symlinkTarget,
                readable: false,
                error: `Broken or inaccessible symlink: ${errorMsg}`,
              },
            });
            continue;
          }
        }
      }

      // Read stat
      let stat: fs.Stats;
      try {
        stat = options.followSymlinks
          ? await fs.promises.stat(fullPath)
          : await fs.promises.lstat(fullPath);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        items.set(normalizedRelPath, {
          relativePath: normalizedRelPath,
          name: entry.name,
          isDirectory: false,
          metadata: {
            exists: true,
            size: 0,
            mtime: 0,
            isDirectory: false,
            isSymlink,
            symlinkTarget,
            readable: false,
            error: errorMsg,
          },
        });
        continue;
      }

      if (stat.isDirectory()) {
        // Symlink recursion loop protection
        let realDir = fullPath;
        try {
          realDir = fs.realpathSync(fullPath);
        } catch {
          // ignore
        }

        if (visitedRealpaths.has(realDir)) {
          // Symlink loop detected!
          items.set(normalizedRelPath, {
            relativePath: normalizedRelPath,
            name: entry.name,
            isDirectory: true,
            metadata: {
              exists: true,
              size: 0,
              mtime: stat.mtimeMs,
              isDirectory: true,
              isSymlink,
              symlinkTarget,
              readable: false,
              error: 'Recursive symlink loop detected; skipped directory.',
            },
          });
          continue;
        }

        visitedRealpaths.add(realDir);

        items.set(normalizedRelPath, {
          relativePath: normalizedRelPath,
          name: entry.name,
          isDirectory: true,
          metadata: {
            exists: true,
            size: 0,
            mtime: stat.mtimeMs,
            isDirectory: true,
            isSymlink,
            symlinkTarget,
            readable: true,
          },
        });

        await walk(fullPath, normalizedRelPath);
      } else {
        // Regular file
        let hash: string | undefined;
        let fileError: string | undefined;

        if (options.compareContentStrategy === 'hash') {
          try {
            hash = await computeFileHash(fullPath);
          } catch (err: unknown) {
            fileError = err instanceof Error ? err.message : String(err);
          }
        }

        items.set(normalizedRelPath, {
          relativePath: normalizedRelPath,
          name: entry.name,
          isDirectory: false,
          metadata: {
            exists: true,
            size: stat.size,
            mtime: stat.mtimeMs,
            hash,
            isDirectory: false,
            isSymlink,
            symlinkTarget,
            readable: !fileError,
            error: fileError,
          },
        });
      }
    }
  }

  await walk(resolvedRoot, '');

  if (context.onProgress) {
    context.onProgress({
      currentPath: '',
      scannedCount,
      phase,
    });
  }

  return items;
}
