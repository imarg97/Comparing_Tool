/**
 * Comparison Engine — Whitespace & Text Normalization
 */

import { TextCompareOptions } from '../types.js';

export function normalizeLine(line: string, options: TextCompareOptions): string {
  let processed = line;

  if (options.ignoreCase) {
    processed = processed.toLowerCase();
  }

  if (options.ignoreWhitespace === 'all') {
    processed = processed.replace(/\s+/g, '');
  } else if (options.ignoreWhitespace === 'trim') {
    processed = processed.trim();
  }

  return processed;
}

export function normalizeDocument(text: string, options: TextCompareOptions): string {
  // Normalize Windows \r\n and classic Mac \r to standard \n
  const standardNewlines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = standardNewlines.split('\n');

  const processedLines: string[] = [];
  for (const line of lines) {
    const norm = normalizeLine(line, options);
    if (options.ignoreBlankLines && norm.trim() === '') {
      continue;
    }
    processedLines.push(norm);
  }

  return processedLines.join('\n');
}

export function compareTextContent(
  left: string,
  right: string,
  options: TextCompareOptions
): {
  rawIdentical: boolean;
  normalizedIdentical: boolean;
  whitespaceDifferenceOnly: boolean;
} {
  const rawIdentical = left === right;

  const normalizedLeft = normalizeDocument(left, options);
  const normalizedRight = normalizeDocument(right, options);
  const normalizedIdentical = normalizedLeft === normalizedRight;

  const whitespaceDifferenceOnly = !rawIdentical && normalizedIdentical;

  return {
    rawIdentical,
    normalizedIdentical,
    whitespaceDifferenceOnly,
  };
}
