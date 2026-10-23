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
  FileCheck2,
  ArrowRight,
  ArrowLeft,
  Home,
  FolderOpen,
  Calendar,
  Database,
} from 'lucide-react';
import { FileContentResult, TextCompareOptions } from '@shared/types.js';
import { compareTextContent } from '@shared/comparison-engine/whitespace.js';
import { ConfirmModalConfig } from '../../components/ConfirmModal.js';
import { LineDetailInspector } from '../../components/LineDetailInspector.js';

interface TextCompareViewProps {
  leftPath: string;
  rightPath: string;
  theme?: 'dark' | 'light';
  onSetLeftPath: (p: string) => void;
  onSetRightPath: (p: string) => void;
  onNavigateHome?: () => void;
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

function formatFileMetadata(data: FileContentResult | null, filePath: string) {
  if (!filePath) return null;
  const bytes = data?.size ?? data?.content.length ?? 0;
  const formattedBytes = `${bytes.toLocaleString()} bytes`;
  const lineEnding = data?.content.includes('\r\n') ? 'CRLF' : 'UNIX (LF)';
  const ext = filePath.split('.').pop()?.toUpperCase() || 'TXT';
  const now = new Date();
  const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return {
    dateStr,
    formattedBytes,
    spec: `${ext} • UTF-8 • ${lineEnding}`,
  };
}

export const TextCompareView: React.FC<TextCompareViewProps> = ({
  leftPath,
  rightPath,
  theme = 'dark',
  onSetLeftPath,
  onSetRightPath,
  onNavigateHome,
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

  // Beyond Compare View Filters: 'all' | 'diffs' | 'same'
  const [activeFilter, setActiveFilter] = useState<'all' | 'diffs' | 'same'>('all');

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

  // Cursor & Line Detail Tracking
  const [cursorLineNumber, setCursorLineNumber] = useState<number | null>(1);
  const [activeLeftLineText, setActiveLeftLineText] = useState<string>('');
  const [activeRightLineText, setActiveRightLineText] = useState<string>('');

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

  // Update line details when cursor moves or content updates
  const updateLineDetails = (lineNum: number) => {
    setCursorLineNumber(lineNum);
    if (!diffEditorRef.current) return;
    try {
      const origModel = diffEditorRef.current.getOriginalEditor().getModel();
      const modModel = diffEditorRef.current.getModifiedEditor().getModel();
      if (origModel && lineNum <= origModel.getLineCount()) {
        setActiveLeftLineText(origModel.getLineContent(lineNum));
      } else {
        setActiveLeftLineText('');
      }
      if (modModel && lineNum <= modModel.getLineCount()) {
        setActiveRightLineText(modModel.getLineContent(lineNum));
      } else {
        setActiveRightLineText('');
      }
    } catch {
      // non-fatal
    }
  };

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
        const pos = modifiedEditor.getPosition();
        if (pos) updateLineDetails(pos.lineNumber);
      });

      modifiedEditor.onDidChangeCursorPosition((e: any) => {
        updateLineDetails(e.position.lineNumber);
      });

      const originalEditor = editor.getOriginalEditor();
      originalEditor.onDidChangeModelContent(() => {
        const val = originalEditor.getValue();
        setLeftEditorContent(val);
        setLeftDirty(val !== (leftData?.content ?? ''));
        const pos = originalEditor.getPosition();
        if (pos) updateLineDetails(pos.lineNumber);
      });

      originalEditor.onDidChangeCursorPosition((e: any) => {
        updateLineDetails(e.position.lineNumber);
      });

