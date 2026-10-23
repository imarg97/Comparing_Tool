import { describe, it, expect } from 'vitest';
import {
  normalizeLineChanges,
  findChunkAtLine,
  executeChunkCopyL2R,
  executeChunkCopyR2L,
  spliceLines,
  DiffChunk,
} from '../../src/shared/comparison-engine/diff-copy.js';

describe('Diff Copy Engine', () => {
  it('normalizes line changes correctly', () => {
    const raw = [
      {
        originalStartLineNumber: 74,
        originalEndLineNumber: 87,
        modifiedStartLineNumber: 74,
        modifiedEndLineNumber: 0,
      },
    ];
    const chunks = normalizeLineChanges(raw);
    expect(chunks.length).toBe(1);
    expect(chunks[0].originalStart).toBe(74);
    expect(chunks[0].originalEnd).toBe(87);
    expect(chunks[0].modifiedStart).toBe(74);
    expect(chunks[0].modifiedEnd).toBe(0);
  });

  it('finds the chunk enclosing a line number', () => {
    const chunks: DiffChunk[] = [
      {
        id: '1',
        originalStart: 74,
        originalEnd: 87,
        modifiedStart: 74,
        modifiedEnd: 0,
      },
      {
        id: '2',
        originalStart: 100,
        originalEnd: 105,
        modifiedStart: 95,
        modifiedEnd: 98,
      },
    ];

    expect(findChunkAtLine(chunks, 74, 'left')?.id).toBe('1');
    expect(findChunkAtLine(chunks, 80, 'left')?.id).toBe('1');
    expect(findChunkAtLine(chunks, 87, 'left')?.id).toBe('1');
    expect(findChunkAtLine(chunks, 73, 'left')).toBeNull();
    expect(findChunkAtLine(chunks, 88, 'left')).toBeNull();

    expect(findChunkAtLine(chunks, 96, 'right')?.id).toBe('2');
  });

  it('executes chunk copy L2R using mock models', () => {
    let pushedText = '';
    const mockOriginal = {
      getLineCount: () => 100,
      getLineMaxColumn: () => 50,
      getValueInRange: () => '<diam_local_fqdn_port>test</diam_local_fqdn_port>',
    };
    const mockModified = {
      getLineCount: () => 90,
      getLineMaxColumn: () => 50,
      pushEditOperations: (_before: any, edits: any[]) => {
        pushedText = edits[0].text;
      },
    };

    const chunk: DiffChunk = {
      id: '1',
      originalStart: 74,
      originalEnd: 87,
      modifiedStart: 74,
      modifiedEnd: 0,
    };

    const outRange = { startLine: 0, endLine: 0 };
    const res = executeChunkCopyL2R(mockOriginal, mockModified, chunk, outRange);
    expect(res).toBe(true);
    expect(pushedText).toContain('<diam_local_fqdn_port>');
    expect(outRange.startLine).toBe(75);
    expect(outRange.endLine).toBe(88);
  });

  it('executes chunk copy R2L using mock models', () => {
    let pushedText = '';
    const mockOriginal = {
      getLineCount: () => 100,
      getLineMaxColumn: () => 50,
      pushEditOperations: (_before: any, edits: any[]) => {
        pushedText = edits[0].text;
      },
    };
    const mockModified = {
      getLineCount: () => 90,
      getLineMaxColumn: () => 50,
      getValueInRange: () => '<diam_local_fqdn_port>right</diam_local_fqdn_port>',
    };

    const chunk: DiffChunk = {
      id: '1',
      originalStart: 74,
      originalEnd: 87,
      modifiedStart: 74,
      modifiedEnd: 80,
    };

    const res = executeChunkCopyR2L(mockOriginal, mockModified, chunk);
    expect(res).toBe(true);
    expect(pushedText).toBe('<diam_local_fqdn_port>right</diam_local_fqdn_port>');
  });

  describe('spliceLines direct string splicing', () => {
    it('splices lines cleanly replacing matching line range', () => {
      const left = 'line1\nline2\nline3\nline4';
      const right = 'line1\nold2\nold3\nline4';
      const res = spliceLines(left, right, 2, 3, 2, 3);
      expect(res).toBe('line1\nline2\nline3\nline4');
    });

    it('inserts lines when target end is 0', () => {
      const left = 'tagA\ntagB\ntagC';
      const right = 'first\nlast';
      const res = spliceLines(left, right, 1, 2, 2, 0);
      expect(res).toBe('first\ntagA\ntagB\nlast');
    });
  });
});
