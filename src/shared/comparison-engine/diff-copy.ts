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
 * Supports an optional maxDistance to prevent snapping across large unrelated distances.
 */
export function findClosestChunk(
  chunks: DiffChunk[],
  line: number,
  side: 'left' | 'right',
  maxDistance?: number
): DiffChunk | null {
  if (!chunks.length || line <= 0) return null;
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
    if (dist < minDistance && (maxDistance === undefined || dist <= maxDistance)) {
      minDistance = dist;
      closest = c;
    }
  }

  return closest;
}

/**
 * Locates the diff chunk corresponding to an alignment gap (empty space).
 * In Beyond Compare: when an empty space is clicked on the right, it maps
 * to the chunk where modifiedEnd === 0 (or modifiedStart aligns with the gap).
 */
export function findChunkAtGap(
  chunks: DiffChunk[],
  afterLine: number,
  gapSide: 'left' | 'right'
): DiffChunk | null {
  if (!Array.isArray(chunks) || chunks.length === 0) return null;

  for (const c of chunks) {
    if (gapSide === 'right') {
      // Gap on right editor: left has content, right is empty or insertion gap
      const isRightGap = c.modifiedEnd === 0 || c.modifiedEnd < c.modifiedStart;
      if (isRightGap) {
        if (
          c.modifiedStart === afterLine ||
          c.modifiedStart === afterLine + 1 ||
          Math.abs(c.modifiedStart - afterLine) <= 1
        ) {
          return c;
        }
      }
    } else {
      // Gap on left editor: right has content, left is empty or insertion gap
      const isLeftGap = c.originalEnd === 0 || c.originalEnd < c.originalStart;
      if (isLeftGap) {
        if (
          c.originalStart === afterLine ||
          c.originalStart === afterLine + 1 ||
          Math.abs(c.originalStart - afterLine) <= 1
        ) {
          return c;
        }
      }
    }
  }

  // Fallback: match any chunk that spans near afterLine on the gap side
  return findClosestChunk(chunks, Math.max(1, afterLine), gapSide, 1);
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
 * Synchronously collapses and removes any Monaco diff alignment view zones (whitespaces) at or adjacent to
 * the target line in the given editor before and during an edit operation.
 * 
 * Crucial Fix for Monaco Diff Worker Jerk:
 * Monaco's diff worker runs asynchronously. If a line is inserted into a gap while the ViewZone
 * is still registered in Monaco's linesLayout, Monaco renders the new line below the ViewZone (e.g. Line 2).
 * Then, 150-300ms later when the worker diff finishes, Monaco deletes the ViewZone and the line snaps up ("jerk").
 * 
 * By collapsing the whitespace height to 0 synchronously via Monaco's viewLayout.changeWhitespace AND
 * hiding the ViewZone DOM element immediately BEFORE pushEditOperations, Monaco renders the new line
 * directly at the gap location from frame 1 with ZERO jerk and ZERO jump.
 */
export function collapseEditorGapViewZones(editor: any, targetAfterLine?: number): void {
  if (!editor) return;
  try {
    // 1. Monaco CodeEditor internal ViewZones: set delegate height to 0 and layoutZone to collapse linesLayout immediately
    const viewZonesPart = editor._view?.viewZones || editor._viewZones;
    if (viewZonesPart && viewZonesPart._zones && typeof editor.changeViewZones === 'function') {
      editor.changeViewZones((accessor: any) => {
        for (const key of Object.keys(viewZonesPart._zones)) {
          const zone = viewZonesPart._zones[key];
          if (!zone) continue;
          const delegate = zone.delegate;
          const afterLine = delegate?.afterLineNumber ?? zone.afterLineNumber;
          if (
            targetAfterLine === undefined ||
            targetAfterLine < 0 ||
            Math.abs(afterLine - targetAfterLine) <= 1
          ) {
            if (delegate) {
              delegate.heightInPx = 0;
              delegate.heightInLines = 0;
              if (delegate.domNode) {
                delegate.domNode.style.height = '0px';
                delegate.domNode.style.display = 'none';
                delegate.domNode.style.opacity = '0';
              }
            }
            if (typeof accessor.layoutZone === 'function') {
              try {
                accessor.layoutZone(key);
              } catch {
                // ignore
              }
            }
            try {
              accessor.removeZone(key);
            } catch {
              // ignore
            }
          }
        }
      });
    }

    // 2. Monaco CodeEditor API: getWhitespaces() & changeViewZones()
    if (typeof editor.getWhitespaces === 'function' && typeof editor.changeViewZones === 'function') {
      const whitespaces = editor.getWhitespaces();
      if (Array.isArray(whitespaces) && whitespaces.length > 0) {
        const matchingIds: string[] = [];
        for (const ws of whitespaces) {
          if (!ws || ws.id === undefined) continue;
          if (
            targetAfterLine === undefined ||
            targetAfterLine < 0 ||
            Math.abs(ws.afterLineNumber - targetAfterLine) <= 1
          ) {
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

    // 3. Monaco internal linesLayout whitespace collapse (synchronously sets height to 0)
    const viewModel = typeof editor._getViewModel === 'function' ? editor._getViewModel() : null;
    const viewLayout = viewModel?.viewLayout || editor._view?.viewLayout;

    if (viewLayout && typeof viewLayout.changeWhitespace === 'function') {
      const whitespaces = typeof editor.getWhitespaces === 'function' ? editor.getWhitespaces() : [];
      if (Array.isArray(whitespaces) && whitespaces.length > 0) {
        viewLayout.changeWhitespace((accessor: any) => {
          for (const ws of whitespaces) {
            if (!ws || ws.id === undefined) continue;
            if (
              targetAfterLine === undefined ||
              targetAfterLine < 0 ||
              Math.abs(ws.afterLineNumber - targetAfterLine) <= 1
            ) {
              if (typeof accessor.changeOneWhitespace === 'function') {
                accessor.changeOneWhitespace(ws.id, ws.afterLineNumber, 0);
              }
              if (typeof accessor.removeWhitespace === 'function') {
                accessor.removeWhitespace(ws.id);
              }
            }
          }
        });
      }
    }

    // 4. Synchronous DOM level collapse to prevent any visual frame flicker
    const domNode = typeof editor.getDomNode === 'function' ? editor.getDomNode() : null;
    if (domNode) {
      domNode.classList.add('diffx-instant-gap-fill');
      const zones = domNode.querySelectorAll(
        '.view-zone, .margin-view-zones > div, .diff-hidden-lines, .diagonal-fill, .ced-diagonal-fill'
      );
      zones.forEach((z: HTMLElement) => {
        z.style.setProperty('height', '0px', 'important');
        z.style.setProperty('min-height', '0px', 'important');
        z.style.setProperty('max-height', '0px', 'important');
        z.style.setProperty('display', 'none', 'important');
        z.style.setProperty('opacity', '0', 'important');
        z.style.setProperty('pointer-events', 'none', 'important');
      });
      setTimeout(() => {
        try {
          domNode.classList.remove('diffx-instant-gap-fill');
        } catch {
          // ignore
        }
      }, 350);
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

  // Collapse view zones in target editor BEFORE applying edits to prevent any vertical bounce
  if (targetEditor) {
    collapseEditorGapViewZones(targetEditor, chunk.modifiedStart);
  }

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

  // Collapse view zones in target editor BEFORE applying edits to prevent any vertical bounce
  if (targetEditor) {
    collapseEditorGapViewZones(targetEditor, chunk.originalStart);
  }

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
 * Maps a 1-based line number from one side (left or right) to the corresponding
 * 1-based line number on the opposite side based on all diff chunks between them.
 * Accounts for all line count deltas caused by diff insertions, deletions, and modifications above this line.
 */
export function mapLineNumber(
  chunks: DiffChunk[],
  line: number,
  fromSide: 'left' | 'right'
): number {
  if (line <= 0) return 1;
  if (!chunks || !chunks.length) return line;

  const sorted = [...chunks].sort((a, b) => {
    const aStart = fromSide === 'left' ? (a.originalStart || a.modifiedStart) : (a.modifiedStart || a.originalStart);
    const bStart = fromSide === 'left' ? (b.originalStart || b.modifiedStart) : (b.modifiedStart || b.originalStart);
    return aStart - bStart;
  });

  let delta = 0;

  for (const c of sorted) {
    const sStart = fromSide === 'left' ? c.originalStart : c.modifiedStart;
    const sEnd = fromSide === 'left' ? c.originalEnd : c.modifiedEnd;
    const tStart = fromSide === 'left' ? c.modifiedStart : c.originalStart;
    const tEnd = fromSide === 'left' ? c.modifiedEnd : c.originalEnd;

    const sCount = (sStart > 0 && sEnd >= sStart) ? (sEnd - sStart + 1) : 0;
    const tCount = (tStart > 0 && tEnd >= tStart) ? (tEnd - tStart + 1) : 0;

    // Check if line falls strictly before this chunk
    if (sCount > 0 && line < sStart) {
      return Math.max(1, line + delta);
    }
    if (sCount === 0 && line <= sStart) {
      return Math.max(1, line + delta);
    }

    // Check if line falls inside this chunk
    if (sCount > 0 && line >= sStart && line <= sEnd) {
      const offset = line - sStart;
      if (tCount > 0) {
        if (offset < tCount) {
          return tStart + offset;
        } else {
          return tEnd;
        }
      } else {
        return Math.max(1, tStart);
      }
    }

    // Line is after this chunk: accumulate delta
    delta += (tCount - sCount);
  }

  return Math.max(1, line + delta);
}

/**
 * Copies specifically selected lines from Left (Original) to Right (Modified).
 * Matches Beyond Compare fine-grained selection copying:
 * Replaces corresponding target lines if target has lines, or inserts into gap cleanly.
 * When the selection does not intersect a diff chunk, accurately maps lines using mapLineNumber
 * and never hijacks unrelated diff gaps above.
 */
export function executeSelectedLinesCopyL2R(
  originalModel: any,
  modifiedModel: any,
  selection: { startLine: number; endLine: number; text?: string },
  chunk?: DiffChunk | null,
  outRange?: ChunkCopyRange,
  targetEditor?: any,
  allChunks?: DiffChunk[]
): boolean {
  if (!originalModel || !modifiedModel) return false;

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

  // Validate chunk: Only treat chunk as valid if it actually intersects this selection range!
  const isChunkValid = Boolean(
    chunk &&
    (
      (chunk.originalStart > 0 && chunk.originalEnd >= chunk.originalStart && chunk.originalStart <= eLine && chunk.originalEnd >= sLine) ||
      (chunk.originalEnd === 0 && chunk.originalStart >= sLine && chunk.originalStart <= eLine)
    )
  );
  const validChunk = isChunkValid ? chunk : null;

  if (targetEditor) {
    collapseEditorGapViewZones(
      targetEditor,
      validChunk ? validChunk.modifiedStart : mapLineNumber(allChunks || [], sLine, 'left')
    );
  }

  if (validChunk) {
    const sStart = validChunk.originalStart;
    const tStart = validChunk.modifiedStart;
    const tEnd = validChunk.modifiedEnd;
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

  // Fallback if selection does NOT intersect a diff chunk:
  // Map selection line range accurately to target lines using mapLineNumber (respects diffs above!)
  const chunksList = allChunks || [];
  const targetStart = mapLineNumber(chunksList, sLine, 'left');
  const targetEnd = mapLineNumber(chunksList, eLine, 'left');

  if (rightLineCount === 0) {
    const range = { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 };
    modifiedModel.pushEditOperations([], [{ range, text: selectedText }], () => null);
    if (outRange) {
      outRange.startLine = 1;
      outRange.endLine = lineCount;
    }
    return true;
  }

  if (targetStart > rightLineCount) {
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
    return true;
  }

  const clampedTargetStart = Math.max(1, Math.min(targetStart, rightLineCount));
  const clampedTargetEnd = Math.max(clampedTargetStart, Math.min(targetEnd, rightLineCount));
  const range = {
    startLineNumber: clampedTargetStart,
    startColumn: 1,
    endLineNumber: clampedTargetEnd,
    endColumn: modifiedModel.getLineMaxColumn(clampedTargetEnd),
  };
  modifiedModel.pushEditOperations([], [{ range, text: selectedText }], () => null);
  if (outRange) {
    outRange.startLine = clampedTargetStart;
    outRange.endLine = clampedTargetStart + lineCount - 1;
  }
  return true;
}

/**
 * Copies specifically selected lines from Right (Modified) to Left (Original).
 * Respects difference chunk boundaries, replacing only the corresponding lines on the
 * left without destroying unchanged code below the chunk.
 * When the selection does not intersect a diff chunk, accurately maps lines using mapLineNumber
 * and never hijacks unrelated diff gaps above.
 */
export function executeSelectedLinesCopyR2L(
  originalModel: any,
  modifiedModel: any,
  selection: { startLine: number; endLine: number; text?: string },
  chunk?: DiffChunk | null,
  outRange?: ChunkCopyRange,
  targetEditor?: any,
  allChunks?: DiffChunk[]
): boolean {
  if (!originalModel || !modifiedModel) return false;

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

  // Validate chunk: Only treat chunk as valid if it actually intersects this selection range!
  const isChunkValid = Boolean(
    chunk &&
    (
      (chunk.modifiedStart > 0 && chunk.modifiedEnd >= chunk.modifiedStart && chunk.modifiedStart <= eLine && chunk.modifiedEnd >= sLine) ||
      (chunk.modifiedEnd === 0 && chunk.modifiedStart >= sLine && chunk.modifiedStart <= eLine)
    )
  );
  const validChunk = isChunkValid ? chunk : null;

  if (targetEditor) {
    collapseEditorGapViewZones(
      targetEditor,
      validChunk ? validChunk.originalStart : mapLineNumber(allChunks || [], sLine, 'right')
    );
  }

  if (validChunk) {
    const sStart = validChunk.modifiedStart;
    const tStart = validChunk.originalStart;
    const tEnd = validChunk.originalEnd;
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

  // Fallback if selection does NOT intersect a diff chunk:
  // Map selection line range accurately to target lines using mapLineNumber (respects diffs above!)
  const chunksList = allChunks || [];
  const targetStart = mapLineNumber(chunksList, sLine, 'right');
  const targetEnd = mapLineNumber(chunksList, eLine, 'right');

  if (leftLineCount === 0) {
    const range = { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 };
    originalModel.pushEditOperations([], [{ range, text: selectedText }], () => null);
    if (outRange) {
      outRange.startLine = 1;
      outRange.endLine = lineCount;
    }
    return true;
  }

  if (targetStart > leftLineCount) {
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
    return true;
  }

  const clampedTargetStart = Math.max(1, Math.min(targetStart, leftLineCount));
  const clampedTargetEnd = Math.max(clampedTargetStart, Math.min(targetEnd, leftLineCount));
  const range = {
    startLineNumber: clampedTargetStart,
    startColumn: 1,
    endLineNumber: clampedTargetEnd,
    endColumn: originalModel.getLineMaxColumn(clampedTargetEnd),
  };
  originalModel.pushEditOperations([], [{ range, text: selectedText }], () => null);
  if (outRange) {
    outRange.startLine = clampedTargetStart;
    outRange.endLine = clampedTargetStart + lineCount - 1;
  }
  return true;
}
