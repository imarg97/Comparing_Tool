export interface DiffChunk {
  id: string;
  originalStart: number;
  originalEnd: number;
  modifiedStart: number;
  modifiedEnd: number;
}

/**
 * Normalizes Monaco getLineChanges() into clean DiffChunk items
 */
export function normalizeLineChanges(changes: any[] | null | undefined): DiffChunk[] {
  if (!changes || !Array.isArray(changes)) return [];

  return changes.map((c, idx) => ({
    id: `chunk_${idx}_${c.originalStartLineNumber}_${c.modifiedStartLineNumber}`,
    originalStart: c.originalStartLineNumber,
    originalEnd: c.originalEndLineNumber,
    modifiedStart: c.modifiedStartLineNumber,
    modifiedEnd: c.modifiedEndLineNumber,
  }));
}

/**
 * Finds the diff chunk containing or closest to the given line number
 */
export function findChunkAtLine(
  chunks: DiffChunk[],
  line: number,
  side: 'left' | 'right'
): DiffChunk | null {
  if (!chunks.length || line <= 0) return null;

  for (const c of chunks) {
    if (side === 'left') {
      const hasContent = c.originalStart > 0 && c.originalEnd >= c.originalStart;
      if (hasContent && line >= c.originalStart && line <= c.originalEnd) {
        return c;
      }
      if (!hasContent && (line === c.originalStart || line === c.originalStart + 1)) {
        return c;
      }
    } else {
      const hasContent = c.modifiedStart > 0 && c.modifiedEnd >= c.modifiedStart;
      if (hasContent && line >= c.modifiedStart && line <= c.modifiedEnd) {
        return c;
      }
      if (!hasContent && (line === c.modifiedStart || line === c.modifiedStart + 1)) {
        return c;
      }
    }
  }

  return null;
}

/**
 * Finds the closest diff chunk to a given line number (used for snapping click or jump)
 */
export function findClosestChunk(
  chunks: DiffChunk[],
  line: number,
  side: 'left' | 'right'
): DiffChunk | null {
  if (!chunks.length) return null;
  const direct = findChunkAtLine(chunks, line, side);
  if (direct) return direct;

  let closest: DiffChunk | null = null;
  let minDistance = Infinity;

  for (const c of chunks) {
    let targetStart = 0;
    if (side === 'left') {
      targetStart = c.originalStart > 0 ? c.originalStart : c.modifiedStart;
    } else {
      targetStart = c.modifiedStart > 0 ? c.modifiedStart : c.originalStart;
    }
    const dist = Math.abs(line - targetStart);
    if (dist < minDistance) {
      minDistance = dist;
      closest = c;
    }
  }

  return closest;
}

/**
 * Splices lines from source text into target text at exact 1-based line positions.
 * Used for direct paragraph copy and mouse range selections.
 */
export function spliceLines(
  sourceText: string,
  targetText: string,
  sourceStartLine: number,
  sourceEndLine: number,
  targetStartLine: number,
  targetEndLine: number
): string {
  const sourceLines = sourceText.split(/\r?\n/);
  const targetLines = targetText.split(/\r?\n/);

  // Extract source lines (1-based to 0-based)
  const actualSourceEnd = sourceEndLine >= sourceStartLine && sourceStartLine > 0 ? sourceEndLine : sourceStartLine;
  const startIdx = Math.max(0, sourceStartLine - 1);
  const endIdx = Math.max(startIdx, actualSourceEnd);
  const extracted = sourceStartLine > 0 ? sourceLines.slice(startIdx, endIdx) : [];

  // Determine target splice index and delete count
  const insertIndex = targetStartLine > 0 ? Math.min(targetStartLine - 1, targetLines.length) : targetLines.length;
  const deleteCount =
    targetEndLine >= targetStartLine && targetStartLine > 0
      ? targetEndLine - targetStartLine + 1
      : targetEndLine === 0
      ? 0
      : 1;

  targetLines.splice(insertIndex, deleteCount, ...extracted);
  return targetLines.join('\n');
}

export interface ChunkCopyRange {
  startLine: number;
  endLine: number;
}

/**
 * Synchronously removes any Monaco diff alignment view zones (whitespaces) at or adjacent to
 * the target line in the given editor before an edit operation is pushed.
 * This prevents Monaco from temporarily rendering both the gap view zone AND the newly inserted line,
 * which is the mechanical root cause of the visual jump/jerk before the diff worker finishes.
 */
