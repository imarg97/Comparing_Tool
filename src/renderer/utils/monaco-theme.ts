/**
 * Shared Beyond Compare inspired typography and Monaco DiffEditor theme registration.
 * Ensures consistent bold contrast and box-free diff stripes across all compare views.
 */

export const BEYOND_COMPARE_FONT_FAMILY =
  "'Consolas', 'Lucida Console', 'DejaVu Sans Mono', 'Liberation Mono', 'Courier New', Menlo, Monaco, monospace";

export const BEYOND_COMPARE_FONT_SIZE = 13.5;
export const BEYOND_COMPARE_LINE_HEIGHT = 22;
export const BEYOND_COMPARE_FONT_WEIGHT = '700';

export function registerBeyondCompareThemes(monaco: any): void {
  monaco.editor.defineTheme('beyond-compare-light', {
    base: 'vs',
    inherit: false,
    rules: [
      { token: '', foreground: '000000', fontStyle: 'bold' },
      { token: 'comment', foreground: '1f2937', fontStyle: 'bold' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#000000',
      'editorGutter.background': '#f8fafc',
      'editorLineNumber.foreground': '#475569',
      'editorLineNumber.activeForeground': '#000000',
      'editorCursor.foreground': '#000000',
      'editor.lineHighlightBackground': '#00000008',
      'editor.selectionBackground': '#93c5fd88',
      'editor.selectionHighlightBackground': '#bfdbfe66',
      'diffEditor.insertedTextBackground': '#00000000',
      'diffEditor.removedTextBackground': '#00000000',
      'diffEditor.insertedTextBorder': '#00000000',
      'diffEditor.removedTextBorder': '#00000000',
      'diffEditor.insertedLineBackground': '#fdecec',
      'diffEditor.removedLineBackground': '#fdecec',
      'diffEditor.diagonalFill': '#f1f5f9',
      'diffEditorGutter.insertedLineBackground': '#00000000',
      'diffEditorGutter.removedLineBackground': '#00000000',
    },
  });

  monaco.editor.defineTheme('beyond-compare-dark', {
    base: 'vs-dark',
    inherit: false,
    rules: [
      { token: '', foreground: 'ffffff', fontStyle: 'bold' },
      { token: 'comment', foreground: 'e2e8f0', fontStyle: 'bold' },
    ],
    colors: {
      'editor.background': '#000000',
      'editor.foreground': '#ffffff',
      'editorGutter.background': '#000000',
      'editorLineNumber.foreground': '#94a3b8',
      'editorLineNumber.activeForeground': '#ffffff',
      'editorCursor.foreground': '#ffffff',
      'editor.lineHighlightBackground': '#ffffff10',
      'editor.selectionBackground': '#3b82f655',
      'editor.selectionHighlightBackground': '#3b82f633',
      'diffEditor.insertedTextBackground': '#00000000',
      'diffEditor.removedTextBackground': '#00000000',
      'diffEditor.insertedTextBorder': '#00000000',
      'diffEditor.removedTextBorder': '#00000000',
      'diffEditor.insertedLineBackground': '#2b1215',
      'diffEditor.removedLineBackground': '#2b1215',
      'diffEditor.diagonalFill': '#0b0b0e',
      'diffEditorGutter.insertedLineBackground': '#00000000',
      'diffEditorGutter.removedLineBackground': '#00000000',
    },
  });
}
