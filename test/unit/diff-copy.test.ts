import { describe, it, expect } from 'vitest';
import {
  normalizeLineChanges,
  findChunkAtLine,
  findClosestChunk,
  executeChunkCopyL2R,
  executeChunkCopyR2L,
  executeSelectedLinesCopyL2R,
  executeSelectedLinesCopyR2L,
  collapseEditorGapViewZones,
  spliceLines,
  DiffChunk,
  computeUnchangedRanges,
  computeDiffRanges,
  mapLineNumber,
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

  it('finds the chunk enclosing a line number or sitting at a gap', () => {
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

    // Right side gap lookup at line 74 and 75
    expect(findChunkAtLine(chunks, 74, 'right')?.id).toBe('1');
    expect(findChunkAtLine(chunks, 75, 'right')?.id).toBe('1');

    expect(findChunkAtLine(chunks, 96, 'right')?.id).toBe('2');
  });

  it('finds the closest chunk when clicking near a diff', () => {
    const chunks: DiffChunk[] = [
      {
        id: 'chunk_1',
        originalStart: 10,
        originalEnd: 12,
        modifiedStart: 10,
        modifiedEnd: 12,
      },
      {
        id: 'chunk_2',
        originalStart: 2981,
        originalEnd: 2985,
        modifiedStart: 2980,
        modifiedEnd: 0,
      },
    ];

    expect(findClosestChunk(chunks, 2980, 'left')?.id).toBe('chunk_2');
    expect(findClosestChunk(chunks, 2983, 'left')?.id).toBe('chunk_2');
    expect(findClosestChunk(chunks, 2988, 'left')?.id).toBe('chunk_2');
    expect(findClosestChunk(chunks, 11, 'left')?.id).toBe('chunk_1');
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

  it('executes selective lines copy L2R for only chosen lines within a larger diff', () => {
    let pushedText = '';
    const mockOriginal = {
      getLineCount: () => 100,
      getLineMaxColumn: () => 50,
      getValueInRange: ({ startLineNumber, endLineNumber }: any) => {
        if (startLineNumber === 74 && endLineNumber === 75) {
          return '<diam_local_fqdn_port>\n<name>diam2_port0</name>';
        }
        return '';
      },
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
      modifiedEnd: 74,
    };

    const outRange = { startLine: 0, endLine: 0 };
    const res = executeSelectedLinesCopyL2R(
      mockOriginal,
      mockModified,
      { startLine: 74, endLine: 75 },
      chunk,
      outRange
    );

    expect(res).toBe(true);
    expect(pushedText).toBe('<diam_local_fqdn_port>\n<name>diam2_port0</name>');
    expect(outRange.startLine).toBe(74);
    expect(outRange.endLine).toBe(75);
  });

  it('executes selective lines copy R2L for only chosen lines', () => {
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
      getValueInRange: ({ startLineNumber, endLineNumber }: any) => {
        if (startLineNumber === 74 && endLineNumber === 75) {
          return '<mod_line_1>\n<mod_line_2>';
        }
        return '';
      },
    };

    const chunk: DiffChunk = {
      id: '1',
      originalStart: 74,
      originalEnd: 87,
      modifiedStart: 74,
      modifiedEnd: 80,
    };

    const outRange = { startLine: 0, endLine: 0 };
    const res = executeSelectedLinesCopyR2L(
      mockOriginal,
      mockModified,
      { startLine: 74, endLine: 75 },
      chunk,
      outRange
    );

    expect(res).toBe(true);
    expect(pushedText).toBe('<mod_line_1>\n<mod_line_2>');
    expect(outRange.startLine).toBe(74);
    expect(outRange.endLine).toBe(75);
  });

  it('executes selective 2-line copy from a 14-line diff against a 1-line diff without deleting unchanged lines', () => {
    let pushedRange: any = null;
    let pushedText = '';
    const mockOriginal = {
      getLineCount: () => 100,
      getLineMaxColumn: () => 50,
      getValueInRange: ({ startLineNumber, endLineNumber }: any) => {
        if (startLineNumber === 74 && endLineNumber === 75) {
          return '<diam_local_fqdn_port>\n<name>diam2_port0</name>';
        }
        return '';
      },
    };
    const mockModified = {
      getLineCount: () => 90,
      getLineMaxColumn: () => 50,
      pushEditOperations: (_before: any, edits: any[]) => {
        pushedRange = edits[0].range;
        pushedText = edits[0].text;
      },
    };

    // 14 lines on left (74-87), but only 1 line on right (74-74)
    const chunk: DiffChunk = {
      id: '1',
      originalStart: 74,
      originalEnd: 87,
      modifiedStart: 74,
      modifiedEnd: 74,
    };

    const outRange = { startLine: 0, endLine: 0 };
    const res = executeSelectedLinesCopyL2R(
      mockOriginal,
      mockModified,
      { startLine: 74, endLine: 75 },
      chunk,
      outRange
    );

    expect(res).toBe(true);
    // It should replace ONLY line 74 on right, preserving line 75 (which is unchanged)
    expect(pushedRange.startLineNumber).toBe(74);
    expect(pushedRange.endLineNumber).toBe(74);
    expect(pushedText).toBe('<diam_local_fqdn_port>\n<name>diam2_port0</name>');
    expect(outRange.startLine).toBe(74);
    expect(outRange.endLine).toBe(75);
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

  describe('Beyond Compare View Filtering (Hidden Ranges)', () => {
    const chunks: DiffChunk[] = [
      {
        id: 'chunk_1',
        originalStart: 5,
        originalEnd: 5,
        modifiedStart: 5,
        modifiedEnd: 5,
      },
      {
        id: 'chunk_2',
        originalStart: 20,
        originalEnd: 22,
        modifiedStart: 20,
        modifiedEnd: 23,
      },
    ];

    it('computeUnchangedRanges isolates diffs and hides identical lines', () => {
      const unchanged = computeUnchangedRanges(chunks, 26, 'left');
      expect(unchanged).toEqual([
        { startLineNumber: 1, startColumn: 1, endLineNumber: 4, endColumn: 1 },
        { startLineNumber: 6, startColumn: 1, endLineNumber: 19, endColumn: 1 },
        { startLineNumber: 23, startColumn: 1, endLineNumber: 26, endColumn: 1 },
      ]);
    });

    it('computeDiffRanges isolates identical lines and hides diffs', () => {
      const diffRanges = computeDiffRanges(chunks, 'left');
      expect(diffRanges).toEqual([
        { startLineNumber: 5, startColumn: 1, endLineNumber: 5, endColumn: 1 },
        { startLineNumber: 20, startColumn: 1, endLineNumber: 22, endColumn: 1 },
      ]);
    });
  });

  describe('Zero-Jerk View Zone Collapse', () => {
    it('synchronously removes matching gap view zones to prevent visual jump', () => {
      const removedZones: string[] = [];
      const mockEditor = {
        getWhitespaces: () => [
          { id: 'zone_header', afterLineNumber: 0, height: 20 },
          { id: 'zone_gap_line_1', afterLineNumber: 1, height: 22 },
          { id: 'zone_far_away', afterLineNumber: 80, height: 44 },
        ],
        changeViewZones: (cb: (accessor: any) => void) => {
          cb({
            removeZone: (id: string) => {
              removedZones.push(id);
            },
          });
        },
      };

      collapseEditorGapViewZones(mockEditor, 1);
      expect(removedZones).toContain('zone_gap_line_1');
      expect(removedZones).not.toContain('zone_far_away');
    });

    it('executeChunkCopyL2R collapses target editor gap viewzone before insertion', () => {
      const removedZones: string[] = [];
      let pushedEdits: any[] = [];
      const mockOriginal = {
        getLineCount: () => 10,
        getLineMaxColumn: () => 50,
        getValueInRange: () => '<encryption>false</encryption>',
      };
      const mockModified = {
        getLineCount: () => 2,
        getLineMaxColumn: () => 50,
        pushEditOperations: (_state: any, edits: any[]) => {
          pushedEdits = edits;
        },
      };
      const mockEditor = {
        getWhitespaces: () => [{ id: 'zone_gap_line_1', afterLineNumber: 1, height: 22 }],
        changeViewZones: (cb: (accessor: any) => void) => {
          cb({
            removeZone: (id: string) => {
              removedZones.push(id);
            },
          });
        },
      };

      const chunk: DiffChunk = {
        id: 'chunk_gap',
        originalStart: 2,
        originalEnd: 2,
        modifiedStart: 1,
        modifiedEnd: 0,
      };

      const outRange = { startLine: 0, endLine: 0 };
      executeChunkCopyL2R(mockOriginal, mockModified, chunk, outRange, mockEditor);

      expect(removedZones).toEqual(['zone_gap_line_1']);
      expect(pushedEdits.length).toBe(1);
      expect(pushedEdits[0].text).toBe('<encryption>false</encryption>\n');
      expect(pushedEdits[0].range).toEqual({
        startLineNumber: 2,
        startColumn: 1,
        endLineNumber: 2,
        endColumn: 1,
      });
    });

    it('ensures inserting into an alignment gap never concatenates with following line', () => {
      const source = '<sys>\n<encryption>false</encryption>\n<nsid>TEST</nsid>';
      const target = '<sys>\n<nsid>TEST</nsid>';
      // Splice source line 2 into target gap between line 1 and line 2 (targetStart: 2, targetEnd: 0)
      const result = spliceLines(source, target, 2, 2, 2, 0);
      const lines = result.split('\n');
      expect(lines.length).toBe(3);
      expect(lines[0]).toBe('<sys>');
      expect(lines[1]).toBe('<encryption>false</encryption>');
      expect(lines[2]).toBe('<nsid>TEST</nsid>');
    });
  });

  describe('mapLineNumber & Non-Overlapping Selection Copy', () => {
    const chunkAtLine2: DiffChunk = {
      id: 'chunk_gap_line_2',
      originalStart: 2,
      originalEnd: 2,
      modifiedStart: 1,
      modifiedEnd: 0,
    };

    it('maps line numbers accurately before, inside, and after diff gaps', () => {
      // Line 1 is before Chunk 1
      expect(mapLineNumber([chunkAtLine2], 1, 'left')).toBe(1);
      expect(mapLineNumber([chunkAtLine2], 1, 'right')).toBe(1);

      // Line 2 on left is inside Chunk 1 (which has 0 lines on right, anchored at line 1)
      expect(mapLineNumber([chunkAtLine2], 2, 'left')).toBe(1);

      // Lines after Chunk 1: Left lines are shifted by -1 on Right because Left has +1 line in Chunk 1
      expect(mapLineNumber([chunkAtLine2], 3, 'left')).toBe(2);
      expect(mapLineNumber([chunkAtLine2], 7, 'left')).toBe(6);
      expect(mapLineNumber([chunkAtLine2], 8, 'left')).toBe(7);
      expect(mapLineNumber([chunkAtLine2], 9, 'left')).toBe(8);

      // Reverse direction: Right lines are shifted by +1 on Left
      expect(mapLineNumber([chunkAtLine2], 2, 'right')).toBe(3);
      expect(mapLineNumber([chunkAtLine2], 6, 'right')).toBe(7);
      expect(mapLineNumber([chunkAtLine2], 7, 'right')).toBe(8);
      expect(mapLineNumber([chunkAtLine2], 8, 'right')).toBe(9);
    });

    it('never hijacks an unrelated diff gap above when copying selected lines L2R', () => {
      let pushedEdits: any[] = [];
      const mockOriginal = {
        getLineCount: () => 10,
        getLineMaxColumn: () => 60,
        getValueInRange: ({ startLineNumber, endLineNumber }: any) => {
          if (startLineNumber === 7 && endLineNumber === 9) {
            return '<item name="5">epsilon</item>\n<item name="6">zeta</item>\n<item name="7">eta</item>';
          }
          return '';
        },
      };
      const mockModified = {
        getLineCount: () => 9,
        getLineMaxColumn: () => 60,
        pushEditOperations: (_before: any, edits: any[]) => {
          pushedEdits = edits;
        },
      };

      const outRange = { startLine: 0, endLine: 0 };
      // User selects lines 7–9. Even if caller mistakenly passes chunkAtLine2 (which does not intersect lines 7–9),
      // the engine must reject chunkAtLine2 and map lines 7–9 to lines 6–8 on the right!
      const res = executeSelectedLinesCopyL2R(
        mockOriginal,
        mockModified,
        { startLine: 7, endLine: 9 },
        chunkAtLine2,
        outRange,
        undefined,
        [chunkAtLine2]
      );

      expect(res).toBe(true);
      expect(pushedEdits.length).toBe(1);
      // Replaces lines 6–8 on right (NEVER inserts at line 2 gap!)
      expect(pushedEdits[0].range.startLineNumber).toBe(6);
      expect(pushedEdits[0].range.endLineNumber).toBe(8);
      expect(pushedEdits[0].text).toContain('<item name="5">epsilon</item>');
      expect(outRange.startLine).toBe(6);
      expect(outRange.endLine).toBe(8);
    });

    it('never hijacks an unrelated diff gap above when copying selected lines R2L', () => {
      let pushedEdits: any[] = [];
      const mockOriginal = {
        getLineCount: () => 10,
        getLineMaxColumn: () => 60,
        pushEditOperations: (_before: any, edits: any[]) => {
          pushedEdits = edits;
        },
      };
      const mockModified = {
        getLineCount: () => 9,
        getLineMaxColumn: () => 60,
        getValueInRange: ({ startLineNumber, endLineNumber }: any) => {
          if (startLineNumber === 6 && endLineNumber === 8) {
            return '<item name="5">epsilon</item>\n<item name="6">zeta</item>\n<item name="7">eta</item>';
          }
          return '';
        },
      };

      const outRange = { startLine: 0, endLine: 0 };
      const res = executeSelectedLinesCopyR2L(
        mockOriginal,
        mockModified,
        { startLine: 6, endLine: 8 },
        chunkAtLine2,
        outRange,
        undefined,
        [chunkAtLine2]
      );

      expect(res).toBe(true);
      expect(pushedEdits.length).toBe(1);
      // Replaces lines 7–9 on left
      expect(pushedEdits[0].range.startLineNumber).toBe(7);
      expect(pushedEdits[0].range.endLineNumber).toBe(9);
      expect(pushedEdits[0].text).toContain('<item name="5">epsilon</item>');
      expect(outRange.startLine).toBe(7);
      expect(outRange.endLine).toBe(9);
    });
  });
});
