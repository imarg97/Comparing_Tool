import { describe, it, expect } from 'vitest';
import {
  compareTextContent,
  normalizeDocument,
  normalizeLine,
} from '../../src/shared/comparison-engine/whitespace.js';

describe('Whitespace & Text Normalization', () => {
  it('normalizes lines based on ignoreWhitespace strategy', () => {
    const raw = '  const a = 1;   ';
    expect(normalizeLine(raw, { ignoreWhitespace: 'none', ignoreBlankLines: false, ignoreCase: false })).toBe(raw);
    expect(normalizeLine(raw, { ignoreWhitespace: 'trim', ignoreBlankLines: false, ignoreCase: false })).toBe('const a = 1;');
    expect(normalizeLine(raw, { ignoreWhitespace: 'all', ignoreBlankLines: false, ignoreCase: false })).toBe('consta=1;');
  });

  it('ignores blank lines when option is enabled', () => {
    const doc = 'line 1\n\n\nline 2\n';
    const norm = normalizeDocument(doc, { ignoreWhitespace: 'none', ignoreBlankLines: true, ignoreCase: false });
    expect(norm).toBe('line 1\nline 2');
  });

  it('correctly reports when difference is solely due to whitespace', () => {
    const left = 'key: "value"  \nport: 8080\n';
    const right = 'key: "value"\nport: 8080';

    // Strict comparison
    const strictComp = compareTextContent(left, right, {
      ignoreWhitespace: 'none',
      ignoreBlankLines: false,
      ignoreCase: false,
    });
    expect(strictComp.rawIdentical).toBe(false);
    expect(strictComp.normalizedIdentical).toBe(false);

    // Trim whitespace comparison
    const trimComp = compareTextContent(left, right, {
      ignoreWhitespace: 'trim',
      ignoreBlankLines: true,
      ignoreCase: false,
    });
    expect(trimComp.rawIdentical).toBe(false);
    expect(trimComp.normalizedIdentical).toBe(true);
    expect(trimComp.whitespaceDifferenceOnly).toBe(true);
  });
});