export function collapseEditorGapViewZones(editor: any, targetAfterLine: number): void {
  if (!editor) return;
  try {
    // 1. Monaco CodeEditor API: getWhitespaces()
    if (typeof editor.getWhitespaces === 'function' && typeof editor.changeViewZones === 'function') {
      const whitespaces = editor.getWhitespaces();
      if (Array.isArray(whitespaces) && whitespaces.length > 0) {
        const matchingIds: string[] = [];
        for (const ws of whitespaces) {
          if (!ws || ws.id === undefined) continue;
          if (Math.abs(ws.afterLineNumber - targetAfterLine) <= 1) {
            matchingIds.push(ws.id);
          }
        }
        if (matchingIds.length > 0) {
          editor.changeViewZones((accessor: any) => {
            for (const id of matchingIds) {
              try {
                accessor.removeZone(id);
              } catch {
                // ignore
              }
            }
          });
        }
      }
    }
  } catch {
    // Non-fatal safety guard
  }
}

/**
 * Executes Left-to-Right chunk copy directly within Monaco editor models.
 * Accurately handles replacements, insertions into gaps, and clean deletions.
 */
export function executeChunkCopyL2R(
  originalModel: any,
  modifiedModel: any,
  chunk: DiffChunk,
  outRange?: ChunkCopyRange,
  targetEditor?: any
): boolean {
  if (!originalModel || !modifiedModel) return false;

  const leftLineCount = originalModel.getLineCount();
  const rightLineCount = modifiedModel.getLineCount();

  const hasLeftContent = chunk.originalStart > 0 && chunk.originalEnd >= chunk.originalStart;
  let textToInsert = '';
  let leftInsertedLineCount = 0;

  if (hasLeftContent) {
    const startLine = Math.min(chunk.originalStart, leftLineCount);
    const endLine = Math.min(chunk.originalEnd, leftLineCount);
    textToInsert = originalModel.getValueInRange({
      startLineNumber: startLine,
      startColumn: 1,
      endLineNumber: endLine,
      endColumn: originalModel.getLineMaxColumn(endLine),
    });
    leftInsertedLineCount = endLine - startLine + 1;
  }

  const hasRightLines = chunk.modifiedStart > 0 && chunk.modifiedEnd >= chunk.modifiedStart;

  // Case 1: Both sides have content -> Direct replacement of target lines
  if (hasLeftContent && hasRightLines) {
    const startLine = Math.min(chunk.modifiedStart, rightLineCount);
    const endLine = Math.min(chunk.modifiedEnd, rightLineCount);
    const range = {
      startLineNumber: startLine,
      startColumn: 1,
      endLineNumber: endLine,
      endColumn: modifiedModel.getLineMaxColumn(endLine),
    };
    modifiedModel.pushEditOperations([], [{ range, text: textToInsert }], () => null);
    if (outRange) {
      outRange.startLine = startLine;
      outRange.endLine = startLine + leftInsertedLineCount - 1;
    }
    if (targetEditor) {
      collapseEditorGapViewZones(targetEditor, chunk.modifiedStart);
    }
    return true;
  }

  // Case 2: Left has content, Right is a gap -> Insert cleanly into the gap
  if (hasLeftContent && !hasRightLines) {
    if (chunk.modifiedStart === 0 || rightLineCount === 0) {
      // Gap is before line 1 (start of file)
      const range = {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1,
      };
      const content = rightLineCount > 0 ? textToInsert + '\n' : textToInsert;
      modifiedModel.pushEditOperations([], [{ range, text: content }], () => null);
      if (outRange) {
        outRange.startLine = 1;
        outRange.endLine = leftInsertedLineCount;
      }
    } else if (chunk.modifiedStart >= rightLineCount) {
      // Gap is after the last line of the right file
      const lastLine = rightLineCount;
      const lastCol = modifiedModel.getLineMaxColumn(lastLine);
      const range = {
        startLineNumber: lastLine,
        startColumn: lastCol,
        endLineNumber: lastLine,
        endColumn: lastCol,
      };
      modifiedModel.pushEditOperations([], [{ range, text: '\n' + textToInsert }], () => null);
      if (outRange) {
        outRange.startLine = lastLine + 1;
        outRange.endLine = lastLine + leftInsertedLineCount;
      }
    } else {
      // Gap is between chunk.modifiedStart and chunk.modifiedStart + 1
      const insertLine = chunk.modifiedStart + 1;
      const range = {
        startLineNumber: insertLine,
        startColumn: 1,
        endLineNumber: insertLine,
        endColumn: 1,
      };
      modifiedModel.pushEditOperations([], [{ range, text: textToInsert + '\n' }], () => null);
      if (outRange) {
        outRange.startLine = insertLine;
        outRange.endLine = insertLine + leftInsertedLineCount - 1;
      }
    }
    if (targetEditor) {
      collapseEditorGapViewZones(targetEditor, chunk.modifiedStart);
    }
    return true;
  }

  // Case 3: Left is a gap, Right has content -> Delete cleanly from Right
  if (!hasLeftContent && hasRightLines) {
    const startLine = Math.min(chunk.modifiedStart, rightLineCount);
    const endLine = Math.min(chunk.modifiedEnd, rightLineCount);

    if (startLine === 1 && endLine >= rightLineCount) {
      const range = {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: rightLineCount,
        endColumn: modifiedModel.getLineMaxColumn(rightLineCount),
      };
      modifiedModel.pushEditOperations([], [{ range, text: '' }], () => null);
      if (outRange) {
        outRange.startLine = 1;
        outRange.endLine = 1;
      }
    } else if (startLine === 1) {
      const range = {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: endLine + 1,
        endColumn: 1,
      };
      modifiedModel.pushEditOperations([], [{ range, text: '' }], () => null);
      if (outRange) {
        outRange.startLine = 1;
        outRange.endLine = 1;
      }
    } else {
      const prevLine = startLine - 1;
      const prevCol = modifiedModel.getLineMaxColumn(prevLine);
      const range = {
        startLineNumber: prevLine,
        startColumn: prevCol,
        endLineNumber: endLine,
        endColumn: modifiedModel.getLineMaxColumn(endLine),
      };
      modifiedModel.pushEditOperations([], [{ range, text: '' }], () => null);
      if (outRange) {
        outRange.startLine = prevLine;
        outRange.endLine = prevLine;
      }
    }
    if (targetEditor) {
      collapseEditorGapViewZones(targetEditor, chunk.modifiedStart);
    }
    return true;
  }

  return false;
}

