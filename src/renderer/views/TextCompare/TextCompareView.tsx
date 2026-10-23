import React, { useState, useEffect, useRef } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import {
  FileCode,
  ArrowLeftRight,
  RefreshCw,
  Save,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  Columns,
  Rows,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { FileContentResult, TextCompareOptions } from '@shared/types.js';
import { compareTextContent } from '@shared/comparison-engine/whitespace.js';
import { ConfirmModalConfig } from '../../components/ConfirmModal.js';

interface TextCompareViewProps {
  leftPath: string;
  rightPath: string;
  theme?: 'dark' | 'light';
  onSetLeftPath: (p: string) => void;
  onSetRightPath: (p: string) => void;
  onRequestConfirm: (config: ConfirmModalConfig) => void;
  onUpdateStatus: (text: string, count?: number, durationMs?: number) => void;
}

export function detectLanguage(filePath: string): string {
  if (!filePath) return 'plaintext';
  const lower = filePath.toLowerCase();
  const ext = lower.split('.').pop() || '';

  const extMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    py: 'python',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    xml: 'xml',
    html: 'html',
    css: 'css',
    scss: 'scss',
    md: 'markdown',
    sql: 'sql',
    ini: 'ini',
    conf: 'ini',
    toml: 'ini',
    dockerfile: 'dockerfile',
    c: 'c',
    cpp: 'cpp',
    go: 'go',
    rs: 'rust',
    java: 'java',
  };

  if (lower.endsWith('dockerfile')) return 'dockerfile';
  return extMap[ext] || 'plaintext';
}

