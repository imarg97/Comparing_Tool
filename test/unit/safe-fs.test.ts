import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import {
  copySafeFile,
  readSafeFile,
  saveSafeFile,
} from '../../src/main/fs-engine/safe-fs.js';

describe('Safe Filesystem Operations', () => {
  const fixturesDir = path.resolve(__dirname, '../fixtures');
  const tempTestDir = path.resolve(__dirname, '../fixtures/temp_test');

  beforeEach(async () => {
    if (!fs.existsSync(tempTestDir)) {
      await fs.promises.mkdir(tempTestDir, { recursive: true });
    }
  });

  afterEach(async () => {
    if (fs.existsSync(tempTestDir)) {
      await fs.promises.rm(tempTestDir, { recursive: true, force: true });
    }
  });

  it('safely reads valid text files and computes hash', async () => {
    const filePath = path.join(fixturesDir, 'left/identical.txt');
    const res = await readSafeFile(filePath);

    expect(res.error).toBeUndefined();
    expect(res.content).toContain('Hello DiffX Enterprise');
    expect(res.hash).toBeDefined();
    expect(res.hash.length).toBe(64); // SHA-256 hex string
    expect(res.isTruncated).toBe(false);
  });

  it('safely saves text files atomically with backup', async () => {
    const targetFile = path.join(tempTestDir, 'config.txt');
    await fs.promises.writeFile(targetFile, 'initial content');

    const saveRes = await saveSafeFile({
      filePath: targetFile,
      content: 'updated secure content',
      createBackup: true,
    });

    expect(saveRes.success).toBe(true);
    expect(saveRes.backupPath).toBeDefined();

    // Verify written content
    const updatedContent = await fs.promises.readFile(targetFile, 'utf-8');
    expect(updatedContent).toBe('updated secure content');

    // Verify backup content
    if (saveRes.backupPath) {
      const backupContent = await fs.promises.readFile(saveRes.backupPath, 'utf-8');
      expect(backupContent).toBe('initial content');
    }
  });

  it('rejects save requests with path traversal sequences', async () => {
    const saveRes = await saveSafeFile({
      filePath: 'sub/../../forbidden.txt',
      content: 'exploit',
    });

    expect(saveRes.success).toBe(false);
    expect(saveRes.error).toContain('Path traversal');
  });

  it('safely copies files and enforces overwrite confirmation', async () => {
    const src = path.join(fixturesDir, 'left/left_only.txt');
    const dest = path.join(tempTestDir, 'dest.txt');

    // Initial copy without prior file
    const copyRes1 = await copySafeFile({
      sourcePath: src,
      destinationPath: dest,
      overwrite: false,
      createBackup: false,
    });
    expect(copyRes1.success).toBe(true);

    // Copying again when destination exists and overwrite=false should fail
    const copyRes2 = await copySafeFile({
      sourcePath: src,
      destinationPath: dest,
      overwrite: false,
      createBackup: false,
    });
    expect(copyRes2.success).toBe(false);
    expect(copyRes2.error).toContain('already exists');

    // Copying with overwrite=true and createBackup=true should succeed and create .bak
    const copyRes3 = await copySafeFile({
      sourcePath: src,
      destinationPath: dest,
      overwrite: true,
      createBackup: true,
    });
    expect(copyRes3.success).toBe(true);
    expect(copyRes3.backupPath).toBeDefined();
  });
});