/**
 * Executes Right-to-Left chunk copy directly within Monaco editor models.
 * Accurately handles replacements, insertions into gaps, and clean deletions.
 */
export function executeChunkCopyR2L(
  originalModel: any,
  modifiedModel: any,
  chunk: DiffChunk,
  outRange?: ChunkCopyRange,
  targetEditor?: any
): boolean {
  if (!originalModel || !modifiedModel) return false;

  const leftLineCount = originalModel.getLineCount();
  const rightLineCount = modifiedModel.getLineCount();

  const hasRightContent = chunk.modifiedStart > 0 && chunk.modifiedEnd >= chunk.modifiedStart;
  let textToInsert = '';
  let rightInsertedLineCount = 0;

  if (hasRightContent) {
    const startLine = Math.min(chunk.modifiedStart, rightLineCount);
    const endLine = Math.min(chunk.modifiedEnd, rightLineCount);
    textToInsert = modifiedModel.getValueInRange({
      startLineNumber: startLine,
      startColumn: 1,
      endLineNumber: endLine,
      endColumn: modifiedModel.getLineMaxColumn(endLine),
    });
    rightInsertedLineCount = endLine - startLine + 1;
  }

  const hasLeftLines = chunk.originalStart > 0 && chunk.originalEnd >= chunk.originalStart;

  // Case 1: Both sides have content -> Direct replacement of target lines
  if (hasRightContent && hasLeftLines) {
    const startLine = Math.min(chunk.originalStart, leftLineCount);
    const endLine = Math.min(chunk.originalEnd, leftLineCount);
    const range = {
      startLineNumber: startLine,
      startColumn: 1,
      endLineNumber: endLine,
      endColumn: originalModel.getLineMaxColumn(endLine),
    };
    originalModel.pushEditOperations([], [{ range, text: textToInsert }], () => null);
    if (outRange) {
      outRange.startLine = startLine;
      outRange.endLine = startLine + rightInsertedLineCount - 1;
    }
    if (targetEditor) {
      collapseEditorGapViewZones(targetEditor, chunk.originalStart);
    }
    return true;
  }

  // Case 2: Right has content, Left is a gap -> Insert cleanly into the gap
  if (hasRightContent && !hasLeftLines) {
    if (chunk.originalStart === 0 || leftLineCount === 0) {
      const range = {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1,
      };
      const content = leftLineCount > 0 ? textToInsert + '\n' : textToInsert;
      originalModel.pushEditOperations([], [{ range, text: content }], () => null);
      if (outRange) {
        outRange.startLine = 1;
        outRange.endLine = rightInsertedLineCount;
      }
    } else if (chunk.originalStart >= leftLineCount) {
      const lastLine = leftLineCount;
      const lastCol = originalModel.getLineMaxColumn(lastLine);
      const range = {
        startLineNumber: lastLine,
        startColumn: lastCol,
        endLineNumber: lastLine,
        endColumn: lastCol,
      };
      originalModel.pushEditOperations([], [{ range, text: '\n' + textToInsert }], () => null);
      if (outRange) {
        outRange.startLine = lastLine + 1;
        outRange.endLine = lastLine + rightInsertedLineCount;
      }
    } else {
      const insertLine = chunk.originalStart + 1;
      const range = {
        startLineNumber: insertLine,
        startColumn: 1,
        endLineNumber: insertLine,
        endColumn: 1,
      };
      originalModel.pushEditOperations([], [{ range, text: textToInsert + '\n' }], () => null);
      if (outRange) {
        outRange.startLine = insertLine;
        outRange.endLine = insertLine + rightInsertedLineCount - 1;
      }
    }
    if (targetEditor) {
      collapseEditorGapViewZones(targetEditor, chunk.originalStart);
    }
    return true;
  }

  // Case 3: Right is a gap, Left has content -> Delete cleanly from Left
  if (!hasRightContent && hasLeftLines) {
    const startLine = Math.min(chunk.originalStart, leftLineCount);
    const endLine = Math.min(chunk.originalEnd, leftLineCount);

    if (startLine === 1 && endLine >= leftLineCount) {
      const range = {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: leftLineCount,
        endColumn: originalModel.getLineMaxColumn(leftLineCount),
      };
      originalModel.pushEditOperations([], [{ range, text: '' }], () => null);
      if (outRange) {
        outRange.startLine = 1;
        outRange.endLine = 1;
      }
    } else if (startLine === 1) {
      const range = {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: endLine + 1,
        endColumn: 1,
      };
      originalModel.pushEditOperations([], [{ range, text: '' }], () => null);
      if (outRange) {
        outRange.startLine = 1;
        outRange.endLine = 1;
      }
    } else {
      const prevLine = startLine - 1;
      const prevCol = originalModel.getLineMaxColumn(prevLine);
      const range = {
        startLineNumber: prevLine,
        startColumn: prevCol,
        endLineNumber: endLine,
        endColumn: originalModel.getLineMaxColumn(endLine),
      };
      originalModel.pushEditOperations([], [{ range, text: '' }], () => null);
      if (outRange) {
        outRange.startLine = prevLine;
        outRange.endLine = prevLine;
      }
    }
    if (targetEditor) {
      collapseEditorGapViewZones(targetEditor, chunk.originalStart);
    }
    return true;
  }

  return false;
}