export const TextCompareView: React.FC<TextCompareViewProps> = ({
  leftPath,
  rightPath,
  theme = 'dark',
  onSetLeftPath,
  onSetRightPath,
  onRequestConfirm,
  onUpdateStatus,
}) => {
  // File Content State
  const [leftData, setLeftData] = useState<FileContentResult | null>(null);
  const [rightData, setRightData] = useState<FileContentResult | null>(null);
  const [leftEditorContent, setLeftEditorContent] = useState<string>('');
  const [rightEditorContent, setRightEditorContent] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);

  // Unsaved Edits tracking
  const [leftDirty, setLeftDirty] = useState(false);
  const [rightDirty, setRightDirty] = useState(false);

  // Diff Options State
  const [options, setOptions] = useState<TextCompareOptions>({
    ignoreWhitespace: 'none',
    ignoreBlankLines: false,
    ignoreCase: false,
  });

  const [renderSideBySide, setRenderSideBySide] = useState(true);
  const [diffStats, setDiffStats] = useState<{
    diffCount: number;
    whitespaceDifferenceOnly: boolean;
  }>({ diffCount: 0, whitespaceDifferenceOnly: false });

  // Monaco references
  const diffEditorRef = useRef<any>(null);

  // Load files when paths change
  useEffect(() => {
    if (leftPath || rightPath) {
      loadFiles();
    }
  }, [leftPath, rightPath]);

  const loadFiles = async () => {
    setIsLoading(true);
    setDiffError(null);
    onUpdateStatus('Loading file contents...');

    try {
      if (window.diffxAPI) {
        let leftRes: FileContentResult | null = null;
        let rightRes: FileContentResult | null = null;

        if (leftPath) {
          leftRes = await window.diffxAPI.readFile(leftPath, undefined, 'left');
          setLeftData(leftRes);
          setLeftEditorContent(leftRes.content);
          setLeftDirty(false);
        } else {
          setLeftData(null);
          setLeftEditorContent('');
        }

        if (rightPath) {
          rightRes = await window.diffxAPI.readFile(rightPath, undefined, 'right');
          setRightData(rightRes);
          setRightEditorContent(rightRes.content);
          setRightDirty(false);
        } else {
          setRightData(null);
          setRightEditorContent('');
        }

        // Compare whitespace and raw identity
        if (leftRes && rightRes && !leftRes.error && !rightRes.error) {
          const comp = compareTextContent(leftRes.content, rightRes.content, options);
          setDiffStats((prev) => ({
            ...prev,
            whitespaceDifferenceOnly: comp.whitespaceDifferenceOnly,
          }));
        }

        onUpdateStatus('Files loaded');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setDiffError(`Failed to load file contents: ${msg}`);
      onUpdateStatus('Error loading files');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickLeft = async () => {
    if (window.diffxAPI) {
      const selected = await window.diffxAPI.selectFile(leftPath, 'left');
      if (selected) onSetLeftPath(selected);
    }
  };

  const handlePickRight = async () => {
    if (window.diffxAPI) {
      const selected = await window.diffxAPI.selectFile(rightPath, 'right');
      if (selected) onSetRightPath(selected);
    }
  };

  const handleSwap = () => {
    const tempP = leftPath;
    onSetLeftPath(rightPath);
    onSetRightPath(tempP);
  };

  // Re-evaluate comparison whenever options change
  useEffect(() => {
    if (leftData && rightData) {
      const comp = compareTextContent(leftEditorContent, rightEditorContent, options);
      setDiffStats((prev) => ({
        ...prev,
        whitespaceDifferenceOnly: comp.whitespaceDifferenceOnly,
      }));
    }
  }, [options, leftEditorContent, rightEditorContent, leftData, rightData]);

  // Monaco Diff Editor Mounting
  const handleEditorDidMount = (editor: any) => {
    diffEditorRef.current = editor;

    try {
      editor.onDidUpdateDiff(() => {
        const lineChanges = editor.getLineChanges();
        setDiffStats((prev) => ({
          ...prev,
          diffCount: lineChanges ? lineChanges.length : 0,
        }));
      });

      const modifiedEditor = editor.getModifiedEditor();
      modifiedEditor.onDidChangeModelContent(() => {
        const val = modifiedEditor.getValue();
        setRightEditorContent(val);
        setRightDirty(val !== (rightData?.content ?? ''));
      });

      const originalEditor = editor.getOriginalEditor();
      originalEditor.onDidChangeModelContent(() => {
        const val = originalEditor.getValue();
        setLeftEditorContent(val);
        setLeftDirty(val !== (leftData?.content ?? ''));
      });
    } catch {
      // Non-fatal
    }
  };

  const handleNextDiff = () => {
    if (diffEditorRef.current && typeof diffEditorRef.current.goToDiff === 'function') {
      diffEditorRef.current.goToDiff('next');
    }
  };

  const handlePrevDiff = () => {
    if (diffEditorRef.current && typeof diffEditorRef.current.goToDiff === 'function') {
      diffEditorRef.current.goToDiff('previous');
    }
  };

  // Safe Save Operations
  const handleSaveLeft = () => {
    if (!leftPath) return;

    onRequestConfirm({
      isOpen: true,
      title: 'Save Left File Changes',
      actionType: 'save',
      destinationPath: leftPath,
      isDestinationExisting: true,
      message: `Save modified contents back to '${leftPath.split('/').pop()}'?`,
      detail: 'This will write your unsaved edits to disk.',
      onConfirm: async ({ createBackup }) => {
        if (window.diffxAPI) {
          const res = await window.diffxAPI.saveFile({
            filePath: leftPath,
            content: leftEditorContent,
            createBackup,
          });
          if (res.success) {
            setLeftDirty(false);
            loadFiles();
          } else {
            setDiffError(`Save failed: ${res.error}`);
          }
        }
      },
      onCancel: () => {},
    });
  };

  const handleSaveRight = () => {
    if (!rightPath) return;

    onRequestConfirm({
      isOpen: true,
      title: 'Save Right File Changes',
      actionType: 'save',
      destinationPath: rightPath,
      isDestinationExisting: true,
      message: `Save modified contents back to '${rightPath.split('/').pop()}'?`,
      detail: 'This will write your unsaved edits to disk.',
      onConfirm: async ({ createBackup }) => {
        if (window.diffxAPI) {
          const res = await window.diffxAPI.saveFile({
            filePath: rightPath,
            content: rightEditorContent,
            createBackup,
          });
          if (res.success) {
            setRightDirty(false);
            loadFiles();
          } else {
            setDiffError(`Save failed: ${res.error}`);
          }
        }
      },
      onCancel: () => {},
    });
  };

  const handleRevertAll = () => {
    if (leftData) {
      setLeftEditorContent(leftData.content);
      if (diffEditorRef.current) {
        diffEditorRef.current.getOriginalEditor().setValue(leftData.content);
      }
      setLeftDirty(false);
    }
    if (rightData) {
      setRightEditorContent(rightData.content);
      if (diffEditorRef.current) {
        diffEditorRef.current.getModifiedEditor().setValue(rightData.content);
      }
      setRightDirty(false);
    }
  };

  const handleCopyLeftToRight = () => {
    if (!leftPath || !rightPath) return;

    onRequestConfirm({
      isOpen: true,
      title: 'Replace Right File with Left File',
      actionType: 'copy-l2r',
      sourcePath: leftPath,
      destinationPath: rightPath,
      isDestinationExisting: true,
      message: `Replace destination '${rightPath.split('/').pop()}' with the contents of left file?`,
      detail: 'The entire file on the right side will be updated.',
      onConfirm: async ({ createBackup }) => {
        if (window.diffxAPI) {
          const res = await window.diffxAPI.copyFile({
            sourcePath: leftPath,
            destinationPath: rightPath,
            overwrite: true,
            createBackup,
          });
          if (res.success) {
            loadFiles();
          } else {
            setDiffError(`Copy failed: ${res.error}`);
          }
        }
      },
      onCancel: () => {},
    });
  };

  const handleCopyRightToLeft = () => {
    if (!leftPath || !rightPath) return;

    onRequestConfirm({
      isOpen: true,
      title: 'Replace Left File with Right File',
      actionType: 'copy-r2l',
      sourcePath: rightPath,
      destinationPath: leftPath,
      isDestinationExisting: true,
      message: `Replace destination '${leftPath.split('/').pop()}' with the contents of right file?`,
      detail: 'The entire file on the left side will be updated.',
      onConfirm: async ({ createBackup }) => {
        if (window.diffxAPI) {
          const res = await window.diffxAPI.copyFile({
            sourcePath: rightPath,
            destinationPath: leftPath,
            overwrite: true,
            createBackup,
          });
          if (res.success) {
            loadFiles();
          } else {
            setDiffError(`Copy failed: ${res.error}`);
          }
        }
      },
      onCancel: () => {},
    });
  };

  const language = detectLanguage(leftPath || rightPath);

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-black overflow-hidden text-neutral-900 dark:text-neutral-100 font-sans">
      {/* 1. Beyond Compare Dual Address Header (Strict 50/50 Split) */}
      <div className="bg-neutral-100 dark:bg-neutral-950 border-b border-neutral-300 dark:border-neutral-800 p-1 flex items-center space-x-1.5 flex-shrink-0 w-full max-w-full overflow-hidden">
        {/* Left File Address Box */}
        <div
          className="flex-1 min-w-0 flex items-center bg-white dark:bg-black border border-blue-300 dark:border-blue-900/60 rounded px-1.5 py-0.5 shadow-sm focus-within:ring-1 focus-within:ring-blue-500"
          title={leftPath || 'Left file'}
        >
          <span className="w-4 h-4 rounded bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0 shadow-sm mr-1.5">
            L
          </span>
          <FileCode className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mr-1 flex-shrink-0" />
          <input
            type="text"
            value={leftPath}
            onChange={(e) => onSetLeftPath(e.target.value)}
            placeholder="Left file path..."
            className="bg-transparent text-[11px] w-full min-w-0 focus:outline-none font-mono text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 truncate"
            title={leftPath || 'Left file path'}
          />
          <button
            onClick={handlePickLeft}
            className="ml-1 text-[11px] font-medium px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition flex-shrink-0"
          >
            Browse...
          </button>
        </div>

        {/* Swap Button */}
        <button
          onClick={handleSwap}
          title="Swap Left and Right Files"
          className="p-1 rounded bg-neutral-200 dark:bg-neutral-900 hover:bg-neutral-300 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-800 transition flex-shrink-0"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
        </button>

        {/* Right File Address Box */}
        <div
          className="flex-1 min-w-0 flex items-center bg-white dark:bg-black border border-purple-300 dark:border-purple-900/60 rounded px-1.5 py-0.5 shadow-sm focus-within:ring-1 focus-within:ring-purple-500"
          title={rightPath || 'Right file'}
        >
          <span className="w-4 h-4 rounded bg-purple-600 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0 shadow-sm mr-1.5">
            R
          </span>
          <FileCode className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 mr-1 flex-shrink-0" />
          <input
            type="text"
            value={rightPath}
            onChange={(e) => onSetRightPath(e.target.value)}
            placeholder="Right file path..."
            className="bg-transparent text-[11px] w-full min-w-0 focus:outline-none font-mono text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 truncate"
            title={rightPath || 'Right file path'}
          />
          <button
            onClick={handlePickRight}
            className="ml-1 text-[11px] font-medium px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 transition flex-shrink-0"
          >
            Browse...
          </button>
        </div>

        {/* Refresh / Re-compare */}
        <button
          onClick={loadFiles}
          disabled={isLoading}
          title="Refresh comparison (Cmd+R)"
          className="p-1 rounded bg-neutral-200 dark:bg-neutral-900 hover:bg-neutral-300 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-800 transition flex-shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 2. Beyond Compare Text Compare Action Toolbar */}
      <div className="bg-neutral-100 dark:bg-black border-b border-neutral-300 dark:border-neutral-800 px-3 py-1 flex items-center justify-between text-xs flex-shrink-0 select-none">
        {/* Navigation & Difference Jumpers */}
        <div className="flex items-center space-x-1.5">
          {/* Previous Diff button */}
          <button
            onClick={handlePrevDiff}
            title="Previous Difference (Shift+F7 / Alt+Up)"
            className="flex items-center space-x-1 px-2 py-1 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <ArrowUp className="w-3.5 h-3.5 text-red-500" />
            <span>Prev Diff</span>
          </button>

          {/* Next Diff button */}
          <button
            onClick={handleNextDiff}
            title="Next Difference (F7 / Alt+Down)"
            className="flex items-center space-x-1 px-2 py-1 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <ArrowDown className="w-3.5 h-3.5 text-red-500" />
            <span>Next Diff</span>
          </button>

          <span className="font-mono text-neutral-500 dark:text-neutral-400 text-[11px] px-1">
            {diffStats.diffCount} differences
          </span>

          <span className="h-4 w-px bg-neutral-300 dark:bg-neutral-800 mx-1" />

          {/* Copy section L -> R */}
          <button
            onClick={handleCopyLeftToRight}
            title="Copy file Left to Right"
            disabled={!leftPath || !rightPath}
            className="flex items-center space-x-1 px-2 py-1 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:opacity-40 transition font-medium"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>Copy L→R</span>
          </button>

          {/* Copy section R -> L */}
          <button
            onClick={handleCopyRightToLeft}
            title="Copy file Right to Left"
            disabled={!leftPath || !rightPath}
            className="flex items-center space-x-1 px-2 py-1 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 disabled:opacity-40 transition font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Copy R→L</span>
          </button>

          <span className="h-4 w-px bg-neutral-300 dark:bg-neutral-800 mx-1" />

          {/* View mode toggle (Side by Side vs Inline) */}
          <button
            onClick={() => setRenderSideBySide(true)}
            title="Side-by-Side Diff"
            className={`p-1 rounded transition ${
              renderSideBySide
                ? 'bg-neutral-300 dark:bg-neutral-800 text-blue-600 dark:text-blue-400 font-bold border border-neutral-400 dark:border-neutral-700'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-900'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setRenderSideBySide(false)}
            title="Inline Unified Diff"
            className={`p-1 rounded transition ${
              !renderSideBySide
                ? 'bg-neutral-300 dark:bg-neutral-800 text-blue-600 dark:text-blue-400 font-bold border border-neutral-400 dark:border-neutral-700'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-900'
            }`}
          >
            <Rows className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right Controls: Whitespace & Save buttons */}
        <div className="flex items-center space-x-2">
          {/* Whitespace options */}
          <div className="flex items-center space-x-1">
            <Sliders className="w-3 h-3 text-neutral-400 mr-1" />
            <select
              value={options.ignoreWhitespace}
              onChange={(e) =>
                setOptions((prev) => ({
                  ...prev,
                  ignoreWhitespace: e.target.value as 'none' | 'trim' | 'all',
                }))
              }
              className="bg-white dark:bg-black border border-neutral-300 dark:border-neutral-800 rounded px-1.5 py-0.5 text-[11px] text-neutral-800 dark:text-neutral-200 focus:outline-none"
            >
              <option value="none">Strict Whitespace</option>
              <option value="trim">Ignore Leading/Trailing</option>
              <option value="all">Ignore All Whitespace</option>
            </select>
          </div>

          {/* Save Left */}
          {leftDirty && (
            <button
              onClick={handleSaveLeft}
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium shadow animate-pulse"
            >
              <Save className="w-3 h-3" />
              <span>Save Left</span>
            </button>
          )}

          {/* Save Right */}
          {rightDirty && (
            <button
              onClick={handleSaveRight}
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-medium shadow animate-pulse"
            >
              <Save className="w-3 h-3" />
              <span>Save Right</span>
            </button>
          )}

          {/* Revert edits */}
          {(leftDirty || rightDirty) && (
            <button
              onClick={handleRevertAll}
              title="Revert unsaved edits"
              className="flex items-center space-x-1 px-2 py-1 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Revert</span>
            </button>
          )}

          <span className="font-mono text-[11px] text-neutral-400 pl-1">
            {language}
          </span>
        </div>
      </div>

      {/* 3. Whitespace differences notification banner */}
      {diffStats.whitespaceDifferenceOnly && options.ignoreWhitespace !== 'none' && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-900 px-3 py-1 text-xs text-emerald-800 dark:text-emerald-300 flex items-center space-x-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>
            <strong>Whitespace Rule Notice:</strong> Files differ solely in whitespace or line-endings.
            With the active rule <em>"{options.ignoreWhitespace}"</em>, the normalized contents are identical!
          </span>
        </div>
      )}

      {/* Large file warning banner */}
      {(leftData?.isTruncated || rightData?.isTruncated) && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 px-3 py-1 text-xs text-amber-800 dark:text-amber-300 flex items-center space-x-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>
            <strong>Large File Guard:</strong> One or more files exceed the 5 MB safety limit. First 5 MB preview loaded.
          </span>
        </div>
      )}

      {diffError && (
        <div className="bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900 px-3 py-1 text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
          <span>{diffError}</span>
          <button onClick={() => setDiffError(null)} className="font-bold text-[10px] uppercase">
            Dismiss
          </button>
        </div>
      )}

      {/* 4. Beyond Compare Synchronized Split Header Banner (Strict 50/50 Split) */}
      {(leftPath || rightPath) && (
        <div className="flex items-center bg-neutral-200/70 dark:bg-neutral-900/90 border-b border-neutral-300 dark:border-neutral-800 text-[11px] font-mono px-2 py-0.5 flex-shrink-0 select-none w-full max-w-full overflow-hidden">
          <div className="w-1/2 flex items-center space-x-1.5 truncate pr-2 text-blue-700 dark:text-blue-300 min-w-0" title={leftPath}>
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block flex-shrink-0"></span>
            <span className="font-bold text-[10px] uppercase tracking-wider text-blue-600 dark:text-blue-400 flex-shrink-0">L:</span>
            <span className="truncate font-semibold">{leftPath || '(none)'}</span>
          </div>
          <div className="h-3.5 w-px bg-neutral-300 dark:bg-neutral-800 mx-1 flex-shrink-0"></div>
          <div className="w-1/2 flex items-center space-x-1.5 truncate pl-2 text-purple-700 dark:text-purple-300 min-w-0" title={rightPath}>
            <span className="w-2 h-2 rounded-full bg-purple-500 inline-block flex-shrink-0"></span>
            <span className="font-bold text-[10px] uppercase tracking-wider text-purple-600 dark:text-purple-400 flex-shrink-0">R:</span>
            <span className="truncate font-semibold">{rightPath || '(none)'}</span>
          </div>
        </div>
      )}

      {/* 5. Monaco Diff Editor Canvas (Pitch black in dark mode, crisp white in light mode) */}
      <div className="flex-1 relative min-h-0 bg-white dark:bg-black w-full overflow-hidden">
        {!leftPath && !rightPath ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-600 bg-white dark:bg-black p-8 text-center select-none">
            <FileCheck2 className="w-12 h-12 mb-3 stroke-[1.2]" />
            <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              No Files Loaded in Text Compare
            </h4>
            <p className="text-xs max-w-sm text-neutral-500 mb-4">
              Select Left and Right files above, or double-click any pair in Folder Compare to inspect side-by-side differences.
            </p>
          </div>
        ) : (
          <DiffEditor
            height="100%"
            language={language}
            original={leftEditorContent}
            modified={rightEditorContent}
            theme={theme === 'dark' ? 'pitch-black' : 'vs'}
            beforeMount={(monaco) => {
              monaco.editor.defineTheme('pitch-black', {
                base: 'vs-dark',
                inherit: true,
                rules: [],
                colors: {
                  'editor.background': '#000000',
                  'editorGutter.background': '#050505',
                  'diffEditor.insertedTextBackground': 'rgba(34, 197, 94, 0.20)',
                  'diffEditor.removedTextBackground': 'rgba(239, 68, 68, 0.25)',
                },
              });
            }}
            onMount={handleEditorDidMount}
            options={{
              renderSideBySide,
              ignoreTrimWhitespace: options.ignoreWhitespace !== 'none',
              readOnly: false,
              originalEditable: true,
              fontSize: 12,
              fontFamily: "'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              diffCodeLens: true,
              renderOverviewRuler: true,
              diffWordWrap: 'on',
            }}
          />
        )}
      </div>
    </div>
  );
};
