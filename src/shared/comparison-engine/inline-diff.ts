export const INLINE_DIFF_TEXT_CLASS = 'diffx-inline-diff-text';

export interface InlineRangeModel {
  getLineCount(): number;
  getLineMaxColumn(lineNumber: number): number;
}

export interface MonacoInlineDecoration {
  range: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
  options: {
    inlineClassName: string;
  };
}

export interface InlineDiffDecorationsResult {
  leftInlineDecs: MonacoInlineDecoration[];
  rightInlineDecs: MonacoInlineDecoration[];
}

interface LineRangeAdditionTarget {
  decs: MonacoInlineDecoration[];
  startLine: number;
  endLine: number;
  model?: InlineRangeModel | null;
}

function appendWholeLineRangeDecorations({ decs, startLine, endLine, model }: LineRangeAdditionTarget): void {
  if (startLine <= 0 || endLine < startLine) return;
  const maxModelLines = model ? model.getLineCount() : endLine;
  const boundedEnd = Math.min(endLine, maxModelLines);

  for (let line = startLine; line <= boundedEnd; line++) {
    const maxCol = model ? model.getLineMaxColumn(line) : 10000;
    if (maxCol <= 1) continue;
    decs.push({
      range: {
        startLineNumber: line,
        startColumn: 1,
        endLineNumber: line,
        endColumn: maxCol,
      },
      options: {
        inlineClassName: INLINE_DIFF_TEXT_CLASS,
      },
    });
  }
}

/**
 * Converts Monaco getLineChanges() output (including charChanges) into
 * clean foreground inline decorations so changed tokens render in bold red
 * text rather than heavy background boxes.
 */
export function buildInlineDiffDecorations(
  lineChanges: any[] | null | undefined,
  origModel?: InlineRangeModel | null,
  modModel?: InlineRangeModel | null
): InlineDiffDecorationsResult {
  const leftInlineDecs: MonacoInlineDecoration[] = [];
  const rightInlineDecs: MonacoInlineDecoration[] = [];

  if (!lineChanges || !Array.isArray(lineChanges)) {
    return { leftInlineDecs, rightInlineDecs };
  }

  for (const change of lineChanges) {
    const charChanges = Array.isArray(change?.charChanges) ? change.charChanges : [];

    if (charChanges.length > 0) {
      for (const cc of charChanges) {
        const hasOrigSpan =
          cc.originalStartLineNumber > 0 &&
          cc.originalEndLineNumber >= cc.originalStartLineNumber &&
          (cc.originalEndLineNumber > cc.originalStartLineNumber ||
            cc.originalEndColumn > cc.originalStartColumn);

        if (hasOrigSpan) {
          leftInlineDecs.push({
            range: {
              startLineNumber: cc.originalStartLineNumber,
              startColumn: cc.originalStartColumn,
              endLineNumber: cc.originalEndLineNumber,
              endColumn: cc.originalEndColumn,
            },
            options: {
              inlineClassName: INLINE_DIFF_TEXT_CLASS,
            },
          });
        }

        const hasModSpan =
          cc.modifiedStartLineNumber > 0 &&
          cc.modifiedEndLineNumber >= cc.modifiedStartLineNumber &&
          (cc.modifiedEndLineNumber > cc.modifiedStartLineNumber ||
            cc.modifiedEndColumn > cc.modifiedStartColumn);

        if (hasModSpan) {
          rightInlineDecs.push({
            range: {
              startLineNumber: cc.modifiedStartLineNumber,
              startColumn: cc.modifiedStartColumn,
              endLineNumber: cc.modifiedEndLineNumber,
              endColumn: cc.modifiedEndColumn,
            },
            options: {
              inlineClassName: INLINE_DIFF_TEXT_CLASS,
            },
          });
        }
      }
    } else {
      // Whole-line addition, deletion, or block change without granular charChanges
      appendWholeLineRangeDecorations({
        decs: leftInlineDecs,
        startLine: change.originalStartLineNumber,
        endLine: change.originalEndLineNumber,
        model: origModel,
      });
      appendWholeLineRangeDecorations({
        decs: rightInlineDecs,
        startLine: change.modifiedStartLineNumber,
        endLine: change.modifiedEndLineNumber,
        model: modModel,
      });
    }
  }

  return { leftInlineDecs, rightInlineDecs };
}