export interface HiddenRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

/**
 * Computes all unchanged (identical) line ranges between diff chunks.
 * Used for "Diffs Only" view filter to hide matching lines and show ONLY differences.
 */
export function computeUnchangedRanges(
  chunks: DiffChunk[],
  totalLines: number,
  side: 'left' | 'right'
): HiddenRange[] {
  if (totalLines <= 0) return [];
  if (!chunks.length) {
    return [{ startLineNumber: 1, startColumn: 1, endLineNumber: totalLines, endColumn: 1 }];
  }

  const ranges = chunks
    .map((c) => {
      const s = side === 'left' ? c.originalStart : c.modifiedStart;
      const e = side === 'left' ? c.originalEnd : c.modifiedEnd;
      if (s > 0 && e >= s) {
        return { start: s, end: e };
      }
      // If it's a gap on this side (e.g. s is anchor line, e is 0)
      if (s > 0 && e === 0) {
        return { start: Math.max(1, s), end: Math.min(totalLines, s + 1) };
      }
      return null;
    })
    .filter((r): r is { start: number; end: number } => r !== null)
    .sort((a, b) => a.start - b.start);

  const mergedRanges: { start: number; end: number }[] = [];
  for (const r of ranges) {
    if (!mergedRanges.length) {
      mergedRanges.push({ ...r });
    } else {
      const last = mergedRanges[mergedRanges.length - 1];
      if (r.start <= last.end + 1) {
        last.end = Math.max(last.end, r.end);
      } else {
        mergedRanges.push({ ...r });
      }
    }
  }

  const unchanged: HiddenRange[] = [];
  let currentLine = 1;

  for (const r of mergedRanges) {
    if (r.start > currentLine) {
      unchanged.push({
        startLineNumber: currentLine,
        startColumn: 1,
        endLineNumber: r.start - 1,
        endColumn: 1,
      });
    }
    currentLine = Math.max(currentLine, r.end + 1);
  }

  if (currentLine <= totalLines) {
    unchanged.push({
      startLineNumber: currentLine,
      startColumn: 1,
      endLineNumber: totalLines,
      endColumn: 1,
    });
  }

  return unchanged;
}

