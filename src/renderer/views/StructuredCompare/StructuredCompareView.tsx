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
  Home,
  FolderOpen,
  Calendar,
  Database,
  ArrowRight,
  ArrowLeft,
  Columns,
  Rows,
  Copy,
  Check,
} from 'lucide-react';
import {
  FileContentResult,
  StructuredDiffRequest,
  StructuredDiffResult,
  StructuredFormat,
} from '@shared/types.js';
import { compareStructuredData } from '@shared/comparison-engine/structured.js';
import {
  DiffChunk,
  normalizeLineChanges,
  findChunkAtLine,
  executeChunkCopyL2R,
  executeChunkCopyR2L,
  ChunkCopyRange,
} from '@shared/comparison-engine/diff-copy.js';
import { ConfirmModalConfig } from '../../components/ConfirmModal.js';
import { LineDetailInspector } from '../../components/LineDetailInspector.js';
import { DiffOverviewMap } from '../../components/DiffOverviewMap.js';

interface StructuredCompareViewProps {
  leftPath: string;
  rightPath: string;
  theme?: 'dark' | 'light';
  onSetLeftPath: (p: string) => void;
  onSetRightPath: (p: string) => void;
  onNavigateHome?: () => void;
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

function formatFileMetadata(data: FileContentResult | null, filePath: string, format: string) {
  if (!filePath) return null;
  const bytes = data?.size ?? data?.content.length ?? 0;
  const formattedBytes = `${bytes.toLocaleString()} bytes`;
  const lineEnding = data?.content.includes('\r\n') ? 'CRLF' : 'UNIX (LF)';
  const now = new Date();
  const dateStr =
    now.toLocaleDateString() +
    ' ' +
    now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return {
    dateStr,
    formattedBytes,
    spec: `${format.toUpperCase()} • UTF-8 • ${lineEnding}`,
  };
}

export const StructuredCompareView: React.FC<StructuredCompareViewProps> = ({
  leftPath,
  rightPath,
  theme = 'dark',
  onSetLeftPath,
  onSetRightPath,
  onNavigateHome,
  onRequestConfirm,
  onUpdateStatus,
}) => {
  // Format & Options
  const [format, setFormat] = useState<StructuredFormat>('yaml');
  const [filterKubernetes, setFilterKubernetes] = useState(true);
  const [ignoreKeysInput, _setIgnoreKeysInput] = useState('metadata.resourceVersion, metadata.uid, status');

  // File Data
  const [leftData, setLeftData] = useState<FileContentResult | null>(null);
  const [rightData, setRightData] = useState<FileContentResult | null>(null);
  const [leftEditorContent, setLeftEditorContent] = useState<string>('');
  const [rightEditorContent, setRightEditorContent] = useState<string>('');

  // Dirty State
  const [leftDirty, setLeftDirty] = useState(false);
  const [rightDirty, setRightDirty] = useState(false);

  // Beyond Compare View Filters: 'all' | 'diffs' | 'same'
  const [activeFilter, setActiveFilter] = useState<'all' | 'diffs' | 'same'>('all');
  const [renderSideBySide, setRenderSideBySide] = useState(true);

  // Status & Error
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Structured Diff Result & Inspector
  const [diffResult, setDiffResult] = useState<StructuredDiffResult | null>(null);
  const [showInspector, setShowInspector] = useState(false);

  // Cursor & Line Detail Tracking
  const [cursorLineNumber, setCursorLineNumber] = useState<number | null>(1);
  const [activeLeftLineText, setActiveLeftLineText] = useState<string>('');
  const [activeRightLineText, setActiveRightLineText] = useState<string>('');

  // Active Selected Diff Chunk (e.g. lines 74–87) & User Range Selection
  const [diffChunks, setDiffChunks] = useState<DiffChunk[]>([]);
  const [activeDiffChunk, setActiveDiffChunk] = useState<DiffChunk | null>(null);
  const [activeSelection, setActiveSelection] = useState<{
    side: 'left' | 'right';
    startLine: number;
    endLine: number;
    text: string;
  } | null>(null);

  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  // Drag and drop states across whole page
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const [dragHoverSide, setDragHoverSide] = useState<'left' | 'right' | null>(null);
  const dragCounterRef = useRef(0);

  const extractDroppedPaths = (e: React.DragEvent): string[] => {
    const paths: string[] = [];
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        const p = (file as any).path || file.name;
        if (p) paths.push(p);
      }
    }
    return paths;
  };

  const handleDropToSide = (paths: string[], targetSide: 'left' | 'right') => {
    if (!paths.length) return;
    if (paths.length >= 2) {
      onSetLeftPath(paths[0]);
      onSetRightPath(paths[1]);
      onUpdateStatus(`Loaded Left (${paths[0].split(/[/\\]/).pop()}) and Right (${paths[1].split(/[/\\]/).pop()})`);
    } else if (targetSide === 'left') {
      onSetLeftPath(paths[0]);
      onUpdateStatus(`Loaded Left config: ${paths[0].split(/[/\\]/).pop()}`);
    } else {
      onSetRightPath(paths[0]);
      onUpdateStatus(`Loaded Right config: ${paths[0].split(/[/\\]/).pop()}`);
    }
  };

  const handleDropLeft = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingLeft(false);
    setDragHoverSide(null);
    dragCounterRef.current = 0;
    const paths = extractDroppedPaths(e);
    handleDropToSide(paths, 'left');
  };

  const handleDropRight = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingRight(false);
    setDragHoverSide(null);
    dragCounterRef.current = 0;
    const paths = extractDroppedPaths(e);
    handleDropToSide(paths, 'right');
  };

  const handleContainerDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
  };

  const handleContainerDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const side = e.clientX < midX ? 'left' : 'right';
    setDragHoverSide(side);
  };

  const handleContainerDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setDragHoverSide(null);
    }
  };

  const handleContainerDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const side = dragHoverSide || 'left';
    dragCounterRef.current = 0;
    setDragHoverSide(null);
    const paths = extractDroppedPaths(e);
    handleDropToSide(paths, side);
  };

  // Monaco Ref
  const diffEditorRef = useRef<any>(null);
  const leftDecorationsRef = useRef<string[]>([]);
  const rightDecorationsRef = useRef<string[]>([]);
  const copiedHighlightDecsRef = useRef<{ left: string[]; right: string[] }>({ left: [], right: [] });
  const chunksRef = useRef<DiffChunk[]>([]);
  chunksRef.current = diffChunks;

  // Active focus side for shortcuts & save
  const [activeFocusSide, setActiveFocusSide] = useState<'left' | 'right'>('right');
  const [lastModifiedSide, setLastModifiedSide] = useState<'left' | 'right'>('right');

  // Flash highlight on copied differences (L2R or R2L)
  const flashCopiedHighlight = (side: 'left' | 'right', startLine: number, endLine: number) => {
    if (!diffEditorRef.current) return;
    try {
      const editor = side === 'left' ? diffEditorRef.current.getOriginalEditor() : diffEditorRef.current.getModifiedEditor();
      if (!editor) return;

      const s = Math.max(1, startLine);
      const e = Math.max(s, endLine);
      const decs = [
        {
          range: {
            startLineNumber: s,
            startColumn: 1,
            endLineNumber: e,
            endColumn: editor.getModel()?.getLineMaxColumn(e) || 1,
          },
          options: {
            isWholeLine: true,
            className: 'diffx-copied-highlight',
          },
        },
      ];

      if (side === 'left') {
        copiedHighlightDecsRef.current.left = editor.deltaDecorations(copiedHighlightDecsRef.current.left, decs);
      } else {
        copiedHighlightDecsRef.current.right = editor.deltaDecorations(copiedHighlightDecsRef.current.right, decs);
      }

      editor.revealLinesInCenter(s, e);
      editor.setPosition({ lineNumber: s, column: 1 });

      setTimeout(() => {
        if (!diffEditorRef.current) return;
        try {
          if (side === 'left') {
            copiedHighlightDecsRef.current.left = editor.deltaDecorations(copiedHighlightDecsRef.current.left, []);
          } else {
            copiedHighlightDecsRef.current.right = editor.deltaDecorations(copiedHighlightDecsRef.current.right, []);
          }
        } catch {
          // ignore
        }
      }, 2500);
    } catch {
      // ignore
    }
  };

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
    if (res.cleanLeft) setLeftEditorContent(res.cleanLeft);
    if (res.cleanRight) setRightEditorContent(res.cleanRight);

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

      const chunk = findChunkAtLine(chunksRef.current, lineNum, 'left') || findChunkAtLine(chunksRef.current, lineNum, 'right');
      setActiveDiffChunk(chunk);
    } catch {
      // non-fatal
    }
  };

  // Update Gutter Arrow Icons for each diff chunk (Image 3)
  const updateGutterDecorations = () => {
    if (!diffEditorRef.current) return;
    try {
      const lineChanges = diffEditorRef.current.getLineChanges();
      const chunks = normalizeLineChanges(lineChanges);
      setDiffChunks(chunks);

      const origEditor = diffEditorRef.current.getOriginalEditor();
      const modEditor = diffEditorRef.current.getModifiedEditor();

      const newLeftDecs: any[] = [];
      const newRightDecs: any[] = [];

      for (const chunk of chunks) {
        if (chunk.originalStart > 0) {
          newLeftDecs.push({
            range: {
              startLineNumber: chunk.originalStart,
              startColumn: 1,
              endLineNumber: chunk.originalStart,
              endColumn: 1,
            },
            options: {
              isWholeLine: false,
              glyphMarginClassName: 'diffx-glyph-copy-l2r',
              glyphMarginHoverMessage: {
                value: `**⇨ Copy Lines ${chunk.originalStart}–${chunk.originalEnd || chunk.originalStart} to Right**`,
              },
            },
          });
        }

        if (chunk.modifiedStart > 0) {
          newRightDecs.push({
            range: {
              startLineNumber: chunk.modifiedStart,
              startColumn: 1,
              endLineNumber: chunk.modifiedStart,
              endColumn: 1,
            },
            options: {
              isWholeLine: false,
              glyphMarginClassName: 'diffx-glyph-copy-r2l',
              glyphMarginHoverMessage: {
                value: `**⇦ Copy Lines ${chunk.modifiedStart}–${chunk.modifiedEnd || chunk.modifiedStart} to Left**`,
              },
            },
          });
        }
      }

      leftDecorationsRef.current = origEditor.deltaDecorations(leftDecorationsRef.current, newLeftDecs);
      rightDecorationsRef.current = modEditor.deltaDecorations(rightDecorationsRef.current, newRightDecs);
    } catch {
      // non-fatal
    }
  };

  // Monaco Diff Editor Mounting
  const handleEditorDidMount = (editor: any) => {
    diffEditorRef.current = editor;

    try {
      const origEditor = editor.getOriginalEditor();
      const modEditor = editor.getModifiedEditor();

      // Explicitly disable sticky scroll on both panes
      origEditor.updateOptions({ stickyScroll: { enabled: false }, glyphMargin: true });
      modEditor.updateOptions({ stickyScroll: { enabled: false }, glyphMargin: true });

      // Track active focus side
      origEditor.onDidFocusEditorText(() => setActiveFocusSide('left'));
      modEditor.onDidFocusEditorText(() => setActiveFocusSide('right'));

      editor.onDidUpdateDiff(() => {
        updateGutterDecorations();
      });

      // Right Editor Listeners
      modEditor.onDidChangeModelContent(() => {
        const val = modEditor.getValue();
        setRightEditorContent(val);
        setRightDirty(val !== (rightData?.content ?? ''));
        const pos = modEditor.getPosition();
        if (pos) updateLineDetails(pos.lineNumber);
      });

      modEditor.onDidChangeCursorPosition((e: any) => {
        updateLineDetails(e.position.lineNumber);
      });

      modEditor.onDidChangeCursorSelection((e: any) => {
        const sel = e.selection;
        if (sel && !sel.isEmpty() && sel.endLineNumber >= sel.startLineNumber) {
          const modModel = modEditor.getModel();
          const txt = modModel ? modModel.getValueInRange(sel) : '';
          setActiveSelection({
            side: 'right',
            startLine: sel.startLineNumber,
            endLine: sel.endLineNumber,
            text: txt,
          });
        } else {
          setActiveSelection(null);
        }
      });

      // Left Editor Listeners
      origEditor.onDidChangeModelContent(() => {
        const val = origEditor.getValue();
        setLeftEditorContent(val);
        setLeftDirty(val !== (leftData?.content ?? ''));
        const pos = origEditor.getPosition();
        if (pos) updateLineDetails(pos.lineNumber);
      });

      origEditor.onDidChangeCursorPosition((e: any) => {
        updateLineDetails(e.position.lineNumber);
      });

      origEditor.onDidChangeCursorSelection((e: any) => {
        const sel = e.selection;
        if (sel && !sel.isEmpty() && sel.endLineNumber >= sel.startLineNumber) {
          const origModel = origEditor.getModel();
          const txt = origModel ? origModel.getValueInRange(sel) : '';
          setActiveSelection({
            side: 'left',
            startLine: sel.startLineNumber,
            endLine: sel.endLineNumber,
            text: txt,
          });
        } else {
          setActiveSelection(null);
        }
      });

      // Gutter Clicks on Left
      origEditor.onMouseDown((e: any) => {
        setActiveFocusSide('left');
        const line = e.target?.position?.lineNumber;
        if (!line) return;

        if (e.target?.type === 2 /* GUTTER_GLYPH_MARGIN */) {
          const chunk = findChunkAtLine(chunksRef.current, line, 'left');
          if (chunk) {
            const outRange: ChunkCopyRange = { startLine: 0, endLine: 0 };
            executeChunkCopyL2R(origEditor.getModel(), modEditor.getModel(), chunk, outRange);
            setRightEditorContent(modEditor.getValue());
            setRightDirty(true);
            setLastModifiedSide('right');
            setActiveFocusSide('right');
            if (outRange.startLine > 0) {
              flashCopiedHighlight('right', outRange.startLine, outRange.endLine);
            }
            setCopiedNotification(`Copied chunk lines ${chunk.originalStart}–${chunk.originalEnd} Left ⇨ Right`);
            setTimeout(() => setCopiedNotification(null), 2500);
            onUpdateStatus(`Copied diff paragraph (lines ${chunk.originalStart}–${chunk.originalEnd}) Left ⇨ Right`);
          }
        } else {
          const chunk = findChunkAtLine(chunksRef.current, line, 'left');
          setActiveDiffChunk(chunk);
        }
      });

      // Gutter Clicks on Right
      modEditor.onMouseDown((e: any) => {
        setActiveFocusSide('right');
        const line = e.target?.position?.lineNumber;
        if (!line) return;

        if (e.target?.type === 2 /* GUTTER_GLYPH_MARGIN */) {
          const chunk = findChunkAtLine(chunksRef.current, line, 'right');
          if (chunk) {
            const outRange: ChunkCopyRange = { startLine: 0, endLine: 0 };
            executeChunkCopyR2L(origEditor.getModel(), modEditor.getModel(), chunk, outRange);
            setLeftEditorContent(origEditor.getValue());
            setLeftDirty(true);
            setLastModifiedSide('left');
            setActiveFocusSide('left');
            if (outRange.startLine > 0) {
              flashCopiedHighlight('left', outRange.startLine, outRange.endLine);
            }
            setCopiedNotification(`Copied chunk lines ${chunk.modifiedStart}–${chunk.modifiedEnd} Right ⇦ Left`);
            setTimeout(() => setCopiedNotification(null), 2500);
            onUpdateStatus(`Copied diff paragraph (lines ${chunk.modifiedStart}–${chunk.modifiedEnd}) Right ⇦ Left`);
          }
        } else {
          const chunk = findChunkAtLine(chunksRef.current, line, 'right');
          setActiveDiffChunk(chunk);
        }
      });

      // Synchronize scroll with far-left overview map
      origEditor.onDidScrollChange(() => {
        const ranges = origEditor.getVisibleRanges();
        if (ranges && ranges.length > 0) {
          setCursorLineNumber(ranges[0].startLineNumber);
        }
      });
      modEditor.onDidScrollChange(() => {
        const ranges = modEditor.getVisibleRanges();
        if (ranges && ranges.length > 0) {
          setCursorLineNumber(ranges[0].startLineNumber);
        }
      });

      updateLineDetails(1);
      setTimeout(updateGutterDecorations, 100);
    } catch {
      // non-fatal
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

  // Copy Left to Right (⇨)
  const handleCopyL2R = () => {
    if (!diffEditorRef.current) return;
    const origEditor = diffEditorRef.current.getOriginalEditor();
    const modEditor = diffEditorRef.current.getModifiedEditor();
    const origModel = origEditor.getModel();
    const modModel = modEditor.getModel();
    if (!origModel || !modModel) return;

    if (activeSelection && activeSelection.side === 'left') {
      const text = activeSelection.text;
      const chunk = findChunkAtLine(chunksRef.current, activeSelection.startLine, 'left');
      const outRange: ChunkCopyRange = { startLine: 0, endLine: 0 };
      if (chunk) {
        executeChunkCopyL2R(origModel, modModel, chunk, outRange);
      } else {
        const targetLine = Math.min(activeSelection.startLine, modModel.getLineCount());
        const targetEnd = Math.min(activeSelection.endLine, modModel.getLineCount());
        const range = {
          startLineNumber: targetLine,
          startColumn: 1,
          endLineNumber: targetEnd,
          endColumn: modModel.getLineMaxColumn(targetEnd),
        };
        modModel.pushEditOperations([], [{ range, text }], () => null);
        outRange.startLine = targetLine;
        outRange.endLine = targetEnd;
      }
      const updated = modModel.getValue();
      setRightEditorContent(updated);
      setRightDirty(true);
      setLastModifiedSide('right');
      setActiveFocusSide('right');
      if (outRange.startLine > 0) {
        flashCopiedHighlight('right', outRange.startLine, outRange.endLine);
      }
      setCopiedNotification(`Copied lines ${activeSelection.startLine}–${activeSelection.endLine} Left ⇨ Right`);
      setTimeout(() => setCopiedNotification(null), 2500);
      onUpdateStatus(`Copied lines ${activeSelection.startLine}–${activeSelection.endLine} Left ⇨ Right`);
      return;
    }

    const chunk = activeDiffChunk || (chunksRef.current.length > 0 ? chunksRef.current[0] : null);
    if (chunk) {
      const outRange: ChunkCopyRange = { startLine: 0, endLine: 0 };
      executeChunkCopyL2R(origModel, modModel, chunk, outRange);
      const updated = modModel.getValue();
      setRightEditorContent(updated);
      setRightDirty(true);
      setLastModifiedSide('right');
      setActiveFocusSide('right');
      if (outRange.startLine > 0) {
        flashCopiedHighlight('right', outRange.startLine, outRange.endLine);
      }
      setCopiedNotification(`Copied diff paragraph (lines ${chunk.originalStart}–${chunk.originalEnd}) Left ⇨ Right`);
      setTimeout(() => setCopiedNotification(null), 2500);
      onUpdateStatus(`Copied diff paragraph (lines ${chunk.originalStart}–${chunk.originalEnd}) Left ⇨ Right`);
    }
  };

  // Copy Right to Left (⇦)
  const handleCopyR2L = () => {
    if (!diffEditorRef.current) return;
    const origEditor = diffEditorRef.current.getOriginalEditor();
    const modEditor = diffEditorRef.current.getModifiedEditor();
    const origModel = origEditor.getModel();
    const modModel = modEditor.getModel();
    if (!origModel || !modModel) return;

    if (activeSelection && activeSelection.side === 'right') {
      const text = activeSelection.text;
      const chunk = findChunkAtLine(chunksRef.current, activeSelection.startLine, 'right');
      const outRange: ChunkCopyRange = { startLine: 0, endLine: 0 };
      if (chunk) {
        executeChunkCopyR2L(origModel, modModel, chunk, outRange);
      } else {
        const targetLine = Math.min(activeSelection.startLine, origModel.getLineCount());
        const targetEnd = Math.min(activeSelection.endLine, origModel.getLineCount());
        const range = {
          startLineNumber: targetLine,
          startColumn: 1,
          endLineNumber: targetEnd,
          endColumn: origModel.getLineMaxColumn(targetEnd),
        };
        origModel.pushEditOperations([], [{ range, text }], () => null);
        outRange.startLine = targetLine;
        outRange.endLine = targetEnd;
      }
      const updated = origModel.getValue();
      setLeftEditorContent(updated);
      setLeftDirty(true);
      setLastModifiedSide('left');
      setActiveFocusSide('left');
      if (outRange.startLine > 0) {
        flashCopiedHighlight('left', outRange.startLine, outRange.endLine);
      }
      setCopiedNotification(`Copied lines ${activeSelection.startLine}–${activeSelection.endLine} Right ⇦ Left`);
      setTimeout(() => setCopiedNotification(null), 2500);
      onUpdateStatus(`Copied lines ${activeSelection.startLine}–${activeSelection.endLine} Right ⇦ Left`);
      return;
    }

    const chunk = activeDiffChunk || (chunksRef.current.length > 0 ? chunksRef.current[0] : null);
    if (chunk) {
      const outRange: ChunkCopyRange = { startLine: 0, endLine: 0 };
      executeChunkCopyR2L(origModel, modModel, chunk, outRange);
      const updated = origModel.getValue();
      setLeftEditorContent(updated);
      setLeftDirty(true);
      setLastModifiedSide('left');
      setActiveFocusSide('left');
      if (outRange.startLine > 0) {
        flashCopiedHighlight('left', outRange.startLine, outRange.endLine);
      }
      setCopiedNotification(`Copied diff paragraph (lines ${chunk.modifiedStart}–${chunk.modifiedEnd}) Right ⇦ Left`);
      setTimeout(() => setCopiedNotification(null), 2500);
      onUpdateStatus(`Copied diff paragraph (lines ${chunk.modifiedStart}–${chunk.modifiedEnd}) Right ⇦ Left`);
    }
  };

  // Copy diff paragraph / selection text to system clipboard
  const handleCopyTextToClipboard = () => {
    if (!diffEditorRef.current) return;
    let textToCopy = '';

    if (activeSelection && activeSelection.text) {
      textToCopy = activeSelection.text;
    } else if (activeDiffChunk) {
      const origModel = diffEditorRef.current.getOriginalEditor().getModel();
      if (origModel && activeDiffChunk.originalStart > 0 && activeDiffChunk.originalEnd >= activeDiffChunk.originalStart) {
        textToCopy = origModel.getValueInRange({
          startLineNumber: activeDiffChunk.originalStart,
          startColumn: 1,
          endLineNumber: activeDiffChunk.originalEnd,
          endColumn: origModel.getLineMaxColumn(activeDiffChunk.originalEnd),
        });
      }
    } else if (activeLeftLineText) {
      textToCopy = activeLeftLineText;
    }

    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedNotification('Diff text copied to clipboard!');
      setTimeout(() => setCopiedNotification(null), 2500);
      onUpdateStatus('Diff text copied to system clipboard');
    }
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

  // Keyboard Shortcuts: Ctrl+S (Save based on focus with popup), Ctrl+Z (Undo), Ctrl+Y (Redo), Ctrl+F (Find), Ctrl+C
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // 1. Undo: Ctrl+Z / Cmd+Z (without shift)
      if (isCtrlOrCmd && !e.shiftKey && e.key.toLowerCase() === 'z') {
        if (!diffEditorRef.current) return;
        e.preventDefault();
        const origEditor = diffEditorRef.current.getOriginalEditor();
        const modEditor = diffEditorRef.current.getModifiedEditor();
        const targetSide = origEditor.hasTextFocus() ? 'left' : modEditor.hasTextFocus() ? 'right' : lastModifiedSide;
        const targetEditor = targetSide === 'left' ? origEditor : modEditor;
        targetEditor.focus();
        targetEditor.trigger('keyboard', 'undo', null);
        return;
      }

      // 2. Redo: Ctrl+Y / Cmd+Shift+Z / Cmd+Y
      if (
        (isCtrlOrCmd && e.key.toLowerCase() === 'y') ||
        (isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        if (!diffEditorRef.current) return;
        e.preventDefault();
        const origEditor = diffEditorRef.current.getOriginalEditor();
        const modEditor = diffEditorRef.current.getModifiedEditor();
        const targetSide = origEditor.hasTextFocus() ? 'left' : modEditor.hasTextFocus() ? 'right' : lastModifiedSide;
        const targetEditor = targetSide === 'left' ? origEditor : modEditor;
        targetEditor.focus();
        targetEditor.trigger('keyboard', 'redo', null);
        return;
      }

      // 3. Find: Ctrl+F / Cmd+F across files
      if (isCtrlOrCmd && e.key.toLowerCase() === 'f') {
        if (!diffEditorRef.current) return;
        e.preventDefault();
        const origEditor = diffEditorRef.current.getOriginalEditor();
        const modEditor = diffEditorRef.current.getModifiedEditor();
        const targetSide = origEditor.hasTextFocus() ? 'left' : modEditor.hasTextFocus() ? 'right' : activeFocusSide;
        const targetEditor = targetSide === 'left' ? origEditor : modEditor;
        targetEditor.focus();
        targetEditor.getAction('actions.find')?.run();
        return;
      }

      // 4. Save: Ctrl+S / Cmd+S based on focus with popup confirmation
      if (isCtrlOrCmd && e.key.toLowerCase() === 's') {
        if (!diffEditorRef.current) return;
        e.preventDefault();
        const origEditor = diffEditorRef.current.getOriginalEditor();
        const modEditor = diffEditorRef.current.getModifiedEditor();
        const targetSide = origEditor.hasTextFocus() ? 'left' : modEditor.hasTextFocus() ? 'right' : activeFocusSide;
        if (targetSide === 'left') {
          handleSaveLeft();
        } else {
          handleSaveRight();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFocusSide, lastModifiedSide, handleSaveLeft, handleSaveRight]);

  const editorLanguage = format === 'xml' ? 'xml' : format === 'json' ? 'json' : 'yaml';
  const leftMeta = formatFileMetadata(leftData, leftPath, format);
  const rightMeta = formatFileMetadata(rightData, rightPath, format);

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-black overflow-hidden text-neutral-900 dark:text-neutral-100 font-sans select-none w-full max-w-full">
      {/* ================= 1. Beyond Compare Action Toolbar (Image 2 & 3) ================= */}
      <div className="bg-[#f0f0f0] dark:bg-[#0a0a0a] border-b border-[#c8c8c8] dark:border-neutral-800 px-2 py-1 flex items-center justify-between text-xs flex-shrink-0 select-none shadow-xs">
        {/* Left Toolbar Items */}
        <div className="flex items-center space-x-1">
          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              title="Return to Sessions Home"
              className="p-1 rounded bg-white dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-800 transition shadow-xs"
            >
              <Home className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Format Selector: XML, YAML, JSON */}
          <div className="flex items-center bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded p-0.5 shadow-xs">
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

          <span className="h-4 w-px bg-neutral-300 dark:bg-neutral-800 mx-0.5" />

          {/* Jumpers */}
          <button
            onClick={handlePrevDiff}
            data-action="prev-diff"
            title="Previous Difference"
            className="flex items-center space-x-1 px-2 py-1 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 text-[11px] shadow-xs"
          >
            <ArrowUp className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            <span>Prev</span>
          </button>
          <button
            onClick={handleNextDiff}
            data-action="next-diff"
            title="Next Difference"
            className="flex items-center space-x-1 px-2 py-1 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 text-[11px] shadow-xs"
          >
            <ArrowDown className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            <span>Next</span>
          </button>

          <span className="h-4 w-px bg-neutral-300 dark:bg-neutral-800 mx-0.5" />

          {/* Beyond Compare View Filter Trio */}
          <div className="flex items-center bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded p-0.5 shadow-xs">
            <button
              onClick={() => setActiveFilter('all')}
              data-action="filter-all"
              title="Show All (*)"
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

          {/* Section & Selection Level Copy Actions */}
          <button
            onClick={handleCopyL2R}
            data-action="copy-l2r"
            title="Copy diff paragraph / selected lines Left to Right (Alt+Right)"
            disabled={!leftPath || !rightPath}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 disabled:opacity-40 transition font-semibold text-[11px] shadow-xs"
          >
            <ArrowRight className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Copy L→R</span>
          </button>
          <button
            onClick={handleCopyR2L}
            data-action="copy-r2l"
            title="Copy diff paragraph / selected lines Right to Left (Alt+Left)"
            disabled={!leftPath || !rightPath}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-purple-50 dark:bg-purple-950/60 border border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900 disabled:opacity-40 transition font-semibold text-[11px] shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Copy R→L</span>
          </button>

          {/* Copy Paragraph to Clipboard Button */}
          <button
            onClick={handleCopyTextToClipboard}
            title="Copy active diff paragraph or selection to clipboard"
            className="flex items-center space-x-1 px-2 py-1 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px] shadow-xs transition"
          >
            <Copy className="w-3.5 h-3.5 text-neutral-500" />
            <span>Copy Text</span>
          </button>

          {/* Semantic summary pill */}
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

          {/* Infrastructure Noise Filter */}
          <label className="flex items-center space-x-1 cursor-pointer bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 px-1.5 py-0.5 rounded text-[11px] flex-shrink-0 shadow-xs">
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
            className={`flex items-center space-x-1 px-2 py-0.5 rounded border text-[11px] transition shadow-xs ${
              showInspector
                ? 'bg-blue-600 text-white border-blue-600 font-medium'
                : 'bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100'
            }`}
          >
            <ListFilter className="w-3 h-3" />
            <span>Inspector {diffResult ? `(${diffResult.items.length})` : ''}</span>
          </button>

          {/* View mode toggle */}
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

      {/* ================= 2. Beyond Compare Dual Address Header (Strict 50/50 Split) ================= */}
      <div className="bg-[#f6f6f6] dark:bg-[#0c0c0c] border-b border-[#d0d0d0] dark:border-neutral-800 p-1 flex items-center space-x-1.5 flex-shrink-0 w-full max-w-full overflow-hidden">
        {/* Left Address Box (supports drag & drop) */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingLeft(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingLeft(false);
          }}
          onDrop={handleDropLeft}
          className={`flex-1 min-w-0 flex items-center bg-white dark:bg-black border ${
            isDraggingLeft
              ? 'border-blue-500 ring-2 ring-blue-500/50 bg-blue-50/20'
              : 'border-blue-400 dark:border-blue-900/70'
          } rounded px-1.5 py-0.5 shadow-xs focus-within:ring-1 focus-within:ring-blue-500 transition`}
          title={leftPath || 'Left file (drop file here)'}
        >
          <span className="w-4 h-4 rounded bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0 shadow-xs mr-1.5">
            L
          </span>
          <FileCode className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mr-1.5 flex-shrink-0" />
          <input
            type="text"
            value={leftPath}
            onChange={(e) => onSetLeftPath(e.target.value)}
            placeholder="Left config/XML path (or drag & drop file here)..."
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

        {/* Swap Button */}
        <button
          onClick={handleSwap}
          data-action="swap"
          title="Swap Left and Right Files"
          className="p-1 rounded bg-[#eaeaea] dark:bg-neutral-900 hover:bg-neutral-300 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-800 transition flex-shrink-0 shadow-xs"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
        </button>

        {/* Right Address Box (supports drag & drop) */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingRight(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingRight(false);
          }}
          onDrop={handleDropRight}
          className={`flex-1 min-w-0 flex items-center bg-white dark:bg-black border ${
            isDraggingRight
              ? 'border-purple-500 ring-2 ring-purple-500/50 bg-purple-50/20'
              : 'border-purple-400 dark:border-purple-900/70'
          } rounded px-1.5 py-0.5 shadow-xs focus-within:ring-1 focus-within:ring-purple-500 transition`}
          title={rightPath || 'Right file (drop file here)'}
        >
          <span className="w-4 h-4 rounded bg-purple-600 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0 shadow-xs mr-1.5">
            R
          </span>
          <FileCode className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 mr-1.5 flex-shrink-0" />
          <input
            type="text"
            value={rightPath}
            onChange={(e) => onSetRightPath(e.target.value)}
            placeholder="Right config/XML path (or drag & drop file here)..."
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
              <span className="italic text-neutral-400">No config file on Left</span>
            )}
          </div>

          <div className="h-3 w-px bg-neutral-300 dark:bg-neutral-800 mx-1 flex-shrink-0" />

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
              <span className="italic text-neutral-400">No config file on Right</span>
            )}
          </div>
        </div>
      )}

      {/* ================= 4. Active Diff Paragraph / Selection Action Floating Bar ================= */}
      {(activeDiffChunk || activeSelection) && (
        <div className="bg-blue-50/90 dark:bg-[#121212] border-b border-blue-200 dark:border-neutral-800 px-3 py-1 flex items-center justify-between text-xs flex-shrink-0 select-none shadow-xs">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
            <span className="font-semibold text-blue-800 dark:text-blue-300 text-[11px]">
              {activeSelection
                ? `Selected Lines ${activeSelection.startLine}–${activeSelection.endLine} (${activeSelection.side === 'left' ? 'Left' : 'Right'})`
                : `Diff Paragraph Lines ${activeDiffChunk?.originalStart || activeDiffChunk?.modifiedStart}–${activeDiffChunk?.originalEnd || activeDiffChunk?.modifiedEnd}`}
            </span>
            <span className="text-neutral-500 text-[10px]">• Click ⇨ or ⇦ to copy directly</span>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={handleCopyL2R}
              title="Copy this section from Left to Right (⇨)"
              className="flex items-center space-x-1 px-2.5 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-[11px] shadow-xs transition"
            >
              <ArrowRight className="w-3 h-3" />
              <span>Copy to Right (⇨)</span>
            </button>
            <button
              onClick={handleCopyR2L}
              title="Copy this section from Right to Left (⇦)"
              className="flex items-center space-x-1 px-2.5 py-0.5 rounded bg-purple-600 hover:bg-purple-500 text-white font-medium text-[11px] shadow-xs transition"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Copy to Left (⇦)</span>
            </button>
            <button
              onClick={handleCopyTextToClipboard}
              title="Copy text of this diff paragraph to clipboard"
              className="flex items-center space-x-1 px-2 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 text-[11px] shadow-xs transition"
            >
              <Copy className="w-3 h-3 text-neutral-500" />
              <span>Copy Paragraph</span>
            </button>
          </div>
        </div>
      )}

      {/* Copy Toast Notification */}
      {copiedNotification && (
        <div className="bg-emerald-500 text-white px-3 py-1 text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-md">
          <Check className="w-3.5 h-3.5" />
          <span>{copiedNotification}</span>
        </div>
      )}

      {/* Error / Warning Banner */}
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

      {/* ================= 5. Monaco Diff Editor Canvas with Far-Left Overview Map ================= */}
      <div className="flex-1 flex flex-row min-h-0 bg-white dark:bg-black w-full overflow-hidden">
        {(leftPath || rightPath) && (
          <DiffOverviewMap
            chunks={diffChunks}
            totalLines={Math.max(
              1,
              leftEditorContent.split('\n').length,
              rightEditorContent.split('\n').length
            )}
            currentLine={cursorLineNumber || 1}
            onScrollToLine={(line) => {
              if (diffEditorRef.current) {
                try {
                  diffEditorRef.current.getOriginalEditor().revealLineInCenter(line);
                  diffEditorRef.current.getModifiedEditor().revealLineInCenter(line);
                  updateLineDetails(line);
                } catch {
                  // non-fatal
                }
              }
            }}
            theme={theme}
          />
        )}

        <div
          onDragEnter={handleContainerDragEnter}
          onDragOver={handleContainerDragOver}
          onDragLeave={handleContainerDragLeave}
          onDrop={handleContainerDrop}
          className="flex-1 relative h-full min-w-0 overflow-hidden"
        >
          {/* Side-by-side empty state drop targets when no files are loaded */}
          {!leftPath && !rightPath ? (
            <div className="absolute inset-0 flex items-stretch select-none bg-white dark:bg-black">
              {/* Left Drop Target Zone */}
              <div
                onClick={handlePickLeft}
                className={`flex-1 flex flex-col items-center justify-center p-8 text-center cursor-pointer transition ${
                  dragHoverSide === 'left'
                    ? 'bg-blue-500/10 ring-2 ring-blue-500'
                    : 'hover:bg-neutral-50 dark:hover:bg-neutral-950'
                }`}
              >
                <Boxes className="w-10 h-10 mb-2 stroke-[1.2] text-blue-500" />
                <h4 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                  Left Config / XML File
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-3 max-w-[220px]">
                  Drag & drop XML or YAML file here (e.g. site1.xml) or browse
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePickLeft();
                  }}
                  className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium shadow-xs transition"
                >
                  Browse Left File
                </button>
              </div>

              {/* Bare Minimum Light Divider Line */}
              <div className="w-px bg-[#e5e5e5] dark:bg-neutral-800 flex-shrink-0" />

              {/* Right Drop Target Zone */}
              <div
                onClick={handlePickRight}
                className={`flex-1 flex flex-col items-center justify-center p-8 text-center cursor-pointer transition ${
                  dragHoverSide === 'right'
                    ? 'bg-purple-500/10 ring-2 ring-purple-500'
                    : 'hover:bg-neutral-50 dark:hover:bg-neutral-950'
                }`}
              >
                <Boxes className="w-10 h-10 mb-2 stroke-[1.2] text-purple-500" />
                <h4 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                  Right Config / XML File
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-3 max-w-[220px]">
                  Drag & drop XML or YAML file here (e.g. site2.xml) or browse
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePickRight();
                  }}
                  className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-medium shadow-xs transition"
                >
                  Browse Right File
                </button>
              </div>
            </div>
          ) : (
            <DiffEditor
              height="100%"
              language={editorLanguage}
              original={leftEditorContent}
              modified={rightEditorContent}
              theme={theme === 'dark' ? 'beyond-compare-dark' : 'beyond-compare-light'}
              beforeMount={(monaco) => {
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
                    'diffEditor.insertedTextBackground': '#bbf7d0',
                    'diffEditor.removedTextBackground': '#fca5a5',
                    'diffEditor.insertedLineBackground': '#f0fdf4',
                    'diffEditor.removedLineBackground': '#fde8e8',
                    'diffEditor.diagonalFill': '#e5e5e5',
                  },
                });

                monaco.editor.defineTheme('beyond-compare-dark', {
                  base: 'vs-dark',
                  inherit: true,
                  rules: [],
                  colors: {
                    'editor.background': '#000000',
                    'editor.foreground': '#f3f4f6',
                    'editorGutter.background': '#050505',
                    'editorLineNumber.foreground': '#666666',
                    'editorLineNumber.activeForeground': '#ffffff',
                    'diffEditor.insertedTextBackground': '#14532d88',
                    'diffEditor.removedTextBackground': '#7f1d1d88',
                    'diffEditor.insertedLineBackground': '#14532d30',
                    'diffEditor.removedLineBackground': '#7f1d1d30',
                    'diffEditor.diagonalFill': '#1a1a1a',
                  },
                });
              }}
              onMount={handleEditorDidMount}
              options={{
                renderSideBySide,
                readOnly: false,
                originalEditable: true,
                fontSize: 12,
                fontFamily: "'Consolas', 'Courier New', 'SFMono-Regular', Menlo, Monaco, monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                diffCodeLens: true,
                renderOverviewRuler: false,
                diffWordWrap: 'on',
                glyphMargin: true,
                stickyScroll: { enabled: false },
                ...(activeFilter === 'diffs' ? ({ hideUnchangedRegions: { enabled: true } } as any) : {}),
              } as any}
            />
          )}

          {/* Active Drag-and-Drop Overlay over loaded comparison */}
          {dragHoverSide && (leftPath || rightPath) && (
            <div className="absolute inset-0 z-40 flex pointer-events-none bg-black/40 backdrop-blur-[1px]">
              {/* Left Pane Highlight */}
              <div
                className={`flex-1 flex flex-col items-center justify-center transition border-r border-neutral-700 ${
                  dragHoverSide === 'left'
                    ? 'bg-blue-600/30 ring-4 ring-inset ring-blue-500'
                    : 'bg-black/30 opacity-40'
                }`}
              >
                <Boxes className="w-12 h-12 mb-2 text-blue-400 animate-bounce" />
                <span className="font-bold text-sm text-white drop-shadow-md">
                  Drop to Open as Left Config
                </span>
                <span className="text-xs text-blue-200 mt-1">
                  Replaces current Left pane
                </span>
              </div>

              {/* Right Pane Highlight */}
              <div
                className={`flex-1 flex flex-col items-center justify-center transition ${
                  dragHoverSide === 'right'
                    ? 'bg-purple-600/30 ring-4 ring-inset ring-purple-500'
                    : 'bg-black/30 opacity-40'
                }`}
              >
                <Boxes className="w-12 h-12 mb-2 text-purple-400 animate-bounce" />
                <span className="font-bold text-sm text-white drop-shadow-md">
                  Drop to Open as Right Config
                </span>
                <span className="text-xs text-purple-200 mt-1">
                  Replaces current Right pane
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================= 6. Beyond Compare Line Details Split Inspection Bar (Image 3) ================= */}
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

      {/* Collapsible Semantic Inspector Drawer */}
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
