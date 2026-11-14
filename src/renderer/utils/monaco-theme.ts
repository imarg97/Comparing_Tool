/**
 * Shared Beyond Compare inspired typography and Monaco DiffEditor theme registration.
 * Ensures consistent bold contrast and box-free diff stripes across all compare views.
 */

export const BEYOND_COMPARE_FONT_FAMILY =
  "'Consolas', 'Lucida Console', 'Courier New', 'DejaVu Sans Mono', 'Liberation Mono', Menlo, Monaco, monospace";

export const BEYOND_COMPARE_FONT_SIZE = 13;
export const BEYOND_COMPARE_LINE_HEIGHT = 20;
export const BEYOND_COMPARE_FONT_WEIGHT = '400';

export function registerBeyondCompareThemes(monaco: any): void {
  monaco.editor.defineTheme('beyond-compare-light', {
    base: 'vs',
    inherit: false,
    rules: [
      { token: '', foreground: '000000', fontStyle: 'normal' },
      { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
      { token: 'keyword', foreground: '000000', fontStyle: 'normal' },
      { token: 'string', foreground: '000000', fontStyle: 'normal' },
      { token: 'number', foreground: '000000', fontStyle: 'normal' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#000000',
      'editorGutter.background': '#ffffff',
      'editorLineNumber.foreground': '#64748b',
      'editorLineNumber.activeForeground': '#000000',
      'editorCursor.foreground': '#000000',
      'editor.lineHighlightBackground': '#00000006',
      'editor.selectionBackground': '#bfdbfe77',
      'editor.selectionHighlightBackground': '#bfdbfe44',
      'diffEditor.insertedTextBackground': '#00000000',
      'diffEditor.removedTextBackground': '#00000000',
      'diffEditor.insertedTextBorder': '#00000000',
      'diffEditor.removedTextBorder': '#00000000',
      'diffEditor.insertedLineBackground': '#ffeded',
      'diffEditor.removedLineBackground': '#ffeded',
      'diffEditor.diagonalFill': '#f8fafc',
      'diffEditorGutter.insertedLineBackground': '#00000000',
      'diffEditorGutter.removedLineBackground': '#00000000',
    },
  });

  monaco.editor.defineTheme('beyond-compare-dark', {
    base: 'vs-dark',
    inherit: false,
    rules: [
      { token: '', foreground: 'e2e8f0', fontStyle: 'normal' },
      { token: 'comment', foreground: '94a3b8', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'e2e8f0', fontStyle: 'normal' },
      { token: 'string', foreground: 'e2e8f0', fontStyle: 'normal' },
      { token: 'number', foreground: 'e2e8f0', fontStyle: 'normal' },
    ],
    colors: {
      'editor.background': '#000000',
      'editor.foreground': '#e2e8f0',
      'editorGutter.background': '#000000',
      'editorLineNumber.foreground': '#94a3b8',
      'editorLineNumber.activeForeground': '#ffffff',
      'editorCursor.foreground': '#ffffff',
      'editor.lineHighlightBackground': '#ffffff0a',
      'editor.selectionBackground': '#3b82f655',
      'editor.selectionHighlightBackground': '#3b82f633',
      'diffEditor.insertedTextBackground': '#00000000',
      'diffEditor.removedTextBackground': '#00000000',
      'diffEditor.insertedTextBorder': '#00000000',
      'diffEditor.removedTextBorder': '#00000000',
      'diffEditor.insertedLineBackground': '#2d1417',
      'diffEditor.removedLineBackground': '#2d1417',
      'diffEditor.diagonalFill': '#0b0b0e',
      'diffEditorGutter.insertedLineBackground': '#00000000',
      'diffEditorGutter.removedLineBackground': '#00000000',
    },
  });
}