/**
 * Computes all difference line ranges.
 * Used for "Same Only" view filter to hide differences and show ONLY matching lines.
 */
export function computeDiffRanges(
  chunks: DiffChunk[],
  side: 'left' | 'right'
): HiddenRange[] {
  const ranges = chunks
    .map((c) => {
      const s = side === 'left' ? c.originalStart : c.modifiedStart;
      const e = side === 'left' ? c.originalEnd : c.modifiedEnd;
      if (s > 0 && e >= s) {
        return { start: s, end: e };
      }
      return null;
    })
    .filter((r): r is { start: number; end: number } => r !== null)
    .sort((a, b) => a.start - b.start);

  const merged: HiddenRange[] = [];
  for (const r of ranges) {
    if (!merged.length) {
      merged.push({ startLineNumber: r.start, startColumn: 1, endLineNumber: r.end, endColumn: 1 });
    } else {
      const last = merged[merged.length - 1];
      if (r.start <= last.endLineNumber + 1) {
        last.endLineNumber = Math.max(last.endLineNumber, r.end);
      } else {
        merged.push({ startLineNumber: r.start, startColumn: 1, endLineNumber: r.end, endColumn: 1 });
      }
    }
  }

  return merged;
}

/**
 * Copies specifically selected lines from Left (Original) to Right (Modified).
 * Matches Beyond Compare fine-grained selection copying:
 * Replaces corresponding target lines if target has lines, or inserts into gap cleanly.
 */