      // Initial line details
      updateLineDetails(1);
    } catch {
      // Non-fatal
    }
  };

  const handleNextDiff = () => {
    if (diffEditorRef.current && typeof diffEditorRef.current.goToDiff === 'function') {
      diffEditorRef.current.goToDiff('next');
      setTimeout(() => {
        const pos = diffEditorRef.current.getModifiedEditor().getPosition();
        if (pos) updateLineDetails(pos.lineNumber);
      }, 50);
    }
  };

  const handlePrevDiff = () => {
    if (diffEditorRef.current && typeof diffEditorRef.current.goToDiff === 'function') {
      diffEditorRef.current.goToDiff('previous');
      setTimeout(() => {
        const pos = diffEditorRef.current.getModifiedEditor().getPosition();
        if (pos) updateLineDetails(pos.lineNumber);
      }, 50);
    }
  };

  // Section-Level Copy Left-to-Right (Beyond Compare ⇨ arrow)
  const handleCopySectionL2R = () => {
    if (!diffEditorRef.current) return;
    const editor = diffEditorRef.current;
    const lineChanges = editor.getLineChanges();
    if (!lineChanges || lineChanges.length === 0) return;

    const modifiedEditor = editor.getModifiedEditor();
    const originalEditor = editor.getOriginalEditor();
    const currentLine = modifiedEditor.getPosition()?.lineNumber || originalEditor.getPosition()?.lineNumber || 1;

    let targetChange = lineChanges.find(
      (c: any) =>
        (currentLine >= c.originalStartLineNumber && currentLine <= (c.originalEndLineNumber || c.originalStartLineNumber)) ||
        (currentLine >= c.modifiedStartLineNumber && currentLine <= (c.modifiedEndLineNumber || c.modifiedStartLineNumber))
    );

    if (!targetChange) targetChange = lineChanges[0];

    const origModel = originalEditor.getModel();
    const modModel = modifiedEditor.getModel();
    if (!origModel || !modModel) return;

    const origText =
      targetChange.originalEndLineNumber >= targetChange.originalStartLineNumber && targetChange.originalStartLineNumber > 0
        ? origModel.getValueInRange({
            startLineNumber: targetChange.originalStartLineNumber,
            startColumn: 1,
            endLineNumber: targetChange.originalEndLineNumber,
            endColumn: origModel.getLineMaxColumn(targetChange.originalEndLineNumber),
          })
        : '';

    const modRange = {
      startLineNumber: targetChange.modifiedStartLineNumber > 0 ? targetChange.modifiedStartLineNumber : 1,
      startColumn: 1,
      endLineNumber: targetChange.modifiedEndLineNumber > 0 ? targetChange.modifiedEndLineNumber : 1,
      endColumn: modModel.getLineMaxColumn(targetChange.modifiedEndLineNumber > 0 ? targetChange.modifiedEndLineNumber : 1),
    };

    modModel.pushEditOperations([], [{ range: modRange, text: origText }], () => null);
    setRightEditorContent(modModel.getValue());
    setRightDirty(true);
    onUpdateStatus('Diff section copied Left ⇨ Right');
  };

  // Section-Level Copy Right-to-Left (Beyond Compare ⇦ arrow)
  const handleCopySectionR2L = () => {
    if (!diffEditorRef.current) return;
    const editor = diffEditorRef.current;
    const lineChanges = editor.getLineChanges();
    if (!lineChanges || lineChanges.length === 0) return;

    const modifiedEditor = editor.getModifiedEditor();
    const originalEditor = editor.getOriginalEditor();
    const currentLine = originalEditor.getPosition()?.lineNumber || modifiedEditor.getPosition()?.lineNumber || 1;

    let targetChange = lineChanges.find(
      (c: any) =>
        (currentLine >= c.originalStartLineNumber && currentLine <= (c.originalEndLineNumber || c.originalStartLineNumber)) ||
        (currentLine >= c.modifiedStartLineNumber && currentLine <= (c.modifiedEndLineNumber || c.modifiedStartLineNumber))
    );

    if (!targetChange) targetChange = lineChanges[0];

    const origModel = originalEditor.getModel();
    const modModel = modifiedEditor.getModel();
    if (!origModel || !modModel) return;

    const modText =
      targetChange.modifiedEndLineNumber >= targetChange.modifiedStartLineNumber && targetChange.modifiedStartLineNumber > 0
        ? modModel.getValueInRange({
            startLineNumber: targetChange.modifiedStartLineNumber,
            startColumn: 1,
            endLineNumber: targetChange.modifiedEndLineNumber,
            endColumn: modModel.getLineMaxColumn(targetChange.modifiedEndLineNumber),
          })
        : '';

    const origRange = {
      startLineNumber: targetChange.originalStartLineNumber > 0 ? targetChange.originalStartLineNumber : 1,
      startColumn: 1,
      endLineNumber: targetChange.originalEndLineNumber > 0 ? targetChange.originalEndLineNumber : 1,
      endColumn: origModel.getLineMaxColumn(targetChange.originalEndLineNumber > 0 ? targetChange.originalEndLineNumber : 1),
    };

    origModel.pushEditOperations([], [{ range: origRange, text: modText }], () => null);
    setLeftEditorContent(origModel.getValue());
    setLeftDirty(true);
    onUpdateStatus('Diff section copied Right ⇦ Left');
  };

  // Single active line copy L -> R
  const handleCopyActiveLineL2R = () => {
    if (!diffEditorRef.current || cursorLineNumber === null) return;
    const modModel = diffEditorRef.current.getModifiedEditor().getModel();
    const origModel = diffEditorRef.current.getOriginalEditor().getModel();
    if (!modModel || !origModel) return;

    const leftLine = cursorLineNumber <= origModel.getLineCount() ? origModel.getLineContent(cursorLineNumber) : '';
    const rightLineNum = Math.min(cursorLineNumber, modModel.getLineCount());
    const range = {
      startLineNumber: rightLineNum,
      startColumn: 1,
      endLineNumber: rightLineNum,
      endColumn: modModel.getLineMaxColumn(rightLineNum),
    };
    modModel.pushEditOperations([], [{ range, text: leftLine }], () => null);
    setRightEditorContent(modModel.getValue());
    setRightDirty(true);
  };

  // Single active line copy R -> L
  const handleCopyActiveLineR2L = () => {
    if (!diffEditorRef.current || cursorLineNumber === null) return;
    const modModel = diffEditorRef.current.getModifiedEditor().getModel();
    const origModel = diffEditorRef.current.getOriginalEditor().getModel();
    if (!modModel || !origModel) return;

    const rightLine = cursorLineNumber <= modModel.getLineCount() ? modModel.getLineContent(cursorLineNumber) : '';
    const leftLineNum = Math.min(cursorLineNumber, origModel.getLineCount());
    const range = {
      startLineNumber: leftLineNum,
      startColumn: 1,
      endLineNumber: leftLineNum,
      endColumn: origModel.getLineMaxColumn(leftLineNum),
    };
    origModel.pushEditOperations([], [{ range, text: rightLine }], () => null);
    setLeftEditorContent(origModel.getValue());
    setLeftDirty(true);
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

  const language = detectLanguage(leftPath || rightPath);
  const leftMeta = formatFileMetadata(leftData, leftPath);
  const rightMeta = formatFileMetadata(rightData, rightPath);

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-black overflow-hidden text-neutral-900 dark:text-neutral-100 font-sans select-none">
      {/* ================= 1. Beyond Compare Action Toolbar (Image 2 & 3) ================= */}
      <div className="bg-[#f0f0f0] dark:bg-[#0a0a0a] border-b border-[#c8c8c8] dark:border-neutral-800 px-2 py-1 flex items-center justify-between text-xs flex-shrink-0 select-none shadow-xs">
        {/* Left Toolbar Items: Home, Save, Jumpers, Filter Trio (*, ≠, =), Copy L->R, Copy R->L */}
        <div className="flex items-center space-x-1">
          {/* Return to Home launcher */}
          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              title="Return to Sessions Home"
              className="p-1 rounded bg-white dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-800 transition shadow-xs"
            >
              <Home className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Save dirty file button */}
          {(leftDirty || rightDirty) && (
            <button
              onClick={leftDirty ? handleSaveLeft : handleSaveRight}
              title="Save Changes to Disk"
              className="flex items-center space-x-1 px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-[11px] shadow animate-pulse"
            >
              <Save className="w-3 h-3" />
              <span>Save</span>
            </button>
          )}

          <span className="h-4 w-px bg-neutral-300 dark:bg-neutral-800 mx-0.5" />

          {/* Jumpers: Next & Prev Difference */}
          <button
            onClick={handlePrevDiff}
            data-action="prev-diff"
            title="Previous Difference (Shift+F7 / Alt+Up)"
            className="flex items-center space-x-1 px-2 py-1 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition text-[11px] shadow-xs"
          >
            <ArrowUp className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            <span>Prev</span>
          </button>
          <button
            onClick={handleNextDiff}
            data-action="next-diff"
            title="Next Difference (F7 / Alt+Down)"
            className="flex items-center space-x-1 px-2 py-1 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition text-[11px] shadow-xs"
          >
            <ArrowDown className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            <span>Next</span>
          </button>

          <span className="h-4 w-px bg-neutral-300 dark:bg-neutral-800 mx-0.5" />

          {/* Beyond Compare View Filter Trio: All (*), Diffs (≠), Same (=) */}
          <div className="flex items-center bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded p-0.5 shadow-xs">
            <button
              onClick={() => setActiveFilter('all')}
              data-action="filter-all"
              title="Show All Lines (*)"
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                activeFilter === 'all'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              * All
            </button>
            <button
              onClick={() => setActiveFilter('diffs')}
              data-action="filter-diffs"
              title="Show Differences Only (≠)"
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                activeFilter === 'diffs'
                  ? 'bg-red-600 text-white font-bold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              ≠ Diffs
            </button>
            <button
              onClick={() => setActiveFilter('same')}
              data-action="filter-same"
              title="Show Same Only (=)"
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                activeFilter === 'same'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              = Same
            </button>
          </div>

          <span className="h-4 w-px bg-neutral-300 dark:bg-neutral-800 mx-0.5" />

          {/* Section-Level Copy Actions (Image 3) */}
          <button
            onClick={handleCopySectionL2R}
            data-action="copy-l2r"
            title="Copy diff section Left to Right (Alt+Right)"
            disabled={!leftPath || !rightPath}
            className="flex items-center space-x-1 px-2 py-1 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:opacity-40 transition font-semibold text-[11px] shadow-xs"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>Copy L→R</span>
          </button>
          <button
            onClick={handleCopySectionR2L}
            data-action="copy-r2l"
            title="Copy diff section Right to Left (Alt+Left)"
            disabled={!leftPath || !rightPath}
            className="flex items-center space-x-1 px-2 py-1 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 disabled:opacity-40 transition font-semibold text-[11px] shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Copy R→L</span>
          </button>

          <span className="font-mono text-neutral-500 dark:text-neutral-400 text-[11px] px-1">
            {diffStats.diffCount} diffs
          </span>
        </div>

        {/* Right Toolbar Items: Whitespace rules, Layout mode, Revert */}
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
              <option value="none">Rules: Strict</option>
              <option value="trim">Rules: Trim Whitespace</option>
              <option value="all">Rules: Ignore Whitespace</option>
            </select>
          </div>

          {/* View mode toggle (Side-by-Side vs Inline) */}
          <div className="flex items-center bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded p-0.5 shadow-xs">
            <button
              onClick={() => setRenderSideBySide(true)}
              title="Side-by-Side View"
              className={`p-1 rounded transition ${
                renderSideBySide
                  ? 'bg-neutral-200 dark:bg-neutral-800 text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Columns className="w-3 h-3" />
            </button>
            <button
              onClick={() => setRenderSideBySide(false)}
              title="Inline Unified View"
              className={`p-1 rounded transition ${
                !renderSideBySide
                  ? 'bg-neutral-200 dark:bg-neutral-800 text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Rows className="w-3 h-3" />
            </button>
          </div>

          {/* Revert edits */}
          {(leftDirty || rightDirty) && (
            <button
              onClick={handleRevertAll}
              title="Revert unsaved edits"
              className="flex items-center space-x-1 px-2 py-0.5 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 text-[11px]"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Revert</span>
            </button>
          )}

          <span className="font-mono text-[11px] text-neutral-400 uppercase font-semibold">
            {language}
          </span>
        </div>
      </div>

      {/* ================= 2. Beyond Compare Dual Address Header (Strict 50/50 Split) ================= */}
      <div className="bg-[#f6f6f6] dark:bg-[#0c0c0c] border-b border-[#d0d0d0] dark:border-neutral-800 p-1 flex items-center space-x-1.5 flex-shrink-0 w-full max-w-full overflow-hidden">
        {/* Left Address Box with yellow folder browse button [📂] (Image 3) */}
        <div
          className="flex-1 min-w-0 flex items-center bg-white dark:bg-black border border-blue-400 dark:border-blue-900/70 rounded px-1.5 py-0.5 shadow-xs focus-within:ring-1 focus-within:ring-blue-500"
          title={leftPath || 'Left file'}
        >
          <span className="w-4 h-4 rounded bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0 shadow-xs mr-1.5">
            L
          </span>
          <FileCode className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mr-1.5 flex-shrink-0" />
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
            title="Browse Left File (Yellow Folder)"
            className="ml-1 p-1 rounded bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 transition flex-shrink-0 flex items-center space-x-1 shadow-xs"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
            <span className="text-[10px] font-semibold pr-0.5">Browse</span>
          </button>
        </div>

        {/* Swap Sides Button */}
        <button
          onClick={handleSwap}
          data-action="swap"
          title="Swap Left and Right Files"
          className="p-1 rounded bg-[#eaeaea] dark:bg-neutral-900 hover:bg-neutral-300 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-800 transition flex-shrink-0 shadow-xs"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
        </button>

        {/* Right Address Box with yellow folder browse button [📂] (Image 3) */}
        <div
          className="flex-1 min-w-0 flex items-center bg-white dark:bg-black border border-purple-400 dark:border-purple-900/70 rounded px-1.5 py-0.5 shadow-xs focus-within:ring-1 focus-within:ring-purple-500"
          title={rightPath || 'Right file'}
        >
          <span className="w-4 h-4 rounded bg-purple-600 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0 shadow-xs mr-1.5">
            R
          </span>
          <FileCode className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 mr-1.5 flex-shrink-0" />
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
            title="Browse Right File (Yellow Folder)"
            className="ml-1 p-1 rounded bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 transition flex-shrink-0 flex items-center space-x-1 shadow-xs"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
            <span className="text-[10px] font-semibold pr-0.5">Browse</span>
          </button>
        </div>

        {/* Refresh Button */}
        <button
          onClick={loadFiles}
          data-action="reload"
          disabled={isLoading}
          title="Reload comparison (Ctrl+R)"
          className="p-1 rounded bg-[#eaeaea] dark:bg-neutral-900 hover:bg-neutral-300 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-800 transition flex-shrink-0 shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ================= 3. Beyond Compare Dedicated Metadata Line (Image 3) ================= */}
      {(leftPath || rightPath) && (
        <div className="flex items-center bg-[#eaeaea] dark:bg-[#111111] border-b border-[#d8d8d8] dark:border-neutral-800 text-[10px] font-mono px-3 py-0.5 flex-shrink-0 select-none w-full max-w-full overflow-hidden text-neutral-600 dark:text-neutral-400">
          {/* Left Metadata */}
          <div className="w-1/2 flex items-center space-x-3 truncate pr-2">
            {leftMeta ? (
              <>
                <span className="flex items-center space-x-1 truncate text-neutral-800 dark:text-neutral-200">
                  <Calendar className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                  <span>{leftMeta.dateStr}</span>
                </span>
                <span className="flex items-center space-x-1 text-neutral-700 dark:text-neutral-300 font-semibold">
                  <Database className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                  <span>{leftMeta.formattedBytes}</span>
                </span>
                <span className="text-[9px] uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  {leftMeta.spec}
                </span>
              </>
            ) : (
              <span className="italic text-neutral-400">No file loaded on Left</span>
            )}
          </div>

          <div className="h-3 w-px bg-neutral-300 dark:bg-neutral-800 mx-1 flex-shrink-0" />

          {/* Right Metadata */}
          <div className="w-1/2 flex items-center space-x-3 truncate pl-2">
            {rightMeta ? (
              <>
                <span className="flex items-center space-x-1 truncate text-neutral-800 dark:text-neutral-200">
                  <Calendar className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                  <span>{rightMeta.dateStr}</span>
                </span>
                <span className="flex items-center space-x-1 text-neutral-700 dark:text-neutral-300 font-semibold">
                  <Database className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                  <span>{rightMeta.formattedBytes}</span>
                </span>
                <span className="text-[9px] uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  {rightMeta.spec}
                </span>
              </>
            ) : (
              <span className="italic text-neutral-400">No file loaded on Right</span>
            )}
          </div>
        </div>
      )}

      {/* Warnings & Errors */}
      {diffStats.whitespaceDifferenceOnly && options.ignoreWhitespace !== 'none' && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-900 px-3 py-1 text-xs text-emerald-800 dark:text-emerald-300 flex items-center space-x-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>
            <strong>Whitespace Rule Notice:</strong> Normalized contents are identical under <em>"{options.ignoreWhitespace}"</em> rule.
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

      {/* ================= 4. Monaco Diff Editor Canvas (Exact Beyond Compare Colors) ================= */}
      <div className="flex-1 relative min-h-0 bg-white dark:bg-black w-full overflow-hidden">
        {!leftPath && !rightPath ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-600 bg-white dark:bg-black p-8 text-center select-none">
            <FileCheck2 className="w-12 h-12 mb-3 stroke-[1.2] text-blue-500" />
            <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              No Files Loaded in Text Compare
            </h4>
            <p className="text-xs max-w-sm text-neutral-500 mb-4">
              Click <strong>Browse</strong> above or double-click any file in Folder Compare to start comparing.
            </p>
          </div>
        ) : (
          <DiffEditor
            height="100%"
            language={language}
            original={leftEditorContent}
            modified={rightEditorContent}
            theme={theme === 'dark' ? 'beyond-compare-dark' : 'beyond-compare-light'}
            beforeMount={(monaco) => {
              // Beyond Compare crisp light theme (crisp black text, soft red diff background)
              monaco.editor.defineTheme('beyond-compare-light', {
                base: 'vs',
                inherit: true,
                rules: [
                  { token: '', foreground: '000000' },
                ],
                colors: {
                  'editor.background': '#ffffff',
                  'editor.foreground': '#000000',
                  'editorGutter.background': '#f6f6f6',
                  'editorLineNumber.foreground': '#717171',
                  'editorLineNumber.activeForeground': '#000000',
                  'diffEditor.insertedTextBackground': 'rgba(239, 68, 68, 0.12)',
                  'diffEditor.removedTextBackground': 'rgba(239, 68, 68, 0.18)',
                  'diffEditor.insertedLineBackground': 'rgba(239, 68, 68, 0.08)',
                  'diffEditor.removedLineBackground': 'rgba(239, 68, 68, 0.12)',
                  'diffEditor.diagonalFill': '#e5e5e5',
                },
              });

              // Beyond Compare pitch black theme
              monaco.editor.defineTheme('beyond-compare-dark', {
                base: 'vs-dark',
                inherit: true,
                rules: [],
                colors: {
                  'editor.background': '#000000',
                  'editor.foreground': '#f3f4f6',
                  'editorGutter.background': '#050505',
                  'diffEditor.insertedTextBackground': 'rgba(239, 68, 68, 0.22)',
                  'diffEditor.removedTextBackground': 'rgba(239, 68, 68, 0.25)',
                  'diffEditor.insertedLineBackground': 'rgba(239, 68, 68, 0.15)',
                  'diffEditor.removedLineBackground': 'rgba(239, 68, 68, 0.18)',
                  'diffEditor.diagonalFill': '#222222',
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
              fontFamily: "'Consolas', 'Courier New', 'SFMono-Regular', Menlo, Monaco, monospace",
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              diffCodeLens: true,
              renderOverviewRuler: true,
              diffWordWrap: 'on',
              ...(activeFilter === 'diffs' ? ({ hideUnchangedRegions: { enabled: true } } as any) : {}),
            } as any}
          />
        )}
      </div>

      {/* ================= 5. Beyond Compare Line Details Split Inspection Bar (Image 3) ================= */}
      {(leftPath || rightPath) && (
        <LineDetailInspector
          leftLineNumber={cursorLineNumber}
          rightLineNumber={cursorLineNumber}
          leftText={activeLeftLineText}
          rightText={activeRightLineText}
          onCopyLeftToRight={handleCopyActiveLineL2R}
          onCopyRightToLeft={handleCopyActiveLineR2L}
          theme={theme}
        />
      )}
    </div>
  );
};
