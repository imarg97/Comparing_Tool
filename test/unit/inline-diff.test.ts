import { describe, it, expect } from 'vitest';
import {
  buildInlineDiffDecorations,
  INLINE_DIFF_TEXT_CLASS,
  InlineRangeModel,
} from '../../src/shared/comparison-engine/inline-diff.js';

function makeMockModel(lines: string[]): InlineRangeModel {
  return {
    getLineCount: () => lines.length,
    getLineMaxColumn: (lineNumber: number) => (lines[lineNumber - 1]?.length ?? 0) + 1,
  };
}

describe('buildInlineDiffDecorations (Beyond Compare Bold Red Token Styling)', () => {
  it('returns empty arrays for null, undefined, or empty lineChanges', () => {
    expect(buildInlineDiffDecorations(null)).toEqual({ leftInlineDecs: [], rightInlineDecs: [] });
    expect(buildInlineDiffDecorations(undefined)).toEqual({ leftInlineDecs: [], rightInlineDecs: [] });
    expect(buildInlineDiffDecorations([])).toEqual({ leftInlineDecs: [], rightInlineDecs: [] });
  });

  it('decorates only exact differing character slices (e.g. vlanId 2516 vs 205) with inline class', () => {
    const lineChanges = [
      {
        originalStartLineNumber: 45,
        originalEndLineNumber: 45,
        modifiedStartLineNumber: 45,
        modifiedEndLineNumber: 45,
        charChanges: [
          {
            originalStartLineNumber: 45,
            originalStartColumn: 11,
            originalEndLineNumber: 45,
            originalEndColumn: 15, // "2516"
            modifiedStartLineNumber: 45,
            modifiedStartColumn: 11,
            modifiedEndLineNumber: 45,
            modifiedEndColumn: 14, // "205"
          },
        ],
      },
    ];

    const { leftInlineDecs, rightInlineDecs } = buildInlineDiffDecorations(lineChanges);

    expect(leftInlineDecs).toHaveLength(1);
    expect(leftInlineDecs[0]).toEqual({
      range: { startLineNumber: 45, startColumn: 11, endLineNumber: 45, endColumn: 15 },
      options: { inlineClassName: INLINE_DIFF_TEXT_CLASS },
    });

    expect(rightInlineDecs).toHaveLength(1);
    expect(rightInlineDecs[0]).toEqual({
      range: { startLineNumber: 45, startColumn: 11, endLineNumber: 45, endColumn: 14 },
      options: { inlineClassName: INLINE_DIFF_TEXT_CLASS },
    });
  });

  it('safely skips zero-width charChange slices when one side only inserts characters', () => {
    const lineChanges = [
      {
        originalStartLineNumber: 12,
        originalEndLineNumber: 12,
        modifiedStartLineNumber: 12,
        modifiedEndLineNumber: 12,
        charChanges: [
          {
            originalStartLineNumber: 12,
            originalStartColumn: 5,
            originalEndLineNumber: 12,
            originalEndColumn: 5, // zero-width on left
            modifiedStartLineNumber: 12,
            modifiedStartColumn: 5,
            modifiedEndLineNumber: 12,
            modifiedEndColumn: 10, // "extra" on right
          },
        ],
      },
    ];

    const { leftInlineDecs, rightInlineDecs } = buildInlineDiffDecorations(lineChanges);
    expect(leftInlineDecs).toHaveLength(0);
    expect(rightInlineDecs).toHaveLength(1);
    expect(rightInlineDecs[0].range).toEqual({
      startLineNumber: 12,
      startColumn: 5,
      endLineNumber: 12,
      endColumn: 10,
    });
  });

  it('decorates non-empty added or deleted whole lines when charChanges are absent', () => {
    const origModel = makeMockModel(['line 1', 'removed-line-content', '', 'line 4']);
    const modModel = makeMockModel(['line 1', 'line 4', 'added-line-content']);

    const lineChanges = [
      {
        originalStartLineNumber: 2,
        originalEndLineNumber: 3, // line 2 has text, line 3 is empty
        modifiedStartLineNumber: 1,
        modifiedEndLineNumber: 0,
      },
      {
        originalStartLineNumber: 4,
        originalEndLineNumber: 0,
        modifiedStartLineNumber: 3,
        modifiedEndLineNumber: 3,
      },
    ];

    const { leftInlineDecs, rightInlineDecs } = buildInlineDiffDecorations(
      lineChanges,
      origModel,
      modModel
    );

    expect(leftInlineDecs).toHaveLength(1);
    expect(leftInlineDecs[0].range).toEqual({
      startLineNumber: 2,
      startColumn: 1,
      endLineNumber: 2,
      endColumn: 'removed-line-content'.length + 1,
    });

    expect(rightInlineDecs).toHaveLength(1);
    expect(rightInlineDecs[0].range).toEqual({
      startLineNumber: 3,
      startColumn: 1,
      endLineNumber: 3,
      endColumn: 'added-line-content'.length + 1,
    });
  });
});