export function executeSelectedLinesCopyL2R(
  originalModel: any,
  modifiedModel: any,
  selection: { startLine: number; endLine: number; text?: string },
  chunk?: DiffChunk | null,
  outRange?: ChunkCopyRange,
  targetEditor?: any
): boolean {
  if (!originalModel || !modifiedModel) return false;
  if (targetEditor) {
    collapseEditorGapViewZones(targetEditor, chunk ? chunk.modifiedStart : selection.startLine);
  }

  const leftLineCount = originalModel.getLineCount();
  const rightLineCount = modifiedModel.getLineCount();

  const sLine = Math.max(1, Math.min(selection.startLine, leftLineCount));
  const eLine = Math.max(sLine, Math.min(selection.endLine, leftLineCount));
  const selectedText = originalModel.getValueInRange({
    startLineNumber: sLine,
    startColumn: 1,
    endLineNumber: eLine,
    endColumn: originalModel.getLineMaxColumn(eLine),
  });
  const lineCount = eLine - sLine + 1;

  if (chunk) {
    const sStart = chunk.originalStart;
    const tStart = chunk.modifiedStart;
    const tEnd = chunk.modifiedEnd;
    const tHasLines = tStart > 0 && tEnd >= tStart;

    if (tHasLines && rightLineCount > 0) {
      const offset = sStart > 0 ? Math.max(0, sLine - sStart) : 0;
      const tChunkLineCount = tEnd - tStart + 1;

      if (offset < tChunkLineCount) {
        // Selection starts inside the target replacement zone: replace ONLY up to tEnd!
        const targetReplaceStart = tStart + offset;
        const targetReplaceEnd = Math.min(tEnd, targetReplaceStart + lineCount - 1);
        const range = {
          startLineNumber: targetReplaceStart,
          startColumn: 1,
          endLineNumber: targetReplaceEnd,
          endColumn: modifiedModel.getLineMaxColumn(targetReplaceEnd),
        };
        modifiedModel.pushEditOperations([], [{ range, text: selectedText }], () => null);
        if (outRange) {
          outRange.startLine = targetReplaceStart;
          outRange.endLine = targetReplaceStart + lineCount - 1;
        }
        return true;
      } else {
        // Selection is beyond the target chunk lines (inserting into gap after tEnd)
        const insertLine = tEnd + 1;
        if (insertLine <= rightLineCount) {
          const range = {
            startLineNumber: insertLine,
            startColumn: 1,
            endLineNumber: insertLine,
            endColumn: 1,
          };
          modifiedModel.pushEditOperations([], [{ range, text: selectedText + '\n' }], () => null);
          if (outRange) {
            outRange.startLine = insertLine;
            outRange.endLine = insertLine + lineCount - 1;
          }
        } else {
          const lastCol = modifiedModel.getLineMaxColumn(rightLineCount);
          const range = {
            startLineNumber: rightLineCount,
            startColumn: lastCol,
            endLineNumber: rightLineCount,
            endColumn: lastCol,
          };
          modifiedModel.pushEditOperations([], [{ range, text: '\n' + selectedText }], () => null);
          if (outRange) {
            outRange.startLine = rightLineCount + 1;
            outRange.endLine = rightLineCount + lineCount;
          }
        }
        return true;
      }
    } else {
      // Target side has NO lines (gap on right)
      if (tStart === 0 || rightLineCount === 0) {
        const range = { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 };
        const content = rightLineCount > 0 ? selectedText + '\n' : selectedText;
        modifiedModel.pushEditOperations([], [{ range, text: content }], () => null);
        if (outRange) {
          outRange.startLine = 1;
          outRange.endLine = lineCount;
        }
      } else if (tStart >= rightLineCount) {
        const lastCol = modifiedModel.getLineMaxColumn(rightLineCount);
        const range = {
          startLineNumber: rightLineCount,
          startColumn: lastCol,
          endLineNumber: rightLineCount,
          endColumn: lastCol,
        };
        modifiedModel.pushEditOperations([], [{ range, text: '\n' + selectedText }], () => null);
        if (outRange) {
          outRange.startLine = rightLineCount + 1;
          outRange.endLine = rightLineCount + lineCount;
        }
      } else {
        const insertLine = tStart + 1;
        const range = {
          startLineNumber: insertLine,
          startColumn: 1,
          endLineNumber: insertLine,
          endColumn: 1,
        };
        modifiedModel.pushEditOperations([], [{ range, text: selectedText + '\n' }], () => null);
        if (outRange) {
          outRange.startLine = insertLine;
          outRange.endLine = insertLine + lineCount - 1;
        }
      }
      return true;
    }
  }

  // Fallback if no diff chunk is associated: direct replacement/insert at selection line
  const targetLine = Math.min(sLine, Math.max(1, rightLineCount));
  const range = {
    startLineNumber: targetLine,
    startColumn: 1,
    endLineNumber: targetLine,
    endColumn: modifiedModel.getLineMaxColumn(targetLine),
  };
  modifiedModel.pushEditOperations([], [{ range, text: selectedText }], () => null);
  if (outRange) {
    outRange.startLine = targetLine;
    outRange.endLine = targetLine + lineCount - 1;
  }
  return true;
}

/**
 * Copies specifically selected lines from Right (Modified) to Left (Original).
 * Respects difference chunk boundaries, replacing only the corresponding lines on the
 * left without destroying unchanged code below the chunk.
 */
