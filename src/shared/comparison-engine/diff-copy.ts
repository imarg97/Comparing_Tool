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
      const end = c.originalEnd >= c.originalStart ? c.originalEnd : c.originalStart;
      if (line >= c.originalStart && line <= end) {
        return c;
      }
    } else {
      const end = c.modifiedEnd >= c.modifiedStart ? c.modifiedEnd : c.modifiedStart;
      if (line >= c.modifiedStart && line <= end) {
        return c;
      }
    }
  }

  return null;
}

/**
 * Executes Left-to-Right chunk copy directly within Monaco editor models
 */
export function executeChunkCopyL2R(originalModel: any, modifiedModel: any, chunk: DiffChunk): boolean {
  if (!originalModel || !modifiedModel) return false;

  const leftLineCount = originalModel.getLineCount();
  const rightLineCount = modifiedModel.getLineCount();

  let textToInsert = '';
  const hasLeftContent = chunk.originalStart > 0 && chunk.originalEnd >= chunk.originalStart;

  if (hasLeftContent) {
    const startLine = Math.min(chunk.originalStart, leftLineCount);
    const endLine = Math.min(chunk.originalEnd, leftLineCount);
    textToInsert = originalModel.getValueInRange({
      startLineNumber: startLine,
      startColumn: 1,
      endLineNumber: endLine,
      endColumn: originalModel.getLineMaxColumn(endLine),
    });
  }

  const hasRightLines = chunk.modifiedStart > 0 && chunk.modifiedEnd >= chunk.modifiedStart;

  if (hasRightLines) {
    // Replace lines on right
    const startLine = Math.min(chunk.modifiedStart, rightLineCount);
    const endLine = Math.min(chunk.modifiedEnd, rightLineCount);
    const range = {
      startLineNumber: startLine,
      startColumn: 1,
      endLineNumber: endLine,
      endColumn: modifiedModel.getLineMaxColumn(endLine),
    };
    modifiedModel.pushEditOperations([], [{ range, text: textToInsert }], () => null);
  } else {
    // Insert new lines on right
    const insertLine = Math.min(Math.max(1, chunk.modifiedStart), rightLineCount);
    const range = {
      startLineNumber: insertLine,
      startColumn: 1,
      endLineNumber: insertLine,
      endColumn: 1,
    };
    const content = textToInsert ? (insertLine <= rightLineCount ? textToInsert + '\n' : '\n' + textToInsert) : '';
    modifiedModel.pushEditOperations([], [{ range, text: content }], () => null);
  }

  return true;
}

/**
 * Executes Right-to-Left chunk copy directly within Monaco editor models
 */
export function executeChunkCopyR2L(originalModel: any, modifiedModel: any, chunk: DiffChunk): boolean {
  if (!originalModel || !modifiedModel) return false;

  const leftLineCount = originalModel.getLineCount();
  const rightLineCount = modifiedModel.getLineCount();

  let textToInsert = '';
  const hasRightContent = chunk.modifiedStart > 0 && chunk.modifiedEnd >= chunk.modifiedStart;

  if (hasRightContent) {
    const startLine = Math.min(chunk.modifiedStart, rightLineCount);
    const endLine = Math.min(chunk.modifiedEnd, rightLineCount);
    textToInsert = modifiedModel.getValueInRange({
      startLineNumber: startLine,
      startColumn: 1,
      endLineNumber: endLine,
      endColumn: modifiedModel.getLineMaxColumn(endLine),
    });
  }

  const hasLeftLines = chunk.originalStart > 0 && chunk.originalEnd >= chunk.originalStart;

  if (hasLeftLines) {
    const startLine = Math.min(chunk.originalStart, leftLineCount);
    const endLine = Math.min(chunk.originalEnd, leftLineCount);
    const range = {
      startLineNumber: startLine,
      startColumn: 1,
      endLineNumber: endLine,
      endColumn: originalModel.getLineMaxColumn(endLine),
    };
    originalModel.pushEditOperations([], [{ range, text: textToInsert }], () => null);
  } else {
    const insertLine = Math.min(Math.max(1, chunk.originalStart), leftLineCount);
    const range = {
      startLineNumber: insertLine,
      startColumn: 1,
      endLineNumber: insertLine,
      endColumn: 1,
    };
    const content = textToInsert ? (insertLine <= leftLineCount ? textToInsert + '\n' : '\n' + textToInsert) : '';
    originalModel.pushEditOperations([], [{ range, text: content }], () => null);
  }

  return true;
}
