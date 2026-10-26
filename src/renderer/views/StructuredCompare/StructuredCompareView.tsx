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
  AlertCircle,
  ChevronDown,
  Home,
  FolderOpen,
  Database,
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
  findClosestChunk,
  executeChunkCopyL2R,
  executeChunkCopyR2L,
  executeSelectedLinesCopyL2R,
  executeSelectedLinesCopyR2L,
  collapseEditorGapViewZones,
  ChunkCopyRange,
  computeUnchangedRanges,
  computeDiffRanges,
} from '@shared/comparison-engine/diff-copy.js';
import { ConfirmModalConfig } from '../../components/ConfirmModal.js';
import { LineDetailInspector } from '../../components/LineDetailInspector.js';
import { DiffOverviewMap } from '../../components/DiffOverviewMap.js';
import { registerBrowserFile } from '../../utils/browser-api.js';

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
  onRequestConfirm: _onRequestConfirm,
  onUpdateStatus,
}) => {
  // Format & Options
  const [format, setFormat] = useState<StructuredFormat>('yaml');
  const filterKubernetes = true;
  const [ignoreKeysInput, _setIgnoreKeysInput] = useState('metadata.resourceVersion, metadata.uid, status');

  // File Data
  const [leftData, setLeftData] = useState<FileContentResult | null>(null);
  const [rightData, setRightData] = useState<FileContentResult | null>(null);
  const [leftInitialContent, setLeftInitialContent] = useState<string>('');
  const [rightInitialContent, setRightInitialContent] = useState<string>('');
  const leftContentRef = useRef<string>('');
  const rightContentRef = useRef<string>('');
  const [totalLineCount, setTotalLineCount] = useState<number>(1);

  // Dirty State
  const [leftDirty, setLeftDirty] = useState(false);
  const [rightDirty, setRightDirty] = useState(false);

  // Beyond Compare View Filters: 'all' | 'diffs' | 'same'
  const [activeFilter, setActiveFilter] = useState<'all' | 'diffs' | 'same'>('all');
  const renderSideBySide = true;

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



  // Drag and drop states across whole page
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const [dragHoverSide, setDragHoverSide] = useState<'left' | 'right' | null>(null);
  const dragCounterRef = useRef(0);

  interface DroppedItem {
    path: string;
    file: File;
  }

  const extractDroppedItems = (e: React.DragEvent): DroppedItem[] => {
    const items: DroppedItem[] = [];
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        let p = '';
        if (window.diffxAPI && typeof window.diffxAPI.getPathForFile === 'function') {
          try {
            p = window.diffxAPI.getPathForFile(file);
          } catch {
            // fallback
          }
        }
        if (!p) {
          p = (file as any).path || file.webkitRelativePath || file.name;
        }
        items.push({ path: p, file });
      }
    }
    return items;
  };

  const handleDropToSide = async (items: DroppedItem[], targetSide: 'left' | 'right') => {
    if (!items.length) return;
    if (items.length >= 2) {
      const leftItem = items[0];
      const rightItem = items[1];
      registerBrowserFile(leftItem.path, leftItem.file, 'left');
      registerBrowserFile(rightItem.path, rightItem.file, 'right');
      registerBrowserFile(leftItem.file.name, leftItem.file, 'left');
      registerBrowserFile(rightItem.file.name, rightItem.file, 'right');
      const leftTxt = await leftItem.file.text();
      const rightTxt = await rightItem.file.text();
      setLeftInitialContent(leftTxt);
      setRightInitialContent(rightTxt);
      leftContentRef.current = leftTxt;
      rightContentRef.current = rightTxt;
      setTotalLineCount(Math.max(1, leftTxt.split('\n').length, rightTxt.split('\n').length));
      setLeftDirty(false);
      setRightDirty(false);
      onSetLeftPath(leftItem.path);
      onSetRightPath(rightItem.path);
      onUpdateStatus(`Loaded Left (${leftItem.path}) and Right (${rightItem.path})`);
    } else {
      const item = items[0];
      registerBrowserFile(item.path, item.file, targetSide);
      registerBrowserFile(item.file.name, item.file, targetSide);
      const txt = await item.file.text();
      if (targetSide === 'left') {
        setLeftInitialContent(txt);
        leftContentRef.current = txt;
        setTotalLineCount((prev) => Math.max(1, txt.split('\n').length, prev));
        setLeftDirty(false);
        onSetLeftPath(item.path);
        onUpdateStatus(`Loaded Left config: ${item.path}`);
      } else {
        setRightInitialContent(txt);
        rightContentRef.current = txt;
        setTotalLineCount((prev) => Math.max(1, txt.split('\n').length, prev));
        setRightDirty(false);
        onSetRightPath(item.path);
        onUpdateStatus(`Loaded Right config: ${item.path}`);
      }
    }
  };

  const handleDropLeft = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingLeft(false);
    setDragHoverSide(null);
    dragCounterRef.current = 0;
    const items = extractDroppedItems(e);
    handleDropToSide(items, 'left');
  };

  const handleDropRight = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingRight(false);
    setDragHoverSide(null);
    dragCounterRef.current = 0;
    const items = extractDroppedItems(e);
    handleDropToSide(items, 'right');
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
    const items = extractDroppedItems(e);
    handleDropToSide(items, side);
  };

  // Monaco Ref
  const diffEditorRef = useRef<any>(null);
  const leftDecorationsRef = useRef<string[]>([]);
  const rightDecorationsRef = useRef<string[]>([]);
  const copiedHighlightDecsRef = useRef<{ left: string[]; right: string[] }>({ left: [], right: [] });
  const chunksRef = useRef<DiffChunk[]>([]);
  const canonicalChunksRef = useRef<DiffChunk[]>([]);
  chunksRef.current = diffChunks;

  // Active focus side for shortcuts & save
  const [activeFocusSide, setActiveFocusSide] = useState<'left' | 'right'>('right');
  const [lastModifiedSide, setLastModifiedSide] = useState<'left' | 'right'>('right');

  // Jump to diff chunk cleanly (centers on diff, sets cursor, updates inspection)
  const handleJumpToChunk = (chunk: DiffChunk) => {
    if (!diffEditorRef.current) return;
    try {
      const origEditor = diffEditorRef.current.getOriginalEditor();
      const modEditor = diffEditorRef.current.getModifiedEditor();

      if (chunk.originalStart > 0) {
        origEditor.revealLineInCenter(chunk.originalStart);
        origEditor.setPosition({ lineNumber: chunk.originalStart, column: 1 });
        origEditor.focus();
        setActiveFocusSide('left');
        updateLineDetails(chunk.originalStart);
        setActiveDiffChunk(chunk);
      } else if (chunk.modifiedStart > 0) {
        modEditor.revealLineInCenter(chunk.modifiedStart);
        modEditor.setPosition({ lineNumber: chunk.modifiedStart, column: 1 });
        modEditor.focus();
        setActiveFocusSide('right');
        updateLineDetails(chunk.modifiedStart);
        setActiveDiffChunk(chunk);
      }
    } catch {
      // non-fatal
    }
  };

  // Flash highlight on copied differences (L2R or R2L) with Beyond Compare smooth animation
  const flashCopiedHighlight = (side: 'left' | 'right', startLine: number, endLine: number, shouldFocus: boolean = false) => {
    if (!diffEditorRef.current) return;
    try {
      const editor = side === 'left' ? diffEditorRef.current.getOriginalEditor() : diffEditorRef.current.getModifiedEditor();
      if (!editor) return;

      const s = Math.max(1, startLine);
      const e = Math.max(s, endLine);
      const model = editor.getModel();
      if (!model) return;

      const decs = [
        {
          range: {
            startLineNumber: s,
            startColumn: 1,
            endLineNumber: e,
            endColumn: model.getLineMaxColumn(e) || 1,
          },
          options: {
            isWholeLine: true,
            className: 'diffx-copied-highlight-line',
          },
        },
      ];

      if (side === 'left') {
        copiedHighlightDecsRef.current.left = editor.deltaDecorations(copiedHighlightDecsRef.current.left, decs);
      } else {
        copiedHighlightDecsRef.current.right = editor.deltaDecorations(copiedHighlightDecsRef.current.right, decs);
      }

      if (shouldFocus) {
        editor.setPosition({ lineNumber: s, column: 1 });
        editor.focus();
      }

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
      }, 2200);
    } catch {
      // ignore
    }
  };

  const [activeShiftFlyer, setActiveShiftFlyer] = useState<{
    id: number;
    direction: 'left-to-right' | 'right-to-left';
    top: number;
    text: string;
  } | null>(null);

  // UI/UX Pro Max: Ultra-smooth tactile horizontal transfer animation across editors
  const triggerShiftAnimation = (
    direction: 'left-to-right' | 'right-to-left',
    lineNum: number,
    previewText?: string
  ) => {
    try {
      if (!diffEditorRef.current) return;
      const editor =
        direction === 'left-to-right'
          ? diffEditorRef.current.getOriginalEditor()
          : diffEditorRef.current.getModifiedEditor();
      const pos = editor?.getScrolledVisiblePosition?.({ lineNumber: Math.max(1, lineNum), column: 1 });
      const top = pos ? Math.max(12, pos.top) : 60;
      const rawText = previewText?.trim() || `Line ${lineNum}`;
      const label = rawText.length > 36 ? rawText.substring(0, 33) + '...' : rawText;

      setActiveShiftFlyer({
        id: Date.now(),
        direction,
        top,
        text: label,
      });

      setTimeout(() => {
        setActiveShiftFlyer((curr) => (curr && Date.now() - curr.id >= 240 ? null : curr));
      }, 270);
    } catch {
      // Non-fatal
    }
  };

  const activeGapRef = useRef<{
    side: 'left' | 'right';
    afterLineNumber: number;
    targetInsertLine: number;
    chunk: DiffChunk | null;
  } | null>(null);

  const clearGapTargetDecorations = () => {
    activeGapRef.current = null;
    try {
      document.querySelectorAll('.diffx-active-gap-target').forEach((node: any) => {
        node.classList.remove('diffx-active-gap-target');
      });
      document.querySelectorAll('.diffx-gap-cursor-indicator').forEach((node: any) => {
        node.remove();
      });
    } catch {
      // ignore
    }
  };

  // Handle click on diff alignment empty space (view zone / gap) to place cursor cleanly without document mutation
  const handleDiffGapClick = (
    targetEditor: any,
    side: 'left' | 'right',
    e: any,
    chunks: DiffChunk[]
  ): boolean => {
    try {
      // Don't intercept gutter copy arrows
      const isGlyphArrow =
        e.target?.element?.classList?.contains('diffx-glyph-copy-l2r') ||
        e.target?.element?.classList?.contains('diffx-line-copy-l2r') ||
        e.target?.element?.classList?.contains('diffx-glyph-copy-r2l') ||
        e.target?.element?.classList?.contains('diffx-line-copy-r2l') ||
        Boolean(e.target?.element?.closest?.('.diffx-glyph-copy-l2r')) ||
        Boolean(e.target?.element?.closest?.('.diffx-line-copy-l2r')) ||
        Boolean(e.target?.element?.closest?.('.diffx-glyph-copy-r2l')) ||
        Boolean(e.target?.element?.closest?.('.diffx-line-copy-r2l'));

      if (isGlyphArrow) return false;

      const targetType = e.target?.type;
      const el = e.target?.element;
      // Monaco MouseTargetType: 5 is GUTTER_VIEW_ZONE, 8 is CONTENT_VIEW_ZONE
      const isViewZoneType = targetType === 5 || targetType === 8;
      const hasViewZoneClass =
        el?.classList?.contains('view-zone') ||
        Boolean(el?.closest?.('.view-zone')) ||
        Boolean(el?.closest?.('.diff-hidden-lines')) ||
        Boolean(el?.closest?.('.diagonal-fill'));

      let afterLineNumber: number | null = null;

      if (e.target?.detail?.afterLineNumber !== undefined) {
        afterLineNumber = e.target.detail.afterLineNumber;
      }

      const line = e.target?.position?.lineNumber;
      let matchedChunk: DiffChunk | null = null;
      if (afterLineNumber === null) {
        if (isViewZoneType || hasViewZoneClass) {
          const refLine = line || cursorLineNumber || 1;
          const matchingChunk = chunks.find((c) =>
            side === 'left'
              ? c.originalStart === refLine && (c.originalEnd === 0 || c.originalEnd < c.originalStart)
              : c.modifiedStart === refLine && (c.modifiedEnd === 0 || c.modifiedEnd < c.modifiedStart)
          );
          if (matchingChunk) {
            matchedChunk = matchingChunk;
            afterLineNumber = side === 'left' ? matchingChunk.originalStart : matchingChunk.modifiedStart;
          } else if (line) {
            afterLineNumber = line;
          }
        } else if (line && e.target?.type === 7) {
          const matchingChunk = chunks.find((c) =>
            side === 'left'
              ? c.originalStart === line && (c.originalEnd === 0 || c.originalEnd < c.originalStart)
              : c.modifiedStart === line && (c.modifiedEnd === 0 || c.modifiedEnd < c.modifiedStart)
          );
          if (matchingChunk) {
            matchedChunk = matchingChunk;
            afterLineNumber = line;
          }
        }
      }

      if (afterLineNumber !== null || isViewZoneType || hasViewZoneClass) {
        clearGapTargetDecorations();
        const vzTarget = el?.classList?.contains('view-zone')
          ? el
          : el?.closest?.('.view-zone') || el?.closest?.('.diagonal-fill') || el?.closest?.('.ced-diagonal-fill');
        if (vzTarget) {
          vzTarget.classList.add('diffx-active-gap-target');
          if (!vzTarget.querySelector('.diffx-gap-cursor-indicator')) {
            const cursorIndicator = document.createElement('div');
            cursorIndicator.className = 'diffx-gap-cursor-indicator';
            vzTarget.appendChild(cursorIndicator);
          }
        }

        const model = targetEditor.getModel();
        if (!model) return false;

        const lineCount = model.getLineCount();
        const resolvedAfterLine = afterLineNumber !== null ? afterLineNumber : 0;
        const targetLine = Math.min(Math.max(1, resolvedAfterLine + 1), lineCount);

        activeGapRef.current = {
          side,
          afterLineNumber: resolvedAfterLine,
          targetInsertLine: targetLine,
          chunk: matchedChunk,
        };

        targetEditor.setPosition({ lineNumber: targetLine, column: 1 });
        targetEditor.focus();
        setActiveFocusSide(side);
        updateLineDetails(targetLine);

        setTimeout(() => {
          try {
            targetEditor.setPosition({ lineNumber: targetLine, column: 1 });
            targetEditor.focus();
          } catch {
            // ignore
          }
        }, 20);

        if (e.event) {
          e.event.preventDefault?.();
          e.event.stopPropagation?.();
        }
        return true;
      }
    } catch {
      // non-fatal
    }
    return false;
  };

  // Beyond Compare clean gap insertion: inserts text as new lines into alignment gaps without merging into existing text
  const insertIntoActiveGap = (editor: any, side: 'left' | 'right', textToInsert: string): boolean => {
    if (!activeGapRef.current || activeGapRef.current.side !== side) return false;
    const model = editor.getModel();
    if (!model) return false;

    const lineCount = model.getLineCount();
    const afterLine = activeGapRef.current.afterLineNumber;
    const cleanText = textToInsert.endsWith('\n') ? textToInsert : textToInsert + '\n';

    if (afterLine === 0 || lineCount === 0) {
      const range = {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1,
      };
      model.pushEditOperations([], [{ range, text: cleanText }], () => null);
    } else if (afterLine >= lineCount) {
      const lastCol = model.getLineMaxColumn(lineCount);
      const range = {
        startLineNumber: lineCount,
        startColumn: lastCol,
        endLineNumber: lineCount,
        endColumn: lastCol,
      };
      model.pushEditOperations([], [{ range, text: '\n' + textToInsert.replace(/\n$/, '') }], () => null);
    } else {
      const targetLine = afterLine + 1;
      const range = {
        startLineNumber: targetLine,
        startColumn: 1,
        endLineNumber: targetLine,
        endColumn: 1,
      };
      model.pushEditOperations([], [{ range, text: cleanText }], () => null);
    }

    if (side === 'left') {
      leftContentRef.current = model.getValue();
      setLeftDirty(true);
    } else {
      rightContentRef.current = model.getValue();
      setRightDirty(true);
    }

    const insertedLineCount = cleanText.split('\n').length - 1;
    const targetStart = Math.min(afterLine + 1, model.getLineCount());
    const targetEnd = Math.min(targetStart + insertedLineCount - 1, model.getLineCount());

    activeGapRef.current = null;
    clearGapTargetDecorations();
    collapseEditorGapViewZones(editor, afterLine);

    flashCopiedHighlight(side, targetStart, targetEnd, false);
    editor.setPosition({ lineNumber: targetEnd, column: model.getLineMaxColumn(targetEnd) });
    editor.focus();
    onUpdateStatus(`Inserted ${insertedLineCount} line(s) into alignment gap cleanly`);
    return true;
  };

  // View Filter: All (*), Diffs (≠), Same (=)
  const applyViewFilter = (filter: 'all' | 'diffs' | 'same', chunks: DiffChunk[] = canonicalChunksRef.current.length ? canonicalChunksRef.current : diffChunks) => {
    if (!diffEditorRef.current) return;
    try {
      const origEditor = diffEditorRef.current.getOriginalEditor();
      const modEditor = diffEditorRef.current.getModifiedEditor();

      // Disable Monaco's incomplete built-in hideUnchangedRegions in favor of deterministic Beyond Compare setHiddenAreas
      diffEditorRef.current.updateOptions({
        hideUnchangedRegions: { enabled: false },
      });

      if (filter === 'all') {
        origEditor.setHiddenAreas([]);
        modEditor.setHiddenAreas([]);
      } else if (filter === 'diffs') {
        const origModel = origEditor.getModel();
        const modModel = modEditor.getModel();
        const origLines = origModel ? origModel.getLineCount() : 0;
        const modLines = modModel ? modModel.getLineCount() : 0;

        const leftHidden = computeUnchangedRanges(chunks, origLines, 'left');
        const rightHidden = computeUnchangedRanges(chunks, modLines, 'right');

        origEditor.setHiddenAreas(leftHidden);
        modEditor.setHiddenAreas(rightHidden);
      } else if (filter === 'same') {
        const leftHidden = computeDiffRanges(chunks, 'left');
        const rightHidden = computeDiffRanges(chunks, 'right');

        origEditor.setHiddenAreas(leftHidden);
        modEditor.setHiddenAreas(rightHidden);
      }
    } catch {
      // non-fatal
    }
  };

  useEffect(() => {
    applyViewFilter(activeFilter, canonicalChunksRef.current.length ? canonicalChunksRef.current : diffChunks);
  }, [activeFilter, diffChunks]);

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
      setLeftInitialContent('');
      setRightInitialContent('');
      leftContentRef.current = '';
      rightContentRef.current = '';
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
          setLeftInitialContent(leftRes.content);
          leftContentRef.current = leftRes.content;
          setLeftDirty(false);
        } else {
          setLeftData(null);
          setLeftInitialContent('');
          leftContentRef.current = '';
        }

        if (rightPath) {
          rightRes = await window.diffxAPI.readFile(rightPath, undefined, 'right');
          setRightData(rightRes);
          setRightInitialContent(rightRes.content);
          rightContentRef.current = rightRes.content;
          setRightDirty(false);
        } else {
          setRightData(null);
          setRightInitialContent('');
          rightContentRef.current = '';
        }

        setTotalLineCount(Math.max(1, (leftRes?.content || '').split('\n').length, (rightRes?.content || '').split('\n').length));

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
    if (leftContentRef.current && rightContentRef.current) {
      runStructuredDiff(leftContentRef.current, rightContentRef.current, format);
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

  // Update Gutter Arrow Icons for each diff chunk (Beyond Compare Style)
  const updateGutterDecorations = (
    _incomingChunks?: DiffChunk[],
    currentSelection: { side: 'left' | 'right'; startLine: number; endLine: number } | null = activeSelection
  ) => {
    if (!diffEditorRef.current) return;
    try {
      const lineChanges = diffEditorRef.current.getLineChanges();
      const chunks = normalizeLineChanges(lineChanges);
      if (activeFilter === 'all' || !canonicalChunksRef.current.length) {
        canonicalChunksRef.current = chunks;
      }
      setDiffChunks(chunks);

      const origEditor = diffEditorRef.current.getOriginalEditor();
      const modEditor = diffEditorRef.current.getModifiedEditor();

      const newLeftDecs: any[] = [];
      const newRightDecs: any[] = [];

      // 1. Render single clean gutter arrow for each difference chunk (never doubled)
      const activeList = canonicalChunksRef.current.length ? canonicalChunksRef.current : chunks;
      for (const chunk of activeList) {
        if (chunk.originalStart > 0 && chunk.originalEnd >= chunk.originalStart) {
          newLeftDecs.push({
            range: {
              startLineNumber: chunk.originalStart,
              startColumn: 1,
              endLineNumber: chunk.originalStart,
              endColumn: 1,
            },
            options: {
              isWholeLine: false,
              linesDecorationsClassName: 'diffx-line-copy-l2r',
              linesDecorationsHoverMessage: {
                value: `**⇨ Copy Line ${chunk.originalStart} to Right**`,
              },
            },
          });
        }

        if (chunk.modifiedStart > 0 && chunk.modifiedEnd >= chunk.modifiedStart) {
          newRightDecs.push({
            range: {
              startLineNumber: chunk.modifiedStart,
              startColumn: 1,
              endLineNumber: chunk.modifiedStart,
              endColumn: 1,
            },
            options: {
              isWholeLine: false,
              linesDecorationsClassName: 'diffx-line-copy-r2l',
              linesDecorationsHoverMessage: {
                value: `**⇦ Copy Line ${chunk.modifiedStart} to Left**`,
              },
            },
          });
        }
      }

      // 2. If user has actively selected specific line(s) (1 line, 5 lines, etc.), highlight the selected lines & place arrow
      if (currentSelection && currentSelection.side === 'left') {
        const origModel = origEditor.getModel();
        const maxCol = origModel ? origModel.getLineMaxColumn(currentSelection.endLine) : 1;
        newLeftDecs.push({
          range: {
            startLineNumber: currentSelection.startLine,
            startColumn: 1,
            endLineNumber: currentSelection.endLine,
            endColumn: maxCol,
          },
          options: {
            isWholeLine: true,
            className: 'diffx-active-selection-range',
            linesDecorationsClassName: 'diffx-line-copy-l2r',
            linesDecorationsHoverMessage: {
              value: `**⇨ Copy Selected Lines ${currentSelection.startLine}–${currentSelection.endLine} to Right**`,
            },
          },
        });
      } else if (currentSelection && currentSelection.side === 'right') {
        const modModel = modEditor.getModel();
        const maxCol = modModel ? modModel.getLineMaxColumn(currentSelection.endLine) : 1;
        newRightDecs.push({
          range: {
            startLineNumber: currentSelection.startLine,
            startColumn: 1,
            endLineNumber: currentSelection.endLine,
            endColumn: maxCol,
          },
          options: {
            isWholeLine: true,
            className: 'diffx-active-selection-range',
            linesDecorationsClassName: 'diffx-line-copy-r2l',
            linesDecorationsHoverMessage: {
              value: `**⇦ Copy Selected Lines ${currentSelection.startLine}–${currentSelection.endLine} to Left**`,
            },
          },
        });
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

      // Explicitly configure line decorations width and glyph margin on both panes
      origEditor.updateOptions({ stickyScroll: { enabled: false }, glyphMargin: true, lineDecorationsWidth: 20 });
      modEditor.updateOptions({ stickyScroll: { enabled: false }, glyphMargin: true, lineDecorationsWidth: 20 });

      // Track active focus side
      origEditor.onDidFocusEditorText(() => setActiveFocusSide('left'));
      modEditor.onDidFocusEditorText(() => setActiveFocusSide('right'));

      editor.onDidUpdateDiff(() => {
        const lineChanges = editor.getLineChanges();
        const chunks = normalizeLineChanges(lineChanges);
        if (activeFilter === 'all' || !canonicalChunksRef.current.length) {
          canonicalChunksRef.current = chunks;
        }
        updateGutterDecorations();
      });

      // Right Editor Listeners
      modEditor.onDidChangeModelContent(() => {
        const val = modEditor.getValue();
        rightContentRef.current = val;
        setRightDirty(val !== (rightData?.content ?? ''));
        const pos = modEditor.getPosition();
        if (pos) updateLineDetails(pos.lineNumber);
        const lLines = origEditor.getModel()?.getLineCount() || 1;
        const rLines = modEditor.getModel()?.getLineCount() || 1;
        setTotalLineCount(Math.max(1, lLines, rLines));
      });

      modEditor.onDidChangeCursorPosition((e: any) => {
        updateLineDetails(e.position.lineNumber);
      });

      modEditor.onDidChangeCursorSelection((e: any) => {
        const sel = e.selection;
        if (sel && !sel.isEmpty() && sel.endLineNumber >= sel.startLineNumber) {
          const modModel = modEditor.getModel();
          const txt = modModel ? modModel.getValueInRange(sel) : '';
          const newSel = {
            side: 'right' as const,
            startLine: sel.startLineNumber,
            endLine: sel.endLineNumber,
            text: txt,
          };
          setActiveSelection(newSel);
          updateGutterDecorations(canonicalChunksRef.current.length ? canonicalChunksRef.current : diffChunks, newSel);
        } else {
          setActiveSelection(null);
          updateGutterDecorations(canonicalChunksRef.current.length ? canonicalChunksRef.current : diffChunks, null);
        }
      });

      // Paste listener for right editor: zero-jump native paste & trigger flash animation
      modEditor.onDidPaste((e: any) => {
        const pasteRange = e.range;
        if (!pasteRange) return;
        const startLine = pasteRange.startLineNumber;
        const endLine = pasteRange.endLineNumber;

        // Proactively collapse any stale gap viewzones at or around this pasted line
        collapseEditorGapViewZones(modEditor, startLine - 1);
        collapseEditorGapViewZones(modEditor, startLine);

        flashCopiedHighlight('right', startLine, endLine);
        onUpdateStatus('Pasted content cleanly without jumping');
      });

      // Keydown listener for right editor: clean gap paste (Ctrl+V) & typing into gaps without text merging
      modEditor.onKeyDown(async (e: any) => {
        if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyV' || e.browserEvent?.key === 'v')) {
          if (activeGapRef.current && activeGapRef.current.side === 'right') {
            e.preventDefault();
            e.stopPropagation();
            try {
              const clipText = await navigator.clipboard.readText();
              if (clipText) {
                insertIntoActiveGap(modEditor, 'right', clipText);
              }
            } catch {
              // fallback
            }
            return;
          }
          clearGapTargetDecorations();
          const pos = modEditor.getPosition();
          if (pos) {
            collapseEditorGapViewZones(modEditor, pos.lineNumber - 1);
            collapseEditorGapViewZones(modEditor, pos.lineNumber);
          }
        } else if (activeGapRef.current && activeGapRef.current.side === 'right') {
          if (e.code === 'Enter' || e.browserEvent?.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            insertIntoActiveGap(modEditor, 'right', '\n');
          } else if (
            e.browserEvent &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.altKey &&
            e.browserEvent.key &&
            e.browserEvent.key.length === 1
          ) {
            e.preventDefault();
            e.stopPropagation();
            insertIntoActiveGap(modEditor, 'right', e.browserEvent.key);
          } else if (e.code === 'Escape' || e.code === 'Backspace') {
            clearGapTargetDecorations();
          }
        }
      });

      // DOM capture paste listener for right editor (handles mouse right-click paste)
      const modDom = modEditor.getDomNode();
      if (modDom) {
        modDom.addEventListener('paste', (e: ClipboardEvent) => {
          if (activeGapRef.current && activeGapRef.current.side === 'right') {
            const clipText = e.clipboardData?.getData('text/plain');
            if (clipText) {
              e.preventDefault();
              e.stopPropagation();
              insertIntoActiveGap(modEditor, 'right', clipText);
            }
          }
        }, true);
      }

      // Paste listener for left editor: zero-jump native paste & trigger flash animation
      origEditor.onDidPaste((e: any) => {
        const pasteRange = e.range;
        if (!pasteRange) return;
        const startLine = pasteRange.startLineNumber;
        const endLine = pasteRange.endLineNumber;

        // Proactively collapse any stale gap viewzones at or around this pasted line
        collapseEditorGapViewZones(origEditor, startLine - 1);
        collapseEditorGapViewZones(origEditor, startLine);

        flashCopiedHighlight('left', startLine, endLine);
        onUpdateStatus('Pasted content cleanly without jumping');
      });

      // Keydown listener for left editor: clean gap paste (Ctrl+V) & typing into gaps without text merging
      origEditor.onKeyDown(async (e: any) => {
        if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyV' || e.browserEvent?.key === 'v')) {
          if (activeGapRef.current && activeGapRef.current.side === 'left') {
            e.preventDefault();
            e.stopPropagation();
            try {
              const clipText = await navigator.clipboard.readText();
              if (clipText) {
                insertIntoActiveGap(origEditor, 'left', clipText);
              }
            } catch {
              // fallback
            }
            return;
          }
          clearGapTargetDecorations();
          const pos = origEditor.getPosition();
          if (pos) {
            collapseEditorGapViewZones(origEditor, pos.lineNumber - 1);
            collapseEditorGapViewZones(origEditor, pos.lineNumber);
          }
        } else if (activeGapRef.current && activeGapRef.current.side === 'left') {
          if (e.code === 'Enter' || e.browserEvent?.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            insertIntoActiveGap(origEditor, 'left', '\n');
          } else if (
            e.browserEvent &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.altKey &&
            e.browserEvent.key &&
            e.browserEvent.key.length === 1
          ) {
            e.preventDefault();
            e.stopPropagation();
            insertIntoActiveGap(origEditor, 'left', e.browserEvent.key);
          } else if (e.code === 'Escape' || e.code === 'Backspace') {
            clearGapTargetDecorations();
          }
        }
      });

      // DOM capture paste listener for left editor (handles mouse right-click paste)
      const origDom = origEditor.getDomNode();
      if (origDom) {
        origDom.addEventListener('paste', (e: ClipboardEvent) => {
          if (activeGapRef.current && activeGapRef.current.side === 'left') {
            const clipText = e.clipboardData?.getData('text/plain');
            if (clipText) {
              e.preventDefault();
              e.stopPropagation();
              insertIntoActiveGap(origEditor, 'left', clipText);
            }
          }
        }, true);
      }

      // Left Editor Listeners
      origEditor.onDidChangeModelContent(() => {
        const val = origEditor.getValue();
        leftContentRef.current = val;
        setLeftDirty(val !== (leftData?.content ?? ''));
        const pos = origEditor.getPosition();
        if (pos) updateLineDetails(pos.lineNumber);
        const lLines = origEditor.getModel()?.getLineCount() || 1;
        const rLines = modEditor.getModel()?.getLineCount() || 1;
        setTotalLineCount(Math.max(1, lLines, rLines));
      });

      origEditor.onDidChangeCursorPosition((e: any) => {
        updateLineDetails(e.position.lineNumber);
      });

      origEditor.onDidChangeCursorSelection((e: any) => {
        const sel = e.selection;
        if (sel && !sel.isEmpty() && sel.endLineNumber >= sel.startLineNumber) {
          const origModel = origEditor.getModel();
          const txt = origModel ? origModel.getValueInRange(sel) : '';
          const newSel = {
            side: 'left' as const,
            startLine: sel.startLineNumber,
            endLine: sel.endLineNumber,
            text: txt,
          };
          setActiveSelection(newSel);
          updateGutterDecorations(canonicalChunksRef.current.length ? canonicalChunksRef.current : diffChunks, newSel);
        } else {
          setActiveSelection(null);
          updateGutterDecorations(canonicalChunksRef.current.length ? canonicalChunksRef.current : diffChunks, null);
        }
      });

      // Gutter Glyph Arrow Clicks on Left (⇨) or diff gap
      origEditor.onMouseDown((e: any) => {
        setActiveFocusSide('left');

        // Check if click is in a diff alignment gap / view zone to place cursor cleanly
        const handledGap = handleDiffGapClick(origEditor, 'left', e, chunksRef.current);
        if (handledGap) return;

        const line = e.target?.position?.lineNumber;
        if (!line) return;

        // Trigger transfer when clicking the glyph margin arrow (type 2) or line decorations arrow (type 4) - NEVER on line numbers (type 3)
        const isGlyphArrowClick =
          (e.target?.type === 2 ||
            e.target?.type === 4 ||
            e.target?.element?.classList?.contains('diffx-glyph-copy-l2r') ||
            e.target?.element?.classList?.contains('diffx-line-copy-l2r') ||
            Boolean(e.target?.element?.closest?.('.diffx-glyph-copy-l2r')) ||
            Boolean(e.target?.element?.closest?.('.diffx-line-copy-l2r'))) &&
          e.target?.type !== 3;

        const chunk = findChunkAtLine(chunksRef.current, line, 'left') || findClosestChunk(chunksRef.current, line, 'left');
        if (chunk || activeSelection) {
          if (chunk) setActiveDiffChunk(chunk);
          if (isGlyphArrowClick) {
            clearGapTargetDecorations();
            const srcText = origEditor.getModel()?.getLineContent(activeSelection?.startLine || chunk?.originalStart || line) || '';
            triggerShiftAnimation('left-to-right', activeSelection?.startLine || chunk?.originalStart || line, srcText);
            const outRange: ChunkCopyRange = { startLine: 0, endLine: 0 };
            if (activeSelection && activeSelection.side === 'left') {
              collapseEditorGapViewZones(modEditor, chunk ? chunk.modifiedStart : activeSelection.startLine);
              executeSelectedLinesCopyL2R(origEditor.getModel(), modEditor.getModel(), activeSelection, chunk, outRange, modEditor);
              rightContentRef.current = modEditor.getValue();
              setRightDirty(true);
              setLastModifiedSide('right');
              setActiveFocusSide('right');
              flashCopiedHighlight('left', activeSelection.startLine, activeSelection.endLine, false);
              if (outRange.startLine > 0) {
                flashCopiedHighlight('right', outRange.startLine, outRange.endLine, false);
              }
              onUpdateStatus(`Copied selected lines ${activeSelection.startLine}–${activeSelection.endLine} Left ⇨ Right`);
            } else if (chunk) {
              collapseEditorGapViewZones(modEditor, chunk.modifiedStart);
              executeChunkCopyL2R(origEditor.getModel(), modEditor.getModel(), chunk, outRange, modEditor);
              rightContentRef.current = modEditor.getValue();
              setRightDirty(true);
              setLastModifiedSide('right');
              setActiveFocusSide('right');
              flashCopiedHighlight('left', chunk.originalStart, chunk.originalEnd || chunk.originalStart, false);
              if (outRange.startLine > 0) {
                flashCopiedHighlight('right', outRange.startLine, outRange.endLine, false);
              }
              onUpdateStatus(`Copied diff lines ${chunk.originalStart}–${chunk.originalEnd || chunk.originalStart} Left ⇨ Right`);
            }
          }
        }
      });

      // Gutter Glyph Arrow Clicks on Right (⇦) or diff gap
      modEditor.onMouseDown((e: any) => {
        setActiveFocusSide('right');

        // Check if click is in a diff alignment gap / view zone to place cursor cleanly
        const handledGap = handleDiffGapClick(modEditor, 'right', e, chunksRef.current);
        if (handledGap) return;

        const line = e.target?.position?.lineNumber;
        if (!line) return;

        // Trigger transfer when clicking the glyph margin arrow (type 2) or line decorations arrow (type 4) - NEVER on line numbers (type 3)
        const isGlyphArrowClick =
          (e.target?.type === 2 ||
            e.target?.type === 4 ||
            e.target?.element?.classList?.contains('diffx-glyph-copy-r2l') ||
            e.target?.element?.classList?.contains('diffx-line-copy-r2l') ||
            Boolean(e.target?.element?.closest?.('.diffx-glyph-copy-r2l')) ||
            Boolean(e.target?.element?.closest?.('.diffx-line-copy-r2l'))) &&
          e.target?.type !== 3;

        const chunk = findChunkAtLine(chunksRef.current, line, 'right') || findClosestChunk(chunksRef.current, line, 'right');
        if (chunk || activeSelection) {
          if (chunk) setActiveDiffChunk(chunk);
          if (isGlyphArrowClick) {
            clearGapTargetDecorations();
            const srcText = modEditor.getModel()?.getLineContent(activeSelection?.startLine || chunk?.modifiedStart || line) || '';
            triggerShiftAnimation('right-to-left', activeSelection?.startLine || chunk?.modifiedStart || line, srcText);
            const outRange: ChunkCopyRange = { startLine: 0, endLine: 0 };
            if (activeSelection && activeSelection.side === 'right') {
              collapseEditorGapViewZones(origEditor, chunk ? chunk.originalStart : activeSelection.startLine);
              executeSelectedLinesCopyR2L(origEditor.getModel(), modEditor.getModel(), activeSelection, chunk, outRange, origEditor);
              leftContentRef.current = origEditor.getValue();
              setLeftDirty(true);
              setLastModifiedSide('left');
              setActiveFocusSide('left');
              flashCopiedHighlight('right', activeSelection.startLine, activeSelection.endLine, false);
              if (outRange.startLine > 0) {
                flashCopiedHighlight('left', outRange.startLine, outRange.endLine, false);
              }
              onUpdateStatus(`Copied selected lines ${activeSelection.startLine}–${activeSelection.endLine} Right ⇦ Left`);
            } else if (chunk) {
              collapseEditorGapViewZones(origEditor, chunk.originalStart);
              executeChunkCopyR2L(origEditor.getModel(), modEditor.getModel(), chunk, outRange, origEditor);
              leftContentRef.current = origEditor.getValue();
              setLeftDirty(true);
              setLastModifiedSide('left');
              setActiveFocusSide('left');
              flashCopiedHighlight('right', chunk.modifiedStart, chunk.modifiedEnd || chunk.modifiedStart, false);
              if (outRange.startLine > 0) {
                flashCopiedHighlight('left', outRange.startLine, outRange.endLine, false);
              }
              onUpdateStatus(`Copied diff lines ${chunk.modifiedStart}–${chunk.modifiedEnd || chunk.modifiedStart} Right ⇦ Left`);
            }
          }
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

    const outRange: ChunkCopyRange = { startLine: 0, endLine: 0 };

    if (activeSelection && activeSelection.side === 'left') {
      clearGapTargetDecorations();
      const srcText = origModel.getLineContent(activeSelection.startLine);
      triggerShiftAnimation('left-to-right', activeSelection.startLine, srcText);
      const chunk = findClosestChunk(chunksRef.current, activeSelection.startLine, 'left');
      collapseEditorGapViewZones(modEditor, chunk ? chunk.modifiedStart : activeSelection.startLine);
      executeSelectedLinesCopyL2R(origModel, modModel, activeSelection, chunk, outRange, modEditor);
      const updated = modModel.getValue();
      rightContentRef.current = updated;
      setRightDirty(true);
      setLastModifiedSide('right');
      setActiveFocusSide('right');
      flashCopiedHighlight('left', activeSelection.startLine, activeSelection.endLine, false);
      if (outRange.startLine > 0) {
        flashCopiedHighlight('right', outRange.startLine, outRange.endLine, false);
      }
      onUpdateStatus(`Copied selected lines ${activeSelection.startLine}–${activeSelection.endLine} Left ⇨ Right`);
      return;
    }

    const activeLine = cursorLineNumber || origEditor.getPosition()?.lineNumber || 1;
    const chunk = activeDiffChunk || findClosestChunk(chunksRef.current, activeLine, 'left');

    if (chunk) {
      clearGapTargetDecorations();
      const srcText = origModel.getLineContent(chunk.originalStart);
      triggerShiftAnimation('left-to-right', chunk.originalStart, srcText);
      collapseEditorGapViewZones(modEditor, chunk.modifiedStart);
      executeChunkCopyL2R(origModel, modModel, chunk, outRange, modEditor);
      const updated = modModel.getValue();
      rightContentRef.current = updated;
      setRightDirty(true);
      setLastModifiedSide('right');
      setActiveFocusSide('right');
      flashCopiedHighlight('left', chunk.originalStart, chunk.originalEnd || chunk.originalStart, false);
      if (outRange.startLine > 0) {
        flashCopiedHighlight('right', outRange.startLine, outRange.endLine, false);
      }
      onUpdateStatus(`Copied diff lines ${chunk.originalStart}–${chunk.originalEnd || chunk.originalStart} Left ⇨ Right`);
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

    const outRange: ChunkCopyRange = { startLine: 0, endLine: 0 };

    if (activeSelection && activeSelection.side === 'right') {
      clearGapTargetDecorations();
      const srcText = modModel.getLineContent(activeSelection.startLine);
      triggerShiftAnimation('right-to-left', activeSelection.startLine, srcText);
      const chunk = findClosestChunk(chunksRef.current, activeSelection.startLine, 'right');
      collapseEditorGapViewZones(origEditor, chunk ? chunk.originalStart : activeSelection.startLine);
      executeSelectedLinesCopyR2L(origModel, modModel, activeSelection, chunk, outRange, origEditor);
      const updated = origModel.getValue();
      leftContentRef.current = updated;
      setLeftDirty(true);
      setLastModifiedSide('left');
      setActiveFocusSide('left');
      flashCopiedHighlight('right', activeSelection.startLine, activeSelection.endLine, false);
      if (outRange.startLine > 0) {
        flashCopiedHighlight('left', outRange.startLine, outRange.endLine, false);
      }
      onUpdateStatus(`Copied selected lines ${activeSelection.startLine}–${activeSelection.endLine} Right ⇦ Left`);
      return;
    }

    const activeLine = cursorLineNumber || modEditor.getPosition()?.lineNumber || 1;
    const chunk = activeDiffChunk || findClosestChunk(chunksRef.current, activeLine, 'right');

    if (chunk) {
      clearGapTargetDecorations();
      const srcText = modModel.getLineContent(chunk.modifiedStart);
      triggerShiftAnimation('right-to-left', chunk.modifiedStart, srcText);
      collapseEditorGapViewZones(origEditor, chunk.originalStart);
      executeChunkCopyR2L(origModel, modModel, chunk, outRange, origEditor);
      const updated = origModel.getValue();
      leftContentRef.current = updated;
      setLeftDirty(true);
      setLastModifiedSide('left');
      setActiveFocusSide('left');
      flashCopiedHighlight('right', chunk.modifiedStart, chunk.modifiedEnd || chunk.modifiedStart, false);
      if (outRange.startLine > 0) {
        flashCopiedHighlight('left', outRange.startLine, outRange.endLine, false);
      }
      onUpdateStatus(`Copied diff lines ${chunk.modifiedStart}–${chunk.modifiedEnd || chunk.modifiedStart} Right ⇦ Left`);
    }
  };



  // Single active line copy L -> R (respects alignment gaps)
  const handleCopyActiveLineL2R = () => {
    if (!diffEditorRef.current || cursorLineNumber === null) return;
    const modEditor = diffEditorRef.current.getModifiedEditor();
    const origEditor = diffEditorRef.current.getOriginalEditor();
    const modModel = modEditor.getModel();
    const origModel = origEditor.getModel();
    if (!modModel || !origModel) return;

    const chunk = findChunkAtLine(chunksRef.current, cursorLineNumber, 'left') || findClosestChunk(chunksRef.current, cursorLineNumber, 'left');
    if (chunk) {
      clearGapTargetDecorations();
      const outRange: ChunkCopyRange = { startLine: 0, endLine: 0 };
      const srcText = origModel.getLineContent(chunk.originalStart || cursorLineNumber);
      triggerShiftAnimation('left-to-right', chunk.originalStart || cursorLineNumber, srcText);
      collapseEditorGapViewZones(modEditor, chunk.modifiedStart);
      executeChunkCopyL2R(origModel, modModel, chunk, outRange, modEditor);
      rightContentRef.current = modModel.getValue();
      setRightDirty(true);
      setLastModifiedSide('right');
      setActiveFocusSide('right');
      flashCopiedHighlight('left', chunk.originalStart, chunk.originalEnd || chunk.originalStart, false);
      if (outRange.startLine > 0) {
        flashCopiedHighlight('right', outRange.startLine, outRange.endLine, false);
      }
      onUpdateStatus(`Copied diff chunk Left ⇨ Right`);
      return;
    }

    const leftLine = cursorLineNumber <= origModel.getLineCount() ? origModel.getLineContent(cursorLineNumber) : '';
    triggerShiftAnimation('left-to-right', cursorLineNumber, leftLine);
    const rightLineNum = Math.min(cursorLineNumber, modModel.getLineCount());
    const range = {
      startLineNumber: rightLineNum,
      startColumn: 1,
      endLineNumber: rightLineNum,
      endColumn: modModel.getLineMaxColumn(rightLineNum),
    };
    modModel.pushEditOperations([], [{ range, text: leftLine }], () => null);
    rightContentRef.current = modModel.getValue();
    setRightDirty(true);
    flashCopiedHighlight('left', cursorLineNumber, cursorLineNumber, false);
    flashCopiedHighlight('right', rightLineNum, rightLineNum, false);
    onUpdateStatus(`Copied line ${cursorLineNumber} Left ⇨ Right`);
  };

  // Single active line copy R -> L (respects alignment gaps)
  const handleCopyActiveLineR2L = () => {
    if (!diffEditorRef.current || cursorLineNumber === null) return;
    const modEditor = diffEditorRef.current.getModifiedEditor();
    const origEditor = diffEditorRef.current.getOriginalEditor();
    const modModel = modEditor.getModel();
    const origModel = origEditor.getModel();
    if (!modModel || !origModel) return;

    const chunk = findChunkAtLine(chunksRef.current, cursorLineNumber, 'right') || findClosestChunk(chunksRef.current, cursorLineNumber, 'right');
    if (chunk) {
      clearGapTargetDecorations();
      const outRange: ChunkCopyRange = { startLine: 0, endLine: 0 };
      const srcText = modModel.getLineContent(chunk.modifiedStart || cursorLineNumber);
      triggerShiftAnimation('right-to-left', chunk.modifiedStart || cursorLineNumber, srcText);
      collapseEditorGapViewZones(origEditor, chunk.originalStart);
      executeChunkCopyR2L(origModel, modModel, chunk, outRange, origEditor);
      leftContentRef.current = origModel.getValue();
      setLeftDirty(true);
      setLastModifiedSide('left');
      setActiveFocusSide('left');
      flashCopiedHighlight('right', chunk.modifiedStart, chunk.modifiedEnd || chunk.modifiedStart, false);
      if (outRange.startLine > 0) {
        flashCopiedHighlight('left', outRange.startLine, outRange.endLine, false);
      }
      onUpdateStatus(`Copied diff chunk Right ⇦ Left`);
      return;
    }

    const rightLine = cursorLineNumber <= modModel.getLineCount() ? modModel.getLineContent(cursorLineNumber) : '';
    triggerShiftAnimation('right-to-left', cursorLineNumber, rightLine);
    const leftLineNum = Math.min(cursorLineNumber, origModel.getLineCount());
    const range = {
      startLineNumber: leftLineNum,
      startColumn: 1,
      endLineNumber: leftLineNum,
      endColumn: origModel.getLineMaxColumn(leftLineNum),
    };
    origModel.pushEditOperations([], [{ range, text: rightLine }], () => null);
    leftContentRef.current = origModel.getValue();
    setLeftDirty(true);
    flashCopiedHighlight('right', cursorLineNumber, cursorLineNumber, false);
    flashCopiedHighlight('left', leftLineNum, leftLineNum, false);
    onUpdateStatus(`Copied line ${cursorLineNumber} Right ⇦ Left`);
  };

  // Safe Save Operations (Direct save without modal popups - Beyond Compare style)
  const handleSaveLeft = async () => {
    if (!leftPath) return;
    const content = diffEditorRef.current?.getOriginalEditor()?.getValue() ?? leftContentRef.current;
    if (window.diffxAPI) {
      const res = await window.diffxAPI.saveFile({
        filePath: leftPath,
        content,
        createBackup: false,
      });
      if (res.success) {
        setLeftDirty(false);
        leftContentRef.current = content;
        if (leftData) {
          setLeftData({ ...leftData, content });
        }
        onUpdateStatus(`Saved left file: ${leftPath.split(/[/\\]/).pop()}`);
      } else {
        setLoadError(`Save failed: ${res.error}`);
      }
    }
  };

  const handleSaveRight = async () => {
    if (!rightPath) return;
    const content = diffEditorRef.current?.getModifiedEditor()?.getValue() ?? rightContentRef.current;
    if (window.diffxAPI) {
      const res = await window.diffxAPI.saveFile({
        filePath: rightPath,
        content,
        createBackup: false,
      });
      if (res.success) {
        setRightDirty(false);
        rightContentRef.current = content;
        if (rightData) {
          setRightData({ ...rightData, content });
        }
        onUpdateStatus(`Saved right file: ${rightPath.split(/[/\\]/).pop()}`);
      } else {
        setLoadError(`Save failed: ${res.error}`);
      }
    }
  };

  const handleRevertAll = () => {
    if (leftData) {
      leftContentRef.current = leftData.content;
      if (diffEditorRef.current) {
        diffEditorRef.current.getOriginalEditor().setValue(leftData.content);
      }
      setLeftDirty(false);
    }
    if (rightData) {
      rightContentRef.current = rightData.content;
      if (diffEditorRef.current) {
        diffEditorRef.current.getModifiedEditor().setValue(rightData.content);
      }
      setRightDirty(false);
    }
  };

  // Keyboard Shortcuts:
  // Native Monaco handles Ctrl+Z, Ctrl+Y, Ctrl+C, Ctrl+V when text is focused.
  // We provide Alt+Right (L2R), Alt+Left (R2L), Alt+Down (Next Diff), Alt+Up (Prev Diff), Ctrl+S (Save), Ctrl+F (Find).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // Check if one of the editors has active text focus
      const origEditor = diffEditorRef.current?.getOriginalEditor();
      const modEditor = diffEditorRef.current?.getModifiedEditor();
      const hasEditorFocus = origEditor?.hasTextFocus() || modEditor?.hasTextFocus();

      // Diff Navigation Shortcuts: Alt+Down / Alt+Up (or Ctrl+Down / Ctrl+Up outside editor)
      if ((e.altKey && e.key === 'ArrowDown') || (!hasEditorFocus && isCtrlOrCmd && e.key === 'ArrowDown')) {
        e.preventDefault();
        handleNextDiff();
        return;
      }
      if ((e.altKey && e.key === 'ArrowUp') || (!hasEditorFocus && isCtrlOrCmd && e.key === 'ArrowUp')) {
        e.preventDefault();
        handlePrevDiff();
        return;
      }

      // Beyond Compare Transfer Shortcuts: Alt+Right (L2R), Alt+Left (R2L)
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        handleCopyL2R();
        return;
      }
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        handleCopyR2L();
        return;
      }

      // Find: Ctrl+F / Cmd+F
      if (isCtrlOrCmd && e.key.toLowerCase() === 'f') {
        if (!diffEditorRef.current) return;
        e.preventDefault();
        const targetSide = origEditor?.hasTextFocus() ? 'left' : modEditor?.hasTextFocus() ? 'right' : activeFocusSide;
        const targetEditor = targetSide === 'left' ? origEditor : modEditor;
        targetEditor?.focus();
        targetEditor?.getAction('actions.find')?.run();
        return;
      }

      // Save: Ctrl+S / Cmd+S (Direct save without popup)
      if (isCtrlOrCmd && e.key.toLowerCase() === 's') {
        if (!diffEditorRef.current) return;
        e.preventDefault();
        const targetSide = origEditor?.hasTextFocus()
          ? 'left'
          : modEditor?.hasTextFocus()
          ? 'right'
          : rightDirty && !leftDirty
          ? 'right'
          : leftDirty && !rightDirty
          ? 'left'
          : activeFocusSide || lastModifiedSide || 'right';
        if (targetSide === 'left') {
          handleSaveLeft();
        } else {
          handleSaveRight();
        }
        return;
      }

      // When editor has focus, DO NOT intercept Ctrl+Z / Ctrl+Y - let Monaco handle undo/redo natively!
      if (hasEditorFocus) return;

      // Fallback global Undo: Ctrl+Z / Cmd+Z when editor doesn't have focus
      if (isCtrlOrCmd && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        const targetEditor = lastModifiedSide === 'left' ? origEditor : modEditor;
        targetEditor?.focus();
        targetEditor?.trigger('keyboard', 'undo', null);
        return;
      }

      // Fallback global Redo: Ctrl+Y / Cmd+Shift+Z when editor doesn't have focus
      if (
        (isCtrlOrCmd && e.key.toLowerCase() === 'y') ||
        (isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        const targetEditor = lastModifiedSide === 'left' ? origEditor : modEditor;
        targetEditor?.focus();
        targetEditor?.trigger('keyboard', 'redo', null);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFocusSide, lastModifiedSide, handleSaveLeft, handleSaveRight, handleCopyL2R, handleCopyR2L]);

  const editorLanguage = format === 'xml' ? 'xml' : format === 'json' ? 'json' : 'yaml';
  const leftMeta = formatFileMetadata(leftData, leftPath, format);
  const rightMeta = formatFileMetadata(rightData, rightPath, format);

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-black overflow-hidden text-neutral-900 dark:text-neutral-100 font-sans select-none w-full max-w-full">
      {/* ================= 1. Beyond Compare Action Toolbar ================= */}
      <div className="bg-[#f0f0f0] dark:bg-[#0a0a0a] border-b border-[#c8c8c8] dark:border-neutral-800 px-2 py-1 flex items-center justify-between text-xs flex-shrink-0 select-none shadow-xs">
        {/* Left Toolbar Items */}
        <div className="flex items-center space-x-1.5">
          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              title="Return to Sessions Home"
              className="p-1 rounded bg-white dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-800 transition shadow-xs"
            >
              <Home className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Jumpers */}
          <button
            onClick={handlePrevDiff}
            data-action="prev-diff"
            title="Previous Difference (Alt+Up)"
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 text-[11px] shadow-xs"
          >
            <ArrowUp className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            <span>Prev</span>
          </button>
          <button
            onClick={handleNextDiff}
            data-action="next-diff"
            title="Next Difference (Alt+Down)"
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 text-[11px] shadow-xs"
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
              className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition ${
                activeFilter === 'all'
                  ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-950 font-semibold shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              * All
            </button>
            <button
              onClick={() => setActiveFilter('diffs')}
              data-action="filter-diffs"
              title="Show Differences Only (≠)"
              className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition ${
                activeFilter === 'diffs'
                  ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-950 font-semibold shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              ≠ Diffs
            </button>
            <button
              onClick={() => setActiveFilter('same')}
              data-action="filter-same"
              title="Show Same Only (=)"
              className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition ${
                activeFilter === 'same'
                  ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-950 font-semibold shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              = Same
            </button>
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center space-x-1.5 flex-shrink-0">
          {/* Revert Edits */}
          {(leftDirty || rightDirty) && (
            <button
              onClick={handleRevertAll}
              title="Revert unsaved edits"
              className="flex items-center space-x-1 px-2 py-0.5 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 text-[11px] shadow-xs"
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
          {leftDirty && (
            <button
              onClick={handleSaveLeft}
              title="Save Left File Changes (Ctrl+S)"
              className="ml-1 px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[10px] flex items-center space-x-1 shadow-xs transition flex-shrink-0 animate-pulse"
            >
              <Save className="w-3 h-3" />
              <span>Save</span>
            </button>
          )}
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
          {rightDirty && (
            <button
              onClick={handleSaveRight}
              title="Save Right File Changes (Ctrl+S)"
              className="ml-1 px-2 py-0.5 rounded bg-purple-600 hover:bg-purple-500 text-white font-semibold text-[10px] flex items-center space-x-1 shadow-xs transition flex-shrink-0 animate-pulse"
            >
              <Save className="w-3 h-3" />
              <span>Save</span>
            </button>
          )}
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
          <div className="w-1/2 flex items-center space-x-2 truncate pr-2">
            {leftPath ? (
              <span className="flex items-center space-x-1 truncate text-blue-700 dark:text-blue-300 font-semibold" title={leftPath}>
                <FileCode className="w-3 h-3 text-blue-500 flex-shrink-0" />
                <span className="truncate">{leftPath}</span>
              </span>
            ) : (
              <span className="italic text-neutral-400">No config file on Left</span>
            )}
            {leftMeta && (
              <>
                <span className="text-neutral-400">•</span>
                <span className="flex items-center space-x-1 text-neutral-700 dark:text-neutral-300 font-medium flex-shrink-0">
                  <Database className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                  <span>{leftMeta.formattedBytes}</span>
                </span>
                <span className="text-[9px] uppercase tracking-wider text-blue-600 dark:text-blue-400 flex-shrink-0">
                  {leftMeta.spec}
                </span>
              </>
            )}
          </div>

          <div className="h-3 w-px bg-neutral-300 dark:bg-neutral-800 mx-1 flex-shrink-0" />

          <div className="w-1/2 flex items-center space-x-2 truncate pl-2">
            {rightPath ? (
              <span className="flex items-center space-x-1 truncate text-purple-700 dark:text-purple-300 font-semibold" title={rightPath}>
                <FileCode className="w-3 h-3 text-purple-500 flex-shrink-0" />
                <span className="truncate">{rightPath}</span>
              </span>
            ) : (
              <span className="italic text-neutral-400">No config file on Right</span>
            )}
            {rightMeta && (
              <>
                <span className="text-neutral-400">•</span>
                <span className="flex items-center space-x-1 text-neutral-700 dark:text-neutral-300 font-medium flex-shrink-0">
                  <Database className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                  <span>{rightMeta.formattedBytes}</span>
                </span>
                <span className="text-[9px] uppercase tracking-wider text-purple-600 dark:text-purple-400 flex-shrink-0">
                  {rightMeta.spec}
                </span>
              </>
            )}
          </div>
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
            totalLines={totalLineCount}
            currentLine={cursorLineNumber || 1}
            onScrollToChunk={handleJumpToChunk}
            onScrollToLine={(line) => {
              if (diffEditorRef.current) {
                try {
                  const chunk = findClosestChunk(diffChunks, line, activeFocusSide);
                  if (chunk) {
                    handleJumpToChunk(chunk);
                  } else {
                    const orig = diffEditorRef.current.getOriginalEditor();
                    orig.revealLineInCenter(line);
                    orig.setPosition({ lineNumber: line, column: 1 });
                    updateLineDetails(line);
                  }
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
          {/* UI/UX Pro Max: Flying Shift Transfer Ghost Pill */}
          {activeShiftFlyer && (
            <div
              key={activeShiftFlyer.id}
              style={{ top: `${activeShiftFlyer.top}px` }}
              className={`diffx-shift-flyer ${
                activeShiftFlyer.direction === 'left-to-right'
                  ? 'diffx-shift-flyer-l2r'
                  : 'diffx-shift-flyer-r2l'
              }`}
            >
              <span>{activeShiftFlyer.direction === 'left-to-right' ? '⇨' : '⇦'}</span>
              <span className="truncate max-w-[280px]">{activeShiftFlyer.text}</span>
            </div>
          )}

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
              original={leftInitialContent}
              modified={rightInitialContent}
              theme={theme === 'dark' ? 'beyond-compare-dark' : 'beyond-compare-light'}
              beforeMount={(monaco) => {
                monaco.editor.defineTheme('beyond-compare-light', {
                  base: 'vs',
                  inherit: true,
                  rules: [
                    { token: '', foreground: '09090b' },
                    { token: 'tag', foreground: '0284c7' },
                    { token: 'tag.xml', foreground: '0284c7' },
                    { token: 'tag.id.xml', foreground: 'b91c1c', fontStyle: 'bold' },
                    { token: 'metatag.xml', foreground: '4338ca' },
                    { token: 'attribute.name', foreground: '9a3412', fontStyle: 'bold' },
                    { token: 'attribute.name.xml', foreground: '9a3412', fontStyle: 'bold' },
                    { token: 'attribute.value', foreground: '15803d' },
                    { token: 'attribute.value.xml', foreground: '15803d' },
                    { token: 'string', foreground: '15803d' },
                    { token: 'string.xml', foreground: '15803d' },
                    { token: 'number', foreground: 'c2410c' },
                    { token: 'keyword', foreground: '7c3aed', fontStyle: 'bold' },
                    { token: 'delimiter', foreground: '334155' },
                    { token: 'delimiter.xml', foreground: '0284c7' },
                    { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
                  ],
                  colors: {
                    'editor.background': '#ffffff',
                    'editor.foreground': '#09090b',
                    'editorGutter.background': '#f8fafc',
                    'editorLineNumber.foreground': '#64748b',
                    'editorLineNumber.activeForeground': '#09090b',
                    'editor.selectionBackground': '#93c5fd88',
                    'editor.selectionHighlightBackground': '#bfdbfe66',
                    'diffEditor.insertedTextBackground': '#fca5a5',
                    'diffEditor.removedTextBackground': '#fca5a5',
                    'diffEditor.insertedLineBackground': '#ffe4e6',
                    'diffEditor.removedLineBackground': '#ffe4e6',
                    'diffEditor.diagonalFill': '#f1f5f9',
                    'diffEditorGutter.insertedLineBackground': '#00000000',
                    'diffEditorGutter.removedLineBackground': '#00000000',
                  },
                });

                monaco.editor.defineTheme('beyond-compare-dark', {
                  base: 'vs-dark',
                  inherit: true,
                  rules: [
                    { token: '', foreground: 'f8fafc' },
                    { token: 'comment', foreground: '94a3b8', fontStyle: 'italic' },
                    { token: 'keyword', foreground: 'f472b6', fontStyle: 'bold' },
                    { token: 'string', foreground: '4ade80' },
                    { token: 'string.xml', foreground: '4ade80' },
                    { token: 'number', foreground: 'fde047' },
                    { token: 'tag', foreground: '38bdf8' },
                    { token: 'tag.xml', foreground: '38bdf8' },
                    { token: 'tag.id.xml', foreground: 'fb7185', fontStyle: 'bold' },
                    { token: 'attribute.name', foreground: 'fbbf24', fontStyle: 'bold' },
                    { token: 'attribute.name.xml', foreground: 'fbbf24', fontStyle: 'bold' },
                    { token: 'attribute.value', foreground: '34d399' },
                    { token: 'attribute.value.xml', foreground: '34d399' },
                    { token: 'delimiter', foreground: 'cbd5e1' },
                    { token: 'delimiter.xml', foreground: '38bdf8' },
                  ],
                  colors: {
                    'editor.background': '#000000',
                    'editor.foreground': '#f8fafc',
                    'editorGutter.background': '#000000',
                    'editorLineNumber.foreground': '#64748b',
                    'editorLineNumber.activeForeground': '#f8fafc',
                    'editor.selectionBackground': '#3b82f644',
                    'editor.selectionHighlightBackground': '#3b82f622',
                    'diffEditor.insertedTextBackground': '#584116',
                    'diffEditor.removedTextBackground': '#5c1c24',
                    'diffEditor.insertedLineBackground': '#352915',
                    'diffEditor.removedLineBackground': '#2e151b',
                    'diffEditor.diagonalFill': '#000000',
                    'diffEditorGutter.insertedLineBackground': '#00000000',
                    'diffEditorGutter.removedLineBackground': '#00000000',
                  },
                });
              }}
              onMount={handleEditorDidMount}
              options={{
                renderSideBySide,
                readOnly: false,
                originalEditable: true,
                fontSize: 13.5,
                lineHeight: 22,
                fontWeight: '500',
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', Menlo, Monaco, Consolas, monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                diffCodeLens: false,
                renderIndicators: false,
                renderMarginRevertIcon: false,
                renderGutterMenu: false,
                renderOverviewRuler: false,
                diffWordWrap: 'off',
                glyphMargin: false,
                lineDecorationsWidth: 20,
                lineNumbers: 'on',
                lineNumbersMinChars: 3,
                selectionHighlight: false,
                occurrencesHighlight: 'off',
                matchBrackets: 'never',
                renderValidationDecorations: 'off',
                stickyScroll: { enabled: false },
                maxComputationTime: 2000,
                diffAlgorithm: 'legacy',
                ignoreTrimWhitespace: false,
                hideUnchangedRegions: { enabled: false },
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
