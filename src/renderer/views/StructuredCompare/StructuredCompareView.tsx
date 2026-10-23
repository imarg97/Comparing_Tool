import React, { useState, useEffect, useRef } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import {
  Boxes,
  FileCode,
  ArrowLeftRight,
  RefreshCw,
  Save,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  ShieldCheck,
  AlertCircle,
  ChevronDown,
  ListFilter,
} from 'lucide-react';
import {
  FileContentResult,
  StructuredDiffRequest,
  StructuredDiffResult,
  StructuredFormat,
} from '@shared/types.js';
import { compareStructuredData } from '@shared/comparison-engine/structured.js';
import { ConfirmModalConfig } from '../../components/ConfirmModal.js';

interface StructuredCompareViewProps {
  leftPath: string;
  rightPath: string;
  theme?: 'dark' | 'light';
  onSetLeftPath: (p: string) => void;
  onSetRightPath: (p: string) => void;
  onRequestConfirm: (config: ConfirmModalConfig) => void;
  onUpdateStatus: (text: string, count?: number, durationMs?: number) => void;
}

export function detectFormatFromPath(filePath: string): StructuredFormat {
  if (!filePath) return 'yaml';
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.xml')) return 'xml';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'yaml';
  return 'yaml';
}

export const StructuredCompareView: React.FC<StructuredCompareViewProps> = ({
  leftPath,
  rightPath,
  theme = 'dark',
  onSetLeftPath,
  onSetRightPath,
  onRequestConfirm,
  onUpdateStatus,
}) => {
  // Format & Options
  const [format, setFormat] = useState<StructuredFormat>('yaml');
  const [filterKubernetes, setFilterKubernetes] = useState(true);
  const [ignoreKeysInput, setIgnoreKeysInput] = useState('metadata.resourceVersion, metadata.uid, status');

  // File Data
  const [leftData, setLeftData] = useState<FileContentResult | null>(null);
  const [rightData, setRightData] = useState<FileContentResult | null>(null);
  const [leftEditorContent, setLeftEditorContent] = useState<string>('');
  const [rightEditorContent, setRightEditorContent] = useState<string>('');

  // Dirty State
  const [leftDirty, setLeftDirty] = useState(false);
  const [rightDirty, setRightDirty] = useState(false);

  // Status & Error
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Structured Diff Result & Inspector
  const [diffResult, setDiffResult] = useState<StructuredDiffResult | null>(null);
  const [showInspector, setShowInspector] = useState(false);

  // Monaco Ref
  const diffEditorRef = useRef<any>(null);

  // Auto-detect format whenever paths change
  useEffect(() => {
    const candidatePath = leftPath || rightPath;
    if (candidatePath) {
      const detected = detectFormatFromPath(candidatePath);
      setFormat(detected);
    }
  }, [leftPath, rightPath]);

  // Load files whenever paths change
  useEffect(() => {
    if (leftPath || rightPath) {
      loadFiles();
    } else {
      setLeftData(null);
      setRightData(null);
      setLeftEditorContent('');
      setRightEditorContent('');
      setDiffResult(null);
    }
  }, [leftPath, rightPath]);

  const loadFiles = async () => {
    setIsLoading(true);
    setLoadError(null);
    onUpdateStatus('Loading config file contents...');

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

        // Run structured comparison
        if (leftRes?.content && rightRes?.content) {
          runStructuredDiff(leftRes.content, rightRes.content, format);
        } else {
          setDiffResult(null);
        }

        onUpdateStatus('Config files loaded');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLoadError(`Failed to load config files: ${msg}`);
      onUpdateStatus('Error loading config files');
    } finally {
      setIsLoading(false);
    }
  };

  const runStructuredDiff = (
    leftTxt: string,
    rightTxt: string,
    activeFormat: StructuredFormat
  ) => {
    const ignoreKeys = ignoreKeysInput
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    const request: StructuredDiffRequest = {
      leftContent: leftTxt,
      rightContent: rightTxt,
      format: activeFormat,
      ignoreKeys,
      filterKubernetesNoise: filterKubernetes,
    };

    const res = compareStructuredData(request);
    setDiffResult(res);

    if (res.parseError) {
      setLoadError(res.parseError);
      onUpdateStatus(`Parse warning: ${res.parseError}`);
    } else {
      setLoadError(null);
      onUpdateStatus(
        res.identical
          ? `${activeFormat.toUpperCase()} entities are semantically identical`
          : `${res.items.length} semantic changes detected`
      );
    }
  };

  const handlePickLeft = async () => {
    if (window.diffxAPI) {
      const selected = await window.diffxAPI.selectFile(leftPath, 'left');
      if (selected) {
        onSetLeftPath(selected);
      }
    }
  };

  const handlePickRight = async () => {
    if (window.diffxAPI) {
      const selected = await window.diffxAPI.selectFile(rightPath, 'right');
      if (selected) {
        onSetRightPath(selected);
      }
    }
  };

  const handleSwap = () => {
    const tempP = leftPath;
    onSetLeftPath(rightPath);
    onSetRightPath(tempP);
  };

  // Re-run semantic diff whenever format or noise filter or editor edits change
  useEffect(() => {
    if (leftEditorContent && rightEditorContent) {
      runStructuredDiff(leftEditorContent, rightEditorContent, format);
    }
  }, [format, filterKubernetes, ignoreKeysInput]);

  // Monaco Diff Editor Mounting
  const handleEditorDidMount = (editor: any) => {
    diffEditorRef.current = editor;

    try {
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
      // non-fatal
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
      detail: 'This will write your edits to disk.',
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
            setLoadError(`Save failed: ${res.error}`);
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
      detail: 'This will write your edits to disk.',
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
            setLoadError(`Save failed: ${res.error}`);
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

  const editorLanguage = format === 'xml' ? 'xml' : format === 'json' ? 'json' : 'yaml';

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-black overflow-hidden text-neutral-900 dark:text-neutral-100 font-sans w-full max-w-full">
      {/* 1. Beyond Compare Dual Address Header (Strict 50/50 Split) */}
      <div className="bg-neutral-100 dark:bg-neutral-950 border-b border-neutral-300 dark:border-neutral-800 p-1 flex items-center space-x-1.5 flex-shrink-0 w-full max-w-full overflow-hidden">
        {/* Left Address Box */}
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

        {/* Right Address Box */}
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

        {/* Refresh Button */}
        <button
          onClick={loadFiles}
          disabled={isLoading}
          title="Refresh comparison (Cmd+R)"
          className="p-1 rounded bg-neutral-200 dark:bg-neutral-900 hover:bg-neutral-300 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-800 transition flex-shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 2. Structured Comparison Controls Toolbar */}
      <div className="bg-neutral-100 dark:bg-black border-b border-neutral-300 dark:border-neutral-800 px-2 py-1 flex items-center justify-between text-xs flex-shrink-0 select-none w-full max-w-full overflow-hidden">
        <div className="flex items-center space-x-1.5 min-w-0 overflow-hidden">
          {/* Format Selector: XML, YAML, JSON */}
          <div className="flex items-center bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded p-0.5 flex-shrink-0">
            <button
              onClick={() => setFormat('xml')}
              className={`px-2 py-0.5 rounded text-[11px] transition ${
                format === 'xml'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              XML
            </button>
            <button
              onClick={() => setFormat('yaml')}
              className={`px-2 py-0.5 rounded text-[11px] transition ${
                format === 'yaml'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              YAML
            </button>
            <button
              onClick={() => setFormat('json')}
              className={`px-2 py-0.5 rounded text-[11px] transition ${
                format === 'json'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              JSON
            </button>
          </div>

          <span className="h-3.5 w-px bg-neutral-300 dark:bg-neutral-800 mx-0.5 flex-shrink-0" />

          {/* Jumpers */}
          <button
            onClick={handlePrevDiff}
            title="Previous Difference"
            className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 text-[11px] flex-shrink-0"
          >
            <ArrowUp className="w-3 h-3 text-red-500" />
            <span>Prev</span>
          </button>
          <button
            onClick={handleNextDiff}
            title="Next Difference"
            className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 text-[11px] flex-shrink-0"
          >
            <ArrowDown className="w-3 h-3 text-red-500" />
            <span>Next</span>
          </button>

          {/* Semantic differences summary pill */}
          {diffResult && !diffResult.parseError && (
            <span
              className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-medium border flex-shrink-0 ${
                diffResult.identical
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
              }`}
            >
              {diffResult.identical ? 'Identical' : `${diffResult.items.length} diffs`}
            </span>
          )}

          {/* Infrastructure Noise Filter checkbox */}
          <label className="flex items-center space-x-1 cursor-pointer bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 px-1.5 py-0.5 rounded text-[11px] flex-shrink-0">
            <input
              type="checkbox"
              checked={filterKubernetes}
              onChange={(e) => setFilterKubernetes(e.target.checked)}
              className="rounded border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-blue-600 w-3 h-3"
            />
            <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>Noise Filter</span>
          </label>
        </div>

        {/* Right side actions */}
        <div className="flex items-center space-x-1.5 flex-shrink-0">
          {/* Toggle Inspector Table */}
          <button
            onClick={() => setShowInspector((prev) => !prev)}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded border text-[11px] transition ${
              showInspector
                ? 'bg-blue-600 text-white border-blue-600 font-medium'
                : 'bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100'
            }`}
          >
            <ListFilter className="w-3 h-3" />
            <span>Inspector {diffResult ? `(${diffResult.items.length})` : ''}</span>
          </button>

          {/* Save Left */}
          {leftDirty && (
            <button
              onClick={handleSaveLeft}
              className="flex items-center space-x-1 px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-[11px] shadow animate-pulse"
            >
              <Save className="w-3 h-3" />
              <span>Save L</span>
            </button>
          )}

          {/* Save Right */}
          {rightDirty && (
            <button
              onClick={handleSaveRight}
              className="flex items-center space-x-1 px-2 py-0.5 rounded bg-purple-600 hover:bg-purple-500 text-white font-medium text-[11px] shadow animate-pulse"
            >
              <Save className="w-3 h-3" />
              <span>Save R</span>
            </button>
          )}

          {/* Revert Edits */}
          {(leftDirty || rightDirty) && (
            <button
              onClick={handleRevertAll}
              title="Revert unsaved edits"
              className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 text-[11px]"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Revert</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Ignored Keys Sub-bar */}
      <div className="bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-900 px-3 py-1 flex items-center space-x-2 text-xs flex-shrink-0">
        <span className="font-mono text-[11px] text-neutral-500 flex-shrink-0">
          Ignored Keys / Paths:
        </span>
        <input
          type="text"
          value={ignoreKeysInput}
          onChange={(e) => setIgnoreKeysInput(e.target.value)}
          placeholder="e.g. metadata.resourceVersion, status, @timestamp, checksum"
          className="bg-white dark:bg-black border border-neutral-300 dark:border-neutral-800 rounded px-2 py-0.5 text-xs w-full font-mono text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* 4. Error / Warning Banner */}
      {loadError && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 px-3 py-1 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <span>{loadError}</span>
          </div>
          <button onClick={() => setLoadError(null)} className="font-bold text-[10px] uppercase">
            Dismiss
          </button>
        </div>
      )}

      {/* 5. Beyond Compare Synchronized Split Header Banner (Strict 50/50 Split) */}
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

      {/* 6. Monaco Diff Editor Canvas (Pitch black in dark mode, crisp white in light mode) */}
      <div className="flex-1 relative min-h-0 bg-white dark:bg-black w-full overflow-hidden">
        {!leftPath && !rightPath ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-600 bg-white dark:bg-black p-8 text-center select-none">
            <Boxes className="w-12 h-12 mb-3 stroke-[1.2] text-blue-500" />
            <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              No Files Loaded in Config & XML Compare
            </h4>
            <p className="text-xs max-w-sm text-neutral-500 mb-4">
              Select Left and Right configuration files above (such as <strong>site1.xml vs site2.xml</strong>, or Helm <strong>values.yaml</strong>) to inspect side-by-side differences.
            </p>
          </div>
        ) : (
          <DiffEditor
            height="100%"
            language={editorLanguage}
            original={diffResult ? diffResult.cleanLeft : leftEditorContent}
            modified={diffResult ? diffResult.cleanRight : rightEditorContent}
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
              renderSideBySide: true,
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

      {/* 7. Collapsible Semantic Inspector Drawer */}
      {showInspector && diffResult && (
        <div className="h-48 border-t border-neutral-300 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 flex flex-col flex-shrink-0">
          <div className="flex items-center justify-between px-3 py-1 bg-neutral-200 dark:bg-neutral-900 border-b border-neutral-300 dark:border-neutral-800 text-xs font-medium">
            <span>Semantic Property Inspector ({diffResult.items.length} changes)</span>
            <button
              onClick={() => setShowInspector(false)}
              className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {diffResult.items.length === 0 ? (
              <div className="text-xs text-neutral-500 text-center py-4">
                No semantic differences detected between these entities.
              </div>
            ) : (
              <table className="w-full text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-neutral-300 dark:border-neutral-800 text-left text-neutral-500">
                    <th className="py-1 px-2">Path</th>
                    <th className="py-1 px-2">Status</th>
                    <th className="py-1 px-2">Left Value</th>
                    <th className="py-1 px-2">Right Value</th>
                  </tr>
                </thead>
                <tbody>
                  {diffResult.items.map((item, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-neutral-200 dark:border-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-900/60"
                    >
                      <td className="py-1 px-2 text-blue-600 dark:text-blue-400 font-semibold">
                        {item.keyPath}
                      </td>
                      <td className="py-1 px-2">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                            item.status === 'added'
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              : item.status === 'removed'
                              ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                              : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-1 px-2 text-neutral-600 dark:text-neutral-400 max-w-xs truncate">
                        {String(item.leftValue ?? '')}
                      </td>
                      <td className="py-1 px-2 text-neutral-800 dark:text-neutral-200 max-w-xs truncate">
                        {String(item.rightValue ?? '')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
