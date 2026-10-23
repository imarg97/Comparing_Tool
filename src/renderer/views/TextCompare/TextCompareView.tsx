import React, { useState, useEffect, useRef } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import {
  FileCode,
  ArrowLeftRight,
  RefreshCw,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Columns,
  Rows,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  Copy,
} from 'lucide-react';
import { FileContentResult, TextCompareOptions } from '@shared/types.js';
import { compareTextContent } from '@shared/comparison-engine/whitespace.js';
import { ConfirmModalConfig } from '../../components/ConfirmModal.js';

interface TextCompareViewProps {
  leftPath: string;
  rightPath: string;
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
          leftRes = await window.diffxAPI.readFile(leftPath);
          setLeftData(leftRes);
          setLeftEditorContent(leftRes.content);
          setLeftDirty(false);
        } else {
          setLeftData(null);
          setLeftEditorContent('');
        }

        if (rightPath) {
          rightRes = await window.diffxAPI.readFile(rightPath);
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
      const selected = await window.diffxAPI.selectFile(leftPath);
      if (selected) onSetLeftPath(selected);
    }
  };

  const handlePickRight = async () => {
    if (window.diffxAPI) {
      const selected = await window.diffxAPI.selectFile(rightPath);
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
      // Update line changes on model update
      editor.onDidUpdateDiff(() => {
        const lineChanges = editor.getLineChanges();
        setDiffStats((prev) => ({
          ...prev,
          diffCount: lineChanges ? lineChanges.length : 0,
        }));
      });

      // Track editor changes for dirty state
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

  // Safe Full File Copy
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
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden text-slate-200">
      {/* 1. File Path Header & Selection Bar */}
      <div className="bg-slate-900 border-b border-slate-800 p-2 flex items-center space-x-2 flex-shrink-0">
        {/* Left File */}
        <div className="flex-1 flex items-center bg-slate-950 border border-slate-700 rounded px-2.5 py-1 focus-within:border-blue-500 transition">
          <FileCode className="w-4 h-4 text-blue-400 mr-2 flex-shrink-0" />
          <input
            type="text"
            value={leftPath}
            onChange={(e) => onSetLeftPath(e.target.value)}
            placeholder="Select Left File..."
            className="bg-transparent text-xs w-full focus:outline-none font-mono text-slate-200 placeholder-slate-500"
          />
          {leftData && !leftData.error && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 ml-1.5 flex-shrink-0">
              {leftData.encoding.toUpperCase()} • {(leftData.size / 1024).toFixed(1)} KB
            </span>
          )}
          <button
            onClick={handlePickLeft}
            className="ml-1.5 text-xs px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            Browse
          </button>
        </div>

        {/* Swap Sides */}
        <button
          onClick={handleSwap}
          title="Swap Left and Right Files (Cmd+Alt+S)"
          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex-shrink-0"
        >
          <ArrowLeftRight className="w-4 h-4" />
        </button>

        {/* Right File */}
        <div className="flex-1 flex items-center bg-slate-950 border border-slate-700 rounded px-2.5 py-1 focus-within:border-blue-500 transition">
          <FileCode className="w-4 h-4 text-purple-400 mr-2 flex-shrink-0" />
          <input
            type="text"
            value={rightPath}
            onChange={(e) => onSetRightPath(e.target.value)}
            placeholder="Select Right File..."
            className="bg-transparent text-xs w-full focus:outline-none font-mono text-slate-200 placeholder-slate-500"
          />
          {rightData && !rightData.error && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 ml-1.5 flex-shrink-0">
              {rightData.encoding.toUpperCase()} • {(rightData.size / 1024).toFixed(1)} KB
            </span>
          )}
          <button
            onClick={handlePickRight}
            className="ml-1.5 text-xs px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            Browse
          </button>
        </div>

        {/* Refresh */}
        <button
          onClick={loadFiles}
          disabled={isLoading}
          title="Refresh comparison (Cmd+R)"
          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex-shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 2. Compare Controls Toolbar */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-3 py-1.5 flex items-center justify-between text-xs flex-shrink-0">
        {/* Navigation & Diff Counters */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5">
            <button
              onClick={handlePrevDiff}
              title="Previous Difference (Shift+F7)"
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-1 text-slate-300">
              {diffStats.diffCount} diffs
            </span>
            <button
              onClick={handleNextDiff}
              title="Next Difference (F7)"
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* View mode toggle (Side by Side vs Inline) */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded p-0.5">
            <button
              onClick={() => setRenderSideBySide(true)}
              title="Side-by-Side Diff"
              className={`p-1 rounded text-xs transition ${
                renderSideBySide ? 'bg-slate-800 text-blue-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setRenderSideBySide(false)}
              title="Inline Unified Diff"
              className={`p-1 rounded text-xs transition ${
                !renderSideBySide ? 'bg-slate-800 text-blue-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Rows className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Whitespace options */}
          <div className="flex items-center space-x-1 pl-2 border-l border-slate-800">
            <Sliders className="w-3 h-3 text-slate-500 mr-1" />
            <select
              value={options.ignoreWhitespace}
              onChange={(e) =>
                setOptions((prev) => ({
                  ...prev,
                  ignoreWhitespace: e.target.value as 'none' | 'trim' | 'all',
                }))
              }
              className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-[11px] text-slate-300 focus:outline-none focus:border-blue-500 font-mono"
            >
              <option value="none">Compare whitespace strictly</option>
              <option value="trim">Ignore leading/trailing whitespace</option>
              <option value="all">Ignore all whitespace</option>
            </select>

            <label className="flex items-center space-x-1 text-[11px] text-slate-400 ml-2 cursor-pointer">
              <input
                type="checkbox"
                checked={options.ignoreBlankLines}
                onChange={(e) =>
                  setOptions((prev) => ({ ...prev, ignoreBlankLines: e.target.checked }))
                }
                className="rounded border-slate-700 bg-slate-800 text-blue-600 w-3 h-3"
              />
              <span>Ignore blank lines</span>
            </label>
          </div>
        </div>

        {/* Copy & Save Actions */}
        <div className="flex items-center space-x-2">
          {/* Copy entire left to right */}
          <button
            onClick={handleCopyLeftToRight}
            title="Copy entire file Left to Right"
            disabled={!leftPath || !rightPath}
            className="flex items-center space-x-1 text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 disabled:opacity-40 transition"
          >
            <Copy className="w-3 h-3" />
            <span>Copy L→R</span>
          </button>

          {/* Copy entire right to left */}
          <button
            onClick={handleCopyRightToLeft}
            title="Copy entire file Right to Left"
            disabled={!leftPath || !rightPath}
            className="flex items-center space-x-1 text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-purple-400 border border-slate-700 disabled:opacity-40 transition"
          >
            <Copy className="w-3 h-3 rotate-180" />
            <span>Copy R→L</span>
          </button>

          {/* Save Left */}
          {leftDirty && (
            <button
              onClick={handleSaveLeft}
              className="flex items-center space-x-1 text-[11px] px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium shadow animate-pulse"
            >
              <Save className="w-3 h-3" />
              <span>Save Left</span>
            </button>
          )}

          {/* Save Right */}
          {rightDirty && (
            <button
              onClick={handleSaveRight}
              className="flex items-center space-x-1 text-[11px] px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-medium shadow animate-pulse"
            >
              <Save className="w-3 h-3" />
              <span>Save Right</span>
            </button>
          )}

          {/* Revert edits */}
          {(leftDirty || rightDirty) && (
            <button
              onClick={handleRevertAll}
              title="Revert unsaved edits back to disk contents"
              className="flex items-center space-x-1 text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Revert</span>
            </button>
          )}

          <span className="text-[11px] font-mono text-slate-500 pl-1">
            Language: <strong className="text-slate-400">{language}</strong>
          </span>
        </div>
      </div>

      {/* 3. Whitespace differences notification banner */}
      {diffStats.whitespaceDifferenceOnly && options.ignoreWhitespace !== 'none' && (
        <div className="bg-emerald-950/40 border-b border-emerald-900/60 px-3 py-1.5 text-xs flex items-center justify-between text-emerald-300">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>
              <strong>Whitespace Rule Notice:</strong> Files differ solely in whitespace or line-endings.
              With the active rule <em>"{options.ignoreWhitespace}"</em>, the normalized contents are identical!
            </span>
          </div>
        </div>
      )}

      {/* Large file warning banner */}
      {(leftData?.isTruncated || rightData?.isTruncated) && (
        <div className="bg-amber-950/40 border-b border-amber-900/60 px-3 py-1.5 text-xs flex items-center justify-between text-amber-300">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              <strong>Large File Guard:</strong> One or more files exceed the 5 MB safety limit. First 5 MB preview loaded to preserve smooth UI responsiveness.
            </span>
          </div>
        </div>
      )}

      {diffError && (
        <div className="bg-rose-950/60 border-b border-rose-900/80 px-3 py-1.5 text-xs flex items-center justify-between text-rose-200">
          <span>{diffError}</span>
          <button
            onClick={() => setDiffError(null)}
            className="text-[10px] uppercase font-bold text-rose-400"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 4. Monaco Diff Editor Canvas */}
      <div className="flex-1 relative min-h-0 bg-[#1e1e1e]">
        {!leftPath && !rightPath ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-slate-950 p-8 text-center">
            <FileCheck2 className="w-12 h-12 text-slate-600 mb-3 stroke-[1.2]" />
            <h4 className="text-base font-semibold text-slate-300 mb-1">
              No Files Loaded in Text Compare
            </h4>
            <p className="text-xs max-w-md text-slate-400 mb-4">
              Select Left and Right files above, or double-click any pair in the Folder Compare tab to inspect syntax-highlighted side-by-side differences.
            </p>
          </div>
        ) : (
          <DiffEditor
            height="100%"
            language={language}
            original={leftEditorContent}
            modified={rightEditorContent}
            theme="vs-dark"
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
              diffWordWrap: 'off',
            }}
          />
        )}
      </div>
    </div>
  );
};