export function executeSelectedLinesCopyR2L(
  originalModel: any,
  modifiedModel: any,
  selection: { startLine: number; endLine: number; text?: string },
  chunk?: DiffChunk | null,
  outRange?: ChunkCopyRange,
  targetEditor?: any
): boolean {
  if (!originalModel || !modifiedModel) return false;
  if (targetEditor) {
    collapseEditorGapViewZones(targetEditor, chunk ? chunk.originalStart : selection.startLine);
  }

  const leftLineCount = originalModel.getLineCount();
  const rightLineCount = modifiedModel.getLineCount();

  const sLine = Math.max(1, Math.min(selection.startLine, rightLineCount));
  const eLine = Math.max(sLine, Math.min(selection.endLine, rightLineCount));
  const selectedText = modifiedModel.getValueInRange({
    startLineNumber: sLine,
    startColumn: 1,
    endLineNumber: eLine,
    endColumn: modifiedModel.getLineMaxColumn(eLine),
  });
  const lineCount = eLine - sLine + 1;

  if (chunk) {
    const sStart = chunk.modifiedStart;
    const tStart = chunk.originalStart;
    const tEnd = chunk.originalEnd;
    const tHasLines = tStart > 0 && tEnd >= tStart;

    if (tHasLines && leftLineCount > 0) {
      const offset = sStart > 0 ? Math.max(0, sLine - sStart) : 0;
      const tChunkLineCount = tEnd - tStart + 1;

      if (offset < tChunkLineCount) {
        // Selection starts inside the target replacement zone: replace ONLY up to tEnd!
        const targetReplaceStart = tStart + offset;
        const targetReplaceEnd = Math.min(tEnd, targetReplaceStart + lineCount - 1);
        const range = {
          startLineNumber: targetReplaceStart,
          startColumn: 1,
          endLineNumber: targetReplaceEnd,
          endColumn: originalModel.getLineMaxColumn(targetReplaceEnd),
        };
        originalModel.pushEditOperations([], [{ range, text: selectedText }], () => null);
        if (outRange) {
          outRange.startLine = targetReplaceStart;
          outRange.endLine = targetReplaceStart + lineCount - 1;
        }
        return true;
      } else {
        // Selection is beyond the target chunk lines (inserting into gap after tEnd)
        const insertLine = tEnd + 1;
        if (insertLine <= leftLineCount) {
          const range = {
            startLineNumber: insertLine,
            startColumn: 1,
            endLineNumber: insertLine,
            endColumn: 1,
          };
          originalModel.pushEditOperations([], [{ range, text: selectedText + '\n' }], () => null);
          if (outRange) {
            outRange.startLine = insertLine;
            outRange.endLine = insertLine + lineCount - 1;
          }
        } else {
          const lastCol = originalModel.getLineMaxColumn(leftLineCount);
          const range = {
            startLineNumber: leftLineCount,
            startColumn: lastCol,
            endLineNumber: leftLineCount,
            endColumn: lastCol,
          };
          originalModel.pushEditOperations([], [{ range, text: '\n' + selectedText }], () => null);
          if (outRange) {
            outRange.startLine = leftLineCount + 1;
            outRange.endLine = leftLineCount + lineCount;
          }
        }
        return true;
      }
    } else {
      // Target side has NO lines (gap on left)
      if (tStart === 0 || leftLineCount === 0) {
        const range = { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 };
        const content = leftLineCount > 0 ? selectedText + '\n' : selectedText;
        originalModel.pushEditOperations([], [{ range, text: content }], () => null);
        if (outRange) {
          outRange.startLine = 1;
          outRange.endLine = lineCount;
        }
      } else if (tStart >= leftLineCount) {
        const lastCol = originalModel.getLineMaxColumn(leftLineCount);
        const range = {
          startLineNumber: leftLineCount,
          startColumn: lastCol,
          endLineNumber: leftLineCount,
          endColumn: lastCol,
        };
        originalModel.pushEditOperations([], [{ range, text: '\n' + selectedText }], () => null);
        if (outRange) {
          outRange.startLine = leftLineCount + 1;
          outRange.endLine = leftLineCount + lineCount;
        }
      } else {
        const insertLine = tStart + 1;
        const range = {
          startLineNumber: insertLine,
          startColumn: 1,
          endLineNumber: insertLine,
          endColumn: 1,
        };
        originalModel.pushEditOperations([], [{ range, text: selectedText + '\n' }], () => null);
        if (outRange) {
          outRange.startLine = insertLine;
          outRange.endLine = insertLine + lineCount - 1;
        }
      }
      return true;
    }
  }

  // Fallback if no diff chunk is associated: direct replacement/insert at selection line
  const targetLine = Math.min(sLine, Math.max(1, leftLineCount));
  const range = {
    startLineNumber: targetLine,
    startColumn: 1,
    endLineNumber: targetLine,
    endColumn: originalModel.getLineMaxColumn(targetLine),
  };
  originalModel.pushEditOperations([], [{ range, text: selectedText }], () => null);
  if (outRange) {
    outRange.startLine = targetLine;
    outRange.endLine = targetLine + lineCount - 1;
  }
  return true;
}
