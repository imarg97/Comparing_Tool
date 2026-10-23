/**
 * Safe Filesystem Operations (Main Process)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  CopyRequest,
  CopyResult,
  FileContentResult,
  SaveRequest,
  SaveResult,
} from '../../shared/types.js';
import { containsPathTraversal } from '../../shared/comparison-engine/path-security.js';
import { computeFileHash } from './hasher.js';

export const MAX_SAFE_FILE_SIZE = 5 * 1024 * 1024; // 5 MB threshold for warning / preview

export async function readSafeFile(
  filePath: string,
  maxBytes: number = MAX_SAFE_FILE_SIZE
): Promise<FileContentResult> {
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    return {
      path: resolved,
      content: '',
      encoding: 'utf-8',
      size: 0,
      mtime: 0,
      isTruncated: false,
      hash: '',
      error: `File does not exist: ${resolved}`,
    };
  }

  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(resolved);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      path: resolved,
      content: '',
      encoding: 'utf-8',
      size: 0,
      mtime: 0,
      isTruncated: false,
      hash: '',
      error: `Cannot stat file: ${msg}`,
    };
  }

  if (stat.isDirectory()) {
    return {
      path: resolved,
      content: '',
      encoding: 'utf-8',
      size: 0,
      mtime: stat.mtimeMs,
      isTruncated: false,
      hash: '',
      error: `Selected path is a directory, not a regular file.`,
    };
  }

  const isTruncated = stat.size > maxBytes;
  let buffer: Buffer;

  try {
    if (isTruncated) {
      // Read only maxBytes
      const handle = await fs.promises.open(resolved, 'r');
      buffer = Buffer.alloc(maxBytes);
      await handle.read(buffer, 0, maxBytes, 0);
      await handle.close();
    } else {
      buffer = await fs.promises.readFile(resolved);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      path: resolved,
      content: '',
      encoding: 'utf-8',
      size: stat.size,
      mtime: stat.mtimeMs,
      isTruncated: false,
      hash: '',
      error: `Failed to read file contents: ${msg}`,
    };
  }

  // Detect binary content (null bytes check)
  const isBinary = buffer.slice(0, 1024).includes(0);
  if (isBinary) {
    return {
      path: resolved,
      content: `[DiffX Warning: Binary file detected (${stat.size} bytes). Raw text display disabled to prevent corruption.]`,
      encoding: 'binary',
      size: stat.size,
      mtime: stat.mtimeMs,
      isTruncated: false,
      hash: '',
      error: 'Binary file detected',
    };
  }

  let hash = '';
  try {
    hash = await computeFileHash(resolved);
  } catch {
    // Non-critical hash failure
  }

  return {
    path: resolved,
    content: buffer.toString('utf-8'),
    encoding: 'utf-8',
    size: stat.size,
    mtime: stat.mtimeMs,
    isTruncated,
    hash,
  };
}

export async function saveSafeFile(request: SaveRequest): Promise<SaveResult> {
  const targetPath = path.resolve(request.filePath);

  if (containsPathTraversal(request.filePath)) {
    return {
      success: false,
      filePath: targetPath,
      bytesWritten: 0,
      error: 'Security exception: Path traversal sequence detected.',
    };
  }

  let backupPath: string | undefined;

  // Create backup if requested and file already exists
  if (request.createBackup && fs.existsSync(targetPath)) {
    try {
      backupPath = `${targetPath}.bak.${Date.now()}`;
      await fs.promises.copyFile(targetPath, backupPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        filePath: targetPath,
        bytesWritten: 0,
        error: `Failed to create safety backup: ${msg}`,
      };
    }
  }

  // Atomic write via temp file in same directory
  const parentDir = path.dirname(targetPath);
  await fs.promises.mkdir(parentDir, { recursive: true });

  const tempFile = path.join(
    parentDir,
    `.diffx_tmp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  );

  try {
    await fs.promises.writeFile(tempFile, request.content, 'utf-8');
    await fs.promises.rename(tempFile, targetPath);
    const stat = await fs.promises.stat(targetPath);

    return {
      success: true,
      filePath: targetPath,
      bytesWritten: stat.size,
      backupPath,
    };
  } catch (err: unknown) {
    // Clean up temp file
    if (fs.existsSync(tempFile)) {
      try {
        await fs.promises.unlink(tempFile);
      } catch {
        // ignore
      }
    }
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      filePath: targetPath,
      bytesWritten: 0,
      error: `Failed to write file: ${msg}`,
    };
  }
}

export async function copySafeFile(request: CopyRequest): Promise<CopyResult> {
  const src = path.resolve(request.sourcePath);
  const dest = path.resolve(request.destinationPath);

  if (containsPathTraversal(request.destinationPath)) {
    return {
      success: false,
      sourcePath: src,
      destinationPath: dest,
      error: 'Security exception: Destination contains path traversal sequences.',
    };
  }

  if (!fs.existsSync(src)) {
    return {
      success: false,
      sourcePath: src,
      destinationPath: dest,
      error: `Source file does not exist: ${src}`,
    };
  }

  const destExists = fs.existsSync(dest);
  if (destExists && !request.overwrite) {
    return {
      success: false,
      sourcePath: src,
      destinationPath: dest,
      error: `Destination file already exists and overwrite flag was not confirmed.`,
    };
  }

  let backupPath: string | undefined;
  if (destExists && request.createBackup) {
    try {
      backupPath = `${dest}.bak.${Date.now()}`;
      await fs.promises.copyFile(dest, backupPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        sourcePath: src,
        destinationPath: dest,
        error: `Could not create safety backup before copy: ${msg}`,
      };
    }
  }

  try {
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.copyFile(src, dest);

    return {
      success: true,
      sourcePath: src,
      destinationPath: dest,
      backupPath,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      sourcePath: src,
      destinationPath: dest,
      error: `Failed to copy file: ${msg}`,
    };
  }
}
