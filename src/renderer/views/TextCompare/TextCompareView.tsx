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
  CheckCircle2,
  Home,
  FolderOpen,
  Database,
  X,
} from 'lucide-react';
import { FileContentResult, TextCompareOptions } from '@shared/types.js';
import { compareTextContent } from '@shared/comparison-engine/whitespace.js';
import {
  DiffChunk,
  normalizeLineChanges,
  findChunkAtLine,
  findClosestChunk,
  findChunkAtGap,
  executeChunkCopyL2R,
  executeChunkCopyR2L,
  executeSelectedLinesCopyL2R,
  executeSelectedLinesCopyR2L,
  collapseEditorGapViewZones,
  ChunkCopyRange,
  computeUnchangedRanges,
  computeDiffRanges,
  mapLineNumber,
} from '@shared/comparison-engine/diff-copy.js';
import { ConfirmModalConfig } from '../../components/ConfirmModal.js';
import { LineDetailInspector } from '../../components/LineDetailInspector.js';
import { DiffOverviewMap } from '../../components/DiffOverviewMap.js';
import { registerBrowserFile } from '../../utils/browser-api.js';

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
  const dateStr =
    now.toLocaleDateString() +
    ' ' +
    now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

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
  onRequestConfirm: _onRequestConfirm,
  onUpdateStatus,
}) => {
  // File Content State
  const [leftData, setLeftData] = useState<FileContentResult | null>(null);
  const [rightData, setRightData] = useState<FileContentResult | null>(null);
  const [leftInitialContent, setLeftInitialContent] = useState<string>('');
  const [rightInitialContent, setRightInitialContent] = useState<string>('');
  const leftContentRef = useRef<string>('');
  const rightContentRef = useRef<string>('');
  const [totalLineCount, setTotalLineCount] = useState<number>(1);

  const [isLoading, setIsLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);

  // Unsaved Edits tracking
  const [leftDirty, setLeftDirty] = useState(false);
  const [rightDirty, setRightDirty] = useState(false);

  // Beyond Compare View Filters: 'all' | 'diffs' | 'same'
  const [activeFilter, setActiveFilter] = useState<'all' | 'diffs' | 'same'>('all');

  // Diff Options State
  const options: TextCompareOptions = {
    ignoreWhitespace: 'none',
    ignoreBlankLines: false,
    ignoreCase: false,
  };

  const renderSideBySide = true;
  const [diffStats, setDiffStats] = useState<{
    diffCount: number;
    whitespaceDifferenceOnly: boolean;
  }>({ diffCount: 0, whitespaceDifferenceOnly: false });

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
  const activeSelectionRef = useRef<{
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
        setLeftDirty(false);
        onSetLeftPath(item.path);
        onUpdateStatus(`Loaded Left file: ${item.path}`);
      } else {
        setRightInitialContent(txt);
        rightContentRef.current = txt;
        setRightDirty(false);
        onSetRightPath(item.path);
        onUpdateStatus(`Loaded Right file: ${item.path}`);
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

  // Monaco references
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

  const [activeGapState, setActiveGapState] = useState<{
    side: 'left' | 'right';
    afterLineNumber: number;
    rowOffset?: number;
    effectiveLineNumber?: number;
    targetInsertLine: number;
    chunk: DiffChunk | null;
  } | null>(null);

  const activeGapRef = useRef<{
    side: 'left' | 'right';
    afterLineNumber: number;
    rowOffset?: number;
    effectiveLineNumber?: number;
    targetInsertLine: number;
    chunk: DiffChunk | null;
  } | null>(null);

  const clearGapTargetDecorations = () => {
    activeGapRef.current = null;
    setActiveGapState(null);
    try {
      document.querySelectorAll('.diffx-active-gap-target').forEach((node: any) => {
        node.classList.remove('diffx-active-gap-target');
      });
      document.querySelectorAll('.diffx-gap-cursor-indicator').forEach((node: any) => {
        node.remove();
      });
      document.querySelectorAll('.diffx-gap-row-active').forEach((node: any) => {
        node.remove();
      });
      document.querySelectorAll('.diffx-gap-active').forEach((node: any) => {
        node.classList.remove('diffx-gap-active');
      });
    } catch {
      // ignore
    }
  };

  const updateGapCursorElement = (editorDom: HTMLElement | null, rowOffset: number) => {
    if (!editorDom) return;
    const vz = editorDom.querySelector('.diffx-active-gap-target') as HTMLElement | null;
    if (!vz) return;
    const rowHeight = 22;
    const cursorTop = rowOffset * rowHeight + 2;
    const cursorHeight = Math.max(14, rowHeight - 4);
    const cursorIndicator = vz.querySelector('.diffx-gap-cursor-indicator') as HTMLElement | null;
    if (cursorIndicator) {
      cursorIndicator.style.top = `${cursorTop}px`;
      cursorIndicator.style.height = `${cursorHeight}px`;
    }
    const rowActive = vz.querySelector('.diffx-gap-row-active') as HTMLElement | null;
    if (rowActive) {
      rowActive.style.top = `${rowOffset * rowHeight}px`;
      rowActive.style.height = `${rowHeight}px`;
    }
  };

  const isGapEventTarget = (target: HTMLElement | null): boolean => {
    if (!target) return false;
    if (
      target.classList?.contains('diffx-gap-gutter-arrow') ||
      target.closest?.('.diffx-gap-gutter-arrow')
    ) {
      return false;
    }
    return Boolean(
      target.classList?.contains('view-zone') ||
      target.classList?.contains('diagonal-fill') ||
      target.classList?.contains('ced-diagonal-fill') ||
      target.classList?.contains('diff-hidden-lines') ||
      target.classList?.contains('diffx-active-gap-target') ||
      target.classList?.contains('diffx-gap-cursor-indicator') ||
      target.classList?.contains('diffx-gap-row-active') ||
      target.closest?.('.view-zone') ||
      target.closest?.('.diagonal-fill') ||
      target.closest?.('.ced-diagonal-fill') ||
      target.closest?.('.diff-hidden-lines') ||
      target.closest?.('.diffx-active-gap-target') ||
      target.closest?.('.margin-view-zones')
    );
  };

  // Synchronize permanent Beyond Compare yellow gutter arrows for all diff alignment gaps (view zones)
  const syncGapGutterArrows = () => {
    if (!diffEditorRef.current) return;
    const origEditor = diffEditorRef.current.getOriginalEditor();
    const modEditor = diffEditorRef.current.getModifiedEditor();
    const origDom = origEditor?.getDomNode?.();
    const modDom = modEditor?.getDomNode?.();
    if (!origDom || !modDom) return;

    const chunks = canonicalChunksRef.current.length ? canonicalChunksRef.current : chunksRef.current;
    if (!chunks || chunks.length === 0) {
      origDom.querySelectorAll('.diffx-gap-gutter-arrow').forEach((el: any) => el.remove());
      modDom.querySelectorAll('.diffx-gap-gutter-arrow').forEach((el: any) => el.remove());
      return;
    }

    let rowHeight = 22;
    try {
      const optHeight = modEditor.getOption(66);
      if (optHeight && typeof optHeight === 'number') rowHeight = optHeight;
    } catch {
      rowHeight = 22;
    }

    const origMargin = (origDom.querySelector('.margin-view-zones') || origDom.querySelector('.margin')) as HTMLElement | null;
    const modMargin = (modDom.querySelector('.margin-view-zones') || modDom.querySelector('.margin')) as HTMLElement | null;

    const activeKeys = new Set<string>();

    chunks.forEach((chunk) => {
      // Case A: Right has gap (modifiedEnd === 0), Left has content (originalStart..originalEnd)
      // Permanent yellow ⇦ arrow in Right margin. Clicking it copies empty space Right ⇦ Left (deletes left lines).
      if (chunk.modifiedEnd === 0 && chunk.originalStart > 0 && modMargin) {
        const topPx = origEditor.getTopForLineNumber(chunk.originalStart);
        const numRows = Math.max(1, chunk.originalEnd - chunk.originalStart + 1);

        for (let r = 0; r < numRows; r++) {
          const arrowKey = `mod-gap-${chunk.id || chunk.originalStart}-${r}`;
          activeKeys.add(arrowKey);
          let arrow = modMargin.querySelector(`[data-arrow-key="${arrowKey}"]`) as HTMLElement | null;
          if (!arrow) {
            arrow = document.createElement('div');
            arrow.className = 'diffx-gap-gutter-arrow diffx-gap-gutter-arrow-right';
            arrow.setAttribute('data-arrow-key', arrowKey);
            arrow.title = 'Copy empty space Right ⇦ Left (delete left line)';
            const onArrowClick = (e: Event) => {
              e.stopPropagation();
              e.preventDefault();
              handleCopyR2L(chunk);
            };
            arrow.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); }, true);
            arrow.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); }, true);
            arrow.addEventListener('click', onArrowClick, true);
            modMargin.appendChild(arrow);
          }
          arrow.style.position = 'absolute';
          arrow.style.top = `${topPx + (r * rowHeight)}px`;
          arrow.style.height = `${rowHeight}px`;
          arrow.style.left = '0';
          arrow.style.width = '100%';
          arrow.style.display = 'block';
        }
      }

      // Case B: Left has gap (originalEnd === 0), Right has content (modifiedStart..modifiedEnd)
      // Permanent yellow ⇨ arrow in Left margin. Clicking it copies empty space Left ⇨ Right (deletes right lines).
      if (chunk.originalEnd === 0 && chunk.modifiedStart > 0 && origMargin) {
        const topPx = modEditor.getTopForLineNumber(chunk.modifiedStart);
        const numRows = Math.max(1, chunk.modifiedEnd - chunk.modifiedStart + 1);

        for (let r = 0; r < numRows; r++) {
          const arrowKey = `orig-gap-${chunk.id || chunk.modifiedStart}-${r}`;
          activeKeys.add(arrowKey);
          let arrow = origMargin.querySelector(`[data-arrow-key="${arrowKey}"]`) as HTMLElement | null;
          if (!arrow) {
            arrow = document.createElement('div');
            arrow.className = 'diffx-gap-gutter-arrow diffx-gap-gutter-arrow-left';
            arrow.setAttribute('data-arrow-key', arrowKey);
            arrow.title = 'Copy empty space Left ⇨ Right (delete right line)';
            const onArrowClick = (e: Event) => {
              e.stopPropagation();
              e.preventDefault();
              handleCopyL2R(chunk);
            };
            arrow.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); }, true);
            arrow.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); }, true);
            arrow.addEventListener('click', onArrowClick, true);
            origMargin.appendChild(arrow);
          }
          arrow.style.position = 'absolute';
          arrow.style.top = `${topPx + (r * rowHeight)}px`;
          arrow.style.height = `${rowHeight}px`;
          arrow.style.left = '0';
          arrow.style.width = '100%';
          arrow.style.display = 'block';
        }
      }
    });

    origDom.querySelectorAll('.diffx-gap-gutter-arrow').forEach((el: any) => {
      const key = el.getAttribute('data-arrow-key');
      if (key && !activeKeys.has(key)) el.remove();
    });
    modDom.querySelectorAll('.diffx-gap-gutter-arrow').forEach((el: any) => {
      const key = el.getAttribute('data-arrow-key');
      if (key && !activeKeys.has(key)) el.remove();
    });
  };

  // Handle click on diff alignment empty space (view zone / gap) to place cursor cleanly without document mutation
  const handleDiffGapClick = (
    targetEditor: any,
    side: 'left' | 'right',
    e: any,
    chunks: DiffChunk[]
  ): boolean => {
    try {
      const rawTarget = (e.target instanceof HTMLElement ? e.target : e.target?.element) as HTMLElement | null;
      if (!rawTarget) return false;

      // Don't intercept gutter copy arrows
      const isGlyphArrow =
        rawTarget.classList?.contains('diffx-glyph-copy-l2r') ||
        rawTarget.classList?.contains('diffx-line-copy-l2r') ||
        rawTarget.classList?.contains('diffx-glyph-copy-r2l') ||
        rawTarget.classList?.contains('diffx-line-copy-r2l') ||
        rawTarget.classList?.contains('diffx-gap-gutter-arrow') ||
        Boolean(rawTarget.closest?.('.diffx-glyph-copy-l2r')) ||
        Boolean(rawTarget.closest?.('.diffx-line-copy-l2r')) ||
        Boolean(rawTarget.closest?.('.diffx-glyph-copy-r2l')) ||
        Boolean(rawTarget.closest?.('.diffx-line-copy-r2l')) ||
        Boolean(rawTarget.closest?.('.diffx-gap-gutter-arrow'));

      if (isGlyphArrow) return false;

      const targetType = e.target?.type;
      // Monaco MouseTargetType: 5 is GUTTER_VIEW_ZONE, 8 is CONTENT_VIEW_ZONE
      const isViewZoneType = targetType === 5 || targetType === 8;
      const hasViewZoneClass = isGapEventTarget(rawTarget);

      if (!isViewZoneType && !hasViewZoneClass) return false;

      // Prevent default and stop propagation across all event layers
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      if (e.event?.browserEvent) {
        e.event.browserEvent.preventDefault?.();
        e.event.browserEvent.stopPropagation?.();
        e.event.browserEvent.stopImmediatePropagation?.();
      }

      const vzTarget = rawTarget.classList?.contains('view-zone')
        ? rawTarget
        : ((rawTarget.closest?.('.view-zone') ||
            rawTarget.closest?.('.diff-hidden-lines') ||
            rawTarget.closest?.('.diagonal-fill') ||
            rawTarget.closest?.('.ced-diagonal-fill')) as HTMLElement | null);

      const editorDom = targetEditor.getDomNode?.();
      if (!editorDom) return false;

      clearGapTargetDecorations();
      editorDom.classList.add('diffx-gap-active');

      const model = targetEditor.getModel();
      if (!model) return false;
      const lineCount = model.getLineCount();

      let afterLineNumber: number | null = null;
      if (e.target?.detail?.afterLineNumber !== undefined) {
        afterLineNumber = e.target.detail.afterLineNumber;
      }

      // Check Monaco internal viewZones._zones map
      if (afterLineNumber === null) {
        const vzPart = targetEditor._view?._viewZones || targetEditor._view?.viewZones || targetEditor._viewZones;
        if (vzPart && vzPart._zones) {
          for (const k of Object.keys(vzPart._zones)) {
            const z = vzPart._zones[k];
            if (!z) continue;
            if (
              z.domNode?.domNode === vzTarget ||
              z.domNode?.domNode?.contains(vzTarget) ||
              z.delegate?.domNode === vzTarget ||
              z.delegate?.domNode?.contains(vzTarget)
            ) {
              afterLineNumber = z.delegate?.afterLineNumber ?? z.afterLineNumber;
              break;
            }
          }
        }
      }

      let rowHeight = 22;
      try {
        const optHeight = targetEditor.getOption(66);
        if (optHeight && typeof optHeight === 'number') rowHeight = optHeight;
      } catch {
        rowHeight = 22;
      }

      let vzTopPx = 0;
      let vzHeightPx = rowHeight;
      if (vzTarget) {
        vzTopPx = parseFloat(vzTarget.style.top || '0');
        vzHeightPx = vzTarget.offsetHeight || parseFloat(vzTarget.style.height || `${rowHeight}`);
      }

      if (afterLineNumber === null && vzTarget) {
        const approxLine = Math.max(0, Math.round(vzTopPx / rowHeight));
        afterLineNumber = Math.min(approxLine, lineCount);
      }

      const resolvedAfterLine = afterLineNumber !== null ? afterLineNumber : 0;
      const targetLine = Math.min(Math.max(1, resolvedAfterLine + 1), lineCount);

      // Locate corresponding diff chunk
      let matchedChunk = findChunkAtGap(chunks, resolvedAfterLine, side);
      if (!matchedChunk) {
        matchedChunk = chunks.find((c) =>
          side === 'left'
            ? c.originalStart === resolvedAfterLine || (c.originalEnd === 0 && Math.abs(c.originalStart - resolvedAfterLine) <= 1)
            : c.modifiedStart === resolvedAfterLine || (c.modifiedEnd === 0 && Math.abs(c.modifiedStart - resolvedAfterLine) <= 1)
        ) || null;
      }

      const clientY = e.clientY ?? e.event?.browserEvent?.clientY ?? 0;
      let rowOffset = 0;

      if (vzTarget) {
        vzTarget.classList.add('diffx-active-gap-target');
        const rect = vzTarget.getBoundingClientRect();
        const clickY = clientY > 0 ? Math.max(0, clientY - rect.top) : 0;
        const numRows = Math.max(1, Math.round(vzHeightPx / rowHeight));
        rowOffset = Math.max(0, Math.min(Math.floor(clickY / rowHeight), numRows - 1));

        const cursorTop = rowOffset * rowHeight + 2;
        const cursorHeight = Math.max(14, rowHeight - 4);

        // Render blinking cursor caret inside the alignment gap
        let cursorIndicator = vzTarget.querySelector('.diffx-gap-cursor-indicator') as HTMLElement | null;
        if (!cursorIndicator) {
          cursorIndicator = document.createElement('div');
          cursorIndicator.className = 'diffx-gap-cursor-indicator';
          vzTarget.appendChild(cursorIndicator);
        }
        cursorIndicator.style.top = `${cursorTop}px`;
        cursorIndicator.style.height = `${cursorHeight}px`;
        cursorIndicator.style.display = 'block';

        // Render active line highlight row inside the alignment gap
        let activeRowHighlight = vzTarget.querySelector('.diffx-gap-row-active') as HTMLElement | null;
        if (!activeRowHighlight) {
          activeRowHighlight = document.createElement('div');
          activeRowHighlight.className = 'diffx-gap-row-active';
          vzTarget.appendChild(activeRowHighlight);
        }
        activeRowHighlight.style.top = `${rowOffset * rowHeight}px`;
        activeRowHighlight.style.height = `${rowHeight}px`;
        activeRowHighlight.style.display = 'block';
      }

      const effectiveLineNumber = resolvedAfterLine + rowOffset + 1;

      activeGapRef.current = {
        side,
        afterLineNumber: resolvedAfterLine,
        rowOffset,
        effectiveLineNumber,
        targetInsertLine: targetLine,
        chunk: matchedChunk,
      };
      setActiveGapState(activeGapRef.current);

      if (matchedChunk) {
        setActiveDiffChunk(matchedChunk);
      }

      // Beyond Compare zero-jump focus: focus the DOM container with preventScroll
      // NEVER call targetEditor.focus() here as Monaco would jump native cursor to line 2
      editorDom.focus({ preventScroll: true });
      setActiveFocusSide(side);
      setCursorLineNumber(effectiveLineNumber);
      onUpdateStatus(`Line ${effectiveLineNumber} (Empty Space) : Col 1`);
      syncGapGutterArrows();
      return true;
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

    // Synchronously collapse view zones in target editor BEFORE model modification to prevent any jerk
    collapseEditorGapViewZones(editor, afterLine);

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
      const comp = compareTextContent(leftContentRef.current, rightContentRef.current, options);
      setDiffStats((prev) => ({
        ...prev,
        whitespaceDifferenceOnly: comp.whitespaceDifferenceOnly,
      }));
    }
  }, [options, leftData, rightData]);

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

      // Check if this line is part of a diff chunk
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
        // If selection is active on Left, suppress default chunk arrows that fall inside selection
        if (currentSelection && currentSelection.side === 'left') {
          if (chunk.originalStart >= currentSelection.startLine && chunk.originalStart <= currentSelection.endLine) {
            continue;
          }
        }
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

        // If selection is active on Right, suppress default chunk arrows that fall inside selection
        if (currentSelection && currentSelection.side === 'right') {
          if (chunk.modifiedStart >= currentSelection.startLine && chunk.modifiedStart <= currentSelection.endLine) {
            continue;
          }
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

      // 2. If user has actively selected specific line(s), highlight the selected lines & place a single unified action box
      if (currentSelection && currentSelection.side === 'left') {
        const origModel = origEditor.getModel();
        const maxCol = origModel ? origModel.getLineMaxColumn(currentSelection.endLine) : 1;
        const isMultiLine = currentSelection.endLine > currentSelection.startLine;
        // Selection highlight across the entire range
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
          },
        });
        // Single unified gutter box on the first line (single action box for the entire selection)
        newLeftDecs.push({
          range: {
            startLineNumber: currentSelection.startLine,
            startColumn: 1,
            endLineNumber: currentSelection.startLine,
            endColumn: 1,
          },
          options: {
            isWholeLine: false,
            linesDecorationsClassName: isMultiLine ? 'diffx-selection-gutter-box-l2r' : 'diffx-line-copy-l2r',
            linesDecorationsHoverMessage: {
              value: `**⇨ Copy Selected Lines (${currentSelection.startLine}–${currentSelection.endLine}) to Right**`,
            },
          },
        });
      } else if (currentSelection && currentSelection.side === 'right') {
        const modModel = modEditor.getModel();
        const maxCol = modModel ? modModel.getLineMaxColumn(currentSelection.endLine) : 1;
        const isMultiLine = currentSelection.endLine > currentSelection.startLine;
        // Selection highlight across the entire range
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
          },
        });
        // Single unified gutter box on the first line (single action box for the entire selection)
        newRightDecs.push({
          range: {
            startLineNumber: currentSelection.startLine,
            startColumn: 1,
            endLineNumber: currentSelection.startLine,
            endColumn: 1,
          },
          options: {
            isWholeLine: false,
            linesDecorationsClassName: isMultiLine ? 'diffx-selection-gutter-box-r2l' : 'diffx-line-copy-r2l',
            linesDecorationsHoverMessage: {
              value: `**⇦ Copy Selected Lines (${currentSelection.startLine}–${currentSelection.endLine}) to Left**`,
            },
          },
        });
      }

      leftDecorationsRef.current = origEditor.deltaDecorations(leftDecorationsRef.current, newLeftDecs);
      rightDecorationsRef.current = modEditor.deltaDecorations(rightDecorationsRef.current, newRightDecs);
      syncGapGutterArrows();
    } catch {
      // non-fatal
    }
  };

  // Monaco Diff Editor Mounting
  const handleEditorDidMount = (editor: any) => {
    diffEditorRef.current = editor;

    try {
      // Explicitly configure line decorations width and glyph margin on both panes
      const origEditor = editor.getOriginalEditor();
      const modEditor = editor.getModifiedEditor();

      origEditor.updateOptions({ stickyScroll: { enabled: false }, glyphMargin: true, lineDecorationsWidth: 20 });
      modEditor.updateOptions({ stickyScroll: { enabled: false }, glyphMargin: true, lineDecorationsWidth: 20 });

      // Track active focus side
      origEditor.onDidFocusEditorText(() => setActiveFocusSide('left'));
      modEditor.onDidFocusEditorText(() => setActiveFocusSide('right'));

      origEditor.onDidChangeViewZones(syncGapGutterArrows);
      modEditor.onDidChangeViewZones(syncGapGutterArrows);
      origEditor.onDidScrollChange(syncGapGutterArrows);
      modEditor.onDidScrollChange(syncGapGutterArrows);

      editor.onDidUpdateDiff(() => {
        const lineChanges = editor.getLineChanges();
        const chunks = normalizeLineChanges(lineChanges);
        if (activeFilter === 'all' || !canonicalChunksRef.current.length) {
          canonicalChunksRef.current = chunks;
        }
        setDiffStats((prev) => ({
          ...prev,
          diffCount: lineChanges ? lineChanges.length : 0,
        }));
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
          activeSelectionRef.current = newSel;
          setActiveSelection(newSel);
          updateGutterDecorations(canonicalChunksRef.current.length ? canonicalChunksRef.current : diffChunks, newSel);
        } else {
          activeSelectionRef.current = null;
          setActiveSelection(null);
          updateGutterDecorations(canonicalChunksRef.current.length ? canonicalChunksRef.current : diffChunks, null);
        }
      });

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
          if (e.code === 'ArrowUp' || e.browserEvent?.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            const curOffset = activeGapRef.current.rowOffset ?? 0;
            if (curOffset > 0) {
              activeGapRef.current.rowOffset = curOffset - 1;
              const effLine = activeGapRef.current.afterLineNumber + activeGapRef.current.rowOffset + 1;
              activeGapRef.current.effectiveLineNumber = effLine;
              setCursorLineNumber(effLine);
              onUpdateStatus(`Line ${effLine} (Empty Space) : Col 1`);
              updateGapCursorElement(origDom, activeGapRef.current.rowOffset);
            } else {
              const targetLine = Math.max(1, activeGapRef.current.afterLineNumber);
              clearGapTargetDecorations();
              origEditor.setPosition({ lineNumber: targetLine, column: origEditor.getModel()?.getLineMaxColumn(targetLine) || 1 });
              origEditor.focus();
            }
            return;
          } else if (e.code === 'ArrowDown' || e.browserEvent?.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            const curOffset = activeGapRef.current.rowOffset ?? 0;
            const vz = origDom?.querySelector('.diffx-active-gap-target') as HTMLElement | null;
            const vzHeight = vz ? vz.offsetHeight : 22;
            const numRows = Math.max(1, Math.round(vzHeight / 22));
            if (curOffset < numRows - 1) {
              activeGapRef.current.rowOffset = curOffset + 1;
              const effLine = activeGapRef.current.afterLineNumber + activeGapRef.current.rowOffset + 1;
              activeGapRef.current.effectiveLineNumber = effLine;
              setCursorLineNumber(effLine);
              onUpdateStatus(`Line ${effLine} (Empty Space) : Col 1`);
              updateGapCursorElement(origDom, activeGapRef.current.rowOffset);
            } else {
              const targetLine = Math.min(origEditor.getModel()?.getLineCount() || 1, activeGapRef.current.afterLineNumber + 1);
              clearGapTargetDecorations();
              origEditor.setPosition({ lineNumber: targetLine, column: 1 });
              origEditor.focus();
            }
            return;
          } else if (e.code === 'Enter' || e.browserEvent?.key === 'Enter') {
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

      // DOM capture pointerdown/mousedown listeners: intercepts clicks on alignment gaps before Monaco's pointer dispatch
      // Completely eliminates Monaco's cursor snap and prevents any jerk/jump to line 1 or 2
      const onOrigDomPointer = (e: any) => {
        const target = (e.target instanceof HTMLElement ? e.target : e.target?.element) as HTMLElement | null;
        if (isGapEventTarget(target)) {
          e.preventDefault?.();
          e.stopPropagation?.();
          e.stopImmediatePropagation?.();
          handleDiffGapClick(origEditor, 'left', e, chunksRef.current);
        } else if (
          target &&
          !target.classList?.contains('diffx-gap-gutter-arrow') &&
          !target.closest?.('.diffx-gap-gutter-arrow')
        ) {
          clearGapTargetDecorations();
        }
      };

      if (origDom) {
        origDom.addEventListener('pointerdown', onOrigDomPointer, true);
        origDom.addEventListener('mousedown', onOrigDomPointer, true);
      }

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
          if (e.code === 'ArrowUp' || e.browserEvent?.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            const curOffset = activeGapRef.current.rowOffset ?? 0;
            if (curOffset > 0) {
              activeGapRef.current.rowOffset = curOffset - 1;
              const effLine = activeGapRef.current.afterLineNumber + activeGapRef.current.rowOffset + 1;
              activeGapRef.current.effectiveLineNumber = effLine;
              setCursorLineNumber(effLine);
              onUpdateStatus(`Line ${effLine} (Empty Space) : Col 1`);
              updateGapCursorElement(modDom, activeGapRef.current.rowOffset);
            } else {
              const targetLine = Math.max(1, activeGapRef.current.afterLineNumber);
              clearGapTargetDecorations();
              modEditor.setPosition({ lineNumber: targetLine, column: modEditor.getModel()?.getLineMaxColumn(targetLine) || 1 });
              modEditor.focus();
            }
            return;
          } else if (e.code === 'ArrowDown' || e.browserEvent?.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            const curOffset = activeGapRef.current.rowOffset ?? 0;
            const vz = modDom?.querySelector('.diffx-active-gap-target') as HTMLElement | null;
            const vzHeight = vz ? vz.offsetHeight : 22;
            const numRows = Math.max(1, Math.round(vzHeight / 22));
            if (curOffset < numRows - 1) {
              activeGapRef.current.rowOffset = curOffset + 1;
              const effLine = activeGapRef.current.afterLineNumber + activeGapRef.current.rowOffset + 1;
              activeGapRef.current.effectiveLineNumber = effLine;
              setCursorLineNumber(effLine);
              onUpdateStatus(`Line ${effLine} (Empty Space) : Col 1`);
              updateGapCursorElement(modDom, activeGapRef.current.rowOffset);
            } else {
              const targetLine = Math.min(modEditor.getModel()?.getLineCount() || 1, activeGapRef.current.afterLineNumber + 1);
              clearGapTargetDecorations();
              modEditor.setPosition({ lineNumber: targetLine, column: 1 });
              modEditor.focus();
            }
            return;
          } else if (e.code === 'Enter' || e.browserEvent?.key === 'Enter') {
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

      // DOM capture pointerdown/mousedown listeners: intercepts clicks on alignment gaps before Monaco's pointer dispatch
      // Completely eliminates Monaco's cursor snap and prevents any jerk/jump to line 1 or 2
      const onModDomPointer = (e: any) => {
        const target = (e.target instanceof HTMLElement ? e.target : e.target?.element) as HTMLElement | null;
        if (isGapEventTarget(target)) {
          e.preventDefault?.();
          e.stopPropagation?.();
          e.stopImmediatePropagation?.();
          handleDiffGapClick(modEditor, 'right', e, chunksRef.current);
        } else if (
          target &&
          !target.classList?.contains('diffx-gap-gutter-arrow') &&
          !target.closest?.('.diffx-gap-gutter-arrow')
        ) {
          clearGapTargetDecorations();
        }
      };

      if (modDom) {
        modDom.addEventListener('pointerdown', onModDomPointer, true);
        modDom.addEventListener('mousedown', onModDomPointer, true);
      }

      // Unsuppress Monaco's view zones so Monaco doesn't force mouse-down suppression
      const unsuppressViewZones = (editor: any) => {
        try {
          const vzPart = editor._view?.viewZones || editor._viewZones;
          if (vzPart && vzPart._zones) {
            for (const k of Object.keys(vzPart._zones)) {
              const z = vzPart._zones[k];
              if (z?.delegate) {
                z.delegate.suppressMouseDown = false;
              }
            }
          }
        } catch {
          // ignore
        }
      };
      origEditor.onDidChangeViewZones(() => unsuppressViewZones(origEditor));
      modEditor.onDidChangeViewZones(() => unsuppressViewZones(modEditor));

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
          activeSelectionRef.current = newSel;
          setActiveSelection(newSel);
          updateGutterDecorations(canonicalChunksRef.current.length ? canonicalChunksRef.current : diffChunks, newSel);
        } else {
          activeSelectionRef.current = null;
          setActiveSelection(null);
          updateGutterDecorations(canonicalChunksRef.current.length ? canonicalChunksRef.current : diffChunks, null);
        }
      });

      // Click on Left Editor Gutter Glyph Arrow (⇨) or diff gap
      origEditor.onMouseDown((e: any) => {
        setActiveFocusSide('left');

        // Check if click is in a diff alignment gap / view zone to place cursor cleanly
        const handledGap = handleDiffGapClick(origEditor, 'left', e, chunksRef.current);
        if (handledGap) return;
        clearGapTargetDecorations();

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

        const directChunk = findChunkAtLine(chunksRef.current, line, 'left');
        const sel = activeSelectionRef.current || activeSelection;
        const isSelectionClick = Boolean(
          sel &&
          sel.side === 'left' &&
          line >= sel.startLine &&
          line <= sel.endLine
        );

        if (directChunk || isSelectionClick) {
          if (directChunk) setActiveDiffChunk(directChunk);
          if (isGlyphArrowClick) {
            clearGapTargetDecorations();
            const srcLine = isSelectionClick && sel ? sel.startLine : (directChunk?.originalStart || line);
            const srcText = origEditor.getModel()?.getLineContent(srcLine) || '';
            triggerShiftAnimation('left-to-right', srcLine, srcText);
            const outRange: ChunkCopyRange = { startLine: 0, endLine: 0 };
            if (isSelectionClick && sel) {
              const selChunk = findChunkAtLine(chunksRef.current, sel.startLine, 'left');
              const isOverlapping = selChunk && (
                (selChunk.originalStart <= sel.endLine && selChunk.originalEnd >= sel.startLine) ||
                (selChunk.originalEnd === 0 && selChunk.originalStart >= sel.startLine && selChunk.originalStart <= sel.endLine)
              );
              const validChunk = isOverlapping ? selChunk : null;
              collapseEditorGapViewZones(
                modEditor,
                validChunk ? validChunk.modifiedStart : mapLineNumber(chunksRef.current, sel.startLine, 'left')
              );
              executeSelectedLinesCopyL2R(origEditor.getModel(), modEditor.getModel(), sel, validChunk, outRange, modEditor, chunksRef.current);
              rightContentRef.current = modEditor.getValue();
              setRightDirty(true);
              setLastModifiedSide('right');
              setActiveFocusSide('right');
              flashCopiedHighlight('left', sel.startLine, sel.endLine, false);
              if (outRange.startLine > 0) {
                flashCopiedHighlight('right', outRange.startLine, outRange.endLine, false);
              }
              onUpdateStatus(`Copied selected lines ${sel.startLine}–${sel.endLine} Left ⇨ Right`);
              setActiveSelection(null);
              activeSelectionRef.current = null;
              updateGutterDecorations(canonicalChunksRef.current.length ? canonicalChunksRef.current : diffChunks, null);
            } else if (directChunk) {
              collapseEditorGapViewZones(modEditor, directChunk.modifiedStart);
              executeChunkCopyL2R(origEditor.getModel(), modEditor.getModel(), directChunk, outRange, modEditor);
              rightContentRef.current = modEditor.getValue();
              setRightDirty(true);
              setLastModifiedSide('right');
              setActiveFocusSide('right');
              flashCopiedHighlight('left', directChunk.originalStart, directChunk.originalEnd || directChunk.originalStart, false);
              if (outRange.startLine > 0) {
                flashCopiedHighlight('right', outRange.startLine, outRange.endLine, false);
              }
              onUpdateStatus(`Copied diff lines ${directChunk.originalStart}–${directChunk.originalEnd || directChunk.originalStart} Left ⇨ Right`);
            }
          }
        }
      });

      // Click on Right Editor Gutter Glyph Arrow (⇦) or diff gap
      modEditor.onMouseDown((e: any) => {
        setActiveFocusSide('right');

        // Check if click is in a diff alignment gap / view zone to place cursor cleanly
        const handledGap = handleDiffGapClick(modEditor, 'right', e, chunksRef.current);
        if (handledGap) return;
        clearGapTargetDecorations();

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

        const directChunk = findChunkAtLine(chunksRef.current, line, 'right');
        const sel = activeSelectionRef.current || activeSelection;
        const isSelectionClick = Boolean(
          sel &&
          sel.side === 'right' &&
          line >= sel.startLine &&
          line <= sel.endLine
        );

        if (directChunk || isSelectionClick) {
          if (directChunk) setActiveDiffChunk(directChunk);
          if (isGlyphArrowClick) {
            clearGapTargetDecorations();
            const srcLine = isSelectionClick && sel ? sel.startLine : (directChunk?.modifiedStart || line);
            const srcText = modEditor.getModel()?.getLineContent(srcLine) || '';
            triggerShiftAnimation('right-to-left', srcLine, srcText);
            const outRange: ChunkCopyRange = { startLine: 0, endLine: 0 };
            if (isSelectionClick && sel) {
              const selChunk = findChunkAtLine(chunksRef.current, sel.startLine, 'right');
              const isOverlapping = selChunk && (
                (selChunk.modifiedStart <= sel.endLine && selChunk.modifiedEnd >= sel.startLine) ||
                (selChunk.modifiedEnd === 0 && selChunk.modifiedStart >= sel.startLine && selChunk.modifiedStart <= sel.endLine)
              );
              const validChunk = isOverlapping ? selChunk : null;
              collapseEditorGapViewZones(
                origEditor,
                validChunk ? validChunk.originalStart : mapLineNumber(chunksRef.current, sel.startLine, 'right')
              );
              executeSelectedLinesCopyR2L(origEditor.getModel(), modEditor.getModel(), sel, validChunk, outRange, origEditor, chunksRef.current);
              leftContentRef.current = origEditor.getValue();
              setLeftDirty(true);
              setLastModifiedSide('left');
              setActiveFocusSide('left');
              flashCopiedHighlight('right', sel.startLine, sel.endLine, false);
              if (outRange.startLine > 0) {
                flashCopiedHighlight('left', outRange.startLine, outRange.endLine, false);
              }
              onUpdateStatus(`Copied selected lines ${sel.startLine}–${sel.endLine} Right ⇦ Left`);
              setActiveSelection(null);
              activeSelectionRef.current = null;
              updateGutterDecorations(canonicalChunksRef.current.length ? canonicalChunksRef.current : diffChunks, null);
            } else if (directChunk) {
              collapseEditorGapViewZones(origEditor, directChunk.originalStart);
              executeChunkCopyR2L(origEditor.getModel(), modEditor.getModel(), directChunk, outRange, origEditor);
              leftContentRef.current = origEditor.getValue();
              setLeftDirty(true);
              setLastModifiedSide('left');
              setActiveFocusSide('left');
              flashCopiedHighlight('right', directChunk.modifiedStart, directChunk.modifiedEnd || directChunk.modifiedStart, false);
              if (outRange.startLine > 0) {
                flashCopiedHighlight('left', outRange.startLine, outRange.endLine, false);
              }
              onUpdateStatus(`Copied diff lines ${directChunk.modifiedStart}–${directChunk.modifiedEnd || directChunk.modifiedStart} Right ⇦ Left`);
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

      // Initial line details
      updateLineDetails(1);
      setTimeout(updateGutterDecorations, 100);
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

  // Copy Active Chunk or Selection from Left to Right (⇨)
  const handleCopyL2R = (targetChunk?: DiffChunk) => {
    if (!diffEditorRef.current) return;
    const origEditor = diffEditorRef.current.getOriginalEditor();
    const modEditor = diffEditorRef.current.getModifiedEditor();
    const origModel = origEditor.getModel();
    const modModel = modEditor.getModel();
    if (!origModel || !modModel) return;

    const outRange: ChunkCopyRange = { startLine: 0, endLine: 0 };
    const sel = activeSelectionRef.current || activeSelection;

    if (!targetChunk && sel && sel.side === 'left') {
      clearGapTargetDecorations();
      const srcText = origModel.getLineContent(sel.startLine);
      triggerShiftAnimation('left-to-right', sel.startLine, srcText);
      const selChunk = findChunkAtLine(chunksRef.current, sel.startLine, 'left');
      const isOverlapping = selChunk && (
        (selChunk.originalStart <= sel.endLine && selChunk.originalEnd >= sel.startLine) ||
        (selChunk.originalEnd === 0 && selChunk.originalStart >= sel.startLine && selChunk.originalStart <= sel.endLine)
      );
      const validChunk = isOverlapping ? selChunk : null;
      collapseEditorGapViewZones(
        modEditor,
        validChunk ? validChunk.modifiedStart : mapLineNumber(chunksRef.current, sel.startLine, 'left')
      );
      executeSelectedLinesCopyL2R(origModel, modModel, sel, validChunk, outRange, modEditor, chunksRef.current);
      rightContentRef.current = modModel.getValue();
      setRightDirty(true);
      setLastModifiedSide('right');
      setActiveFocusSide('right');
      flashCopiedHighlight('left', sel.startLine, sel.endLine, false);
      if (outRange.startLine > 0) {
        flashCopiedHighlight('right', outRange.startLine, outRange.endLine, false);
      }
      onUpdateStatus(`Copied selected lines ${sel.startLine}–${sel.endLine} Left ⇨ Right`);
      setActiveSelection(null);
      activeSelectionRef.current = null;
      updateGutterDecorations(canonicalChunksRef.current.length ? canonicalChunksRef.current : diffChunks, null);
      return;
    }

    let chunk = targetChunk || activeGapRef.current?.chunk || activeDiffChunk;
    if (!chunk && activeGapRef.current) {
      chunk = activeGapRef.current.chunk || findChunkAtGap(chunksRef.current, activeGapRef.current.afterLineNumber, activeGapRef.current.side);
    }
    if (!chunk) {
      const activeLine = cursorLineNumber || origEditor.getPosition()?.lineNumber || 1;
      chunk = findChunkAtLine(chunksRef.current, activeLine, 'left') || findClosestChunk(chunksRef.current, activeLine, 'left', 2);
    }

    if (chunk) {
      const srcLine = chunk.originalStart > 0 && chunk.originalEnd >= chunk.originalStart ? chunk.originalStart : 1;
      const srcText = chunk.originalStart > 0 && chunk.originalEnd >= chunk.originalStart ? origModel.getLineContent(srcLine) : '';
      triggerShiftAnimation('left-to-right', srcLine, srcText);

      collapseEditorGapViewZones(modEditor, chunk.modifiedStart);
      clearGapTargetDecorations();
      executeChunkCopyL2R(origModel, modModel, chunk, outRange, modEditor);
      rightContentRef.current = modModel.getValue();
      setRightDirty(true);
      setLastModifiedSide('right');
      setActiveFocusSide('right');
      if (chunk.originalStart > 0 && chunk.originalEnd >= chunk.originalStart) {
        flashCopiedHighlight('left', chunk.originalStart, chunk.originalEnd, false);
      }
      if (outRange.startLine > 0) {
        flashCopiedHighlight('right', outRange.startLine, outRange.endLine, false);
      }
      const isGapDelete = chunk.originalEnd === 0 && chunk.modifiedStart > 0;
      onUpdateStatus(isGapDelete ? `Copied empty space Left ⇨ Right (deleted line(s) on Right)` : `Copied diff chunk Left ⇨ Right`);
    }
  };

  // Copy Active Chunk or Selection from Right to Left (⇦)
  const handleCopyR2L = (targetChunk?: DiffChunk) => {
    if (!diffEditorRef.current) return;
    const origEditor = diffEditorRef.current.getOriginalEditor();
    const modEditor = diffEditorRef.current.getModifiedEditor();
    const origModel = origEditor.getModel();
    const modModel = modEditor.getModel();
    if (!origModel || !modModel) return;

    const outRange: ChunkCopyRange = { startLine: 0, endLine: 0 };
    const sel = activeSelectionRef.current || activeSelection;

    if (!targetChunk && sel && sel.side === 'right') {
      clearGapTargetDecorations();
      const srcText = modModel.getLineContent(sel.startLine);
      triggerShiftAnimation('right-to-left', sel.startLine, srcText);
      const selChunk = findChunkAtLine(chunksRef.current, sel.startLine, 'right');
      const isOverlapping = selChunk && (
        (selChunk.modifiedStart <= sel.endLine && selChunk.modifiedEnd >= sel.startLine) ||
        (selChunk.modifiedEnd === 0 && selChunk.modifiedStart >= sel.startLine && selChunk.modifiedStart <= sel.endLine)
      );
      const validChunk = isOverlapping ? selChunk : null;
      collapseEditorGapViewZones(
        origEditor,
        validChunk ? validChunk.originalStart : mapLineNumber(chunksRef.current, sel.startLine, 'right')
      );
      executeSelectedLinesCopyR2L(origModel, modModel, sel, validChunk, outRange, origEditor, chunksRef.current);
      leftContentRef.current = origModel.getValue();
      setLeftDirty(true);
      setLastModifiedSide('left');
      setActiveFocusSide('left');
      flashCopiedHighlight('right', sel.startLine, sel.endLine, false);
      if (outRange.startLine > 0) {
        flashCopiedHighlight('left', outRange.startLine, outRange.endLine, false);
      }
      onUpdateStatus(`Copied selected lines ${sel.startLine}–${sel.endLine} Right ⇦ Left`);
      setActiveSelection(null);
      activeSelectionRef.current = null;
      updateGutterDecorations(canonicalChunksRef.current.length ? canonicalChunksRef.current : diffChunks, null);
      return;
    }

    let chunk = targetChunk || activeGapRef.current?.chunk || activeDiffChunk;
    if (!chunk && activeGapRef.current) {
      chunk = activeGapRef.current.chunk || findChunkAtGap(chunksRef.current, activeGapRef.current.afterLineNumber, activeGapRef.current.side);
    }
    if (!chunk) {
      const activeLine = cursorLineNumber || modEditor.getPosition()?.lineNumber || 1;
      chunk = findChunkAtLine(chunksRef.current, activeLine, 'right') || findClosestChunk(chunksRef.current, activeLine, 'right', 2);
    }

    if (chunk) {
      const srcLine = chunk.modifiedStart > 0 && chunk.modifiedEnd >= chunk.modifiedStart ? chunk.modifiedStart : 1;
      const srcText = chunk.modifiedStart > 0 && chunk.modifiedEnd >= chunk.modifiedStart ? modModel.getLineContent(srcLine) : '';
      triggerShiftAnimation('right-to-left', srcLine, srcText);

      collapseEditorGapViewZones(origEditor, chunk.originalStart);
      clearGapTargetDecorations();
      executeChunkCopyR2L(origModel, modModel, chunk, outRange, origEditor);
      leftContentRef.current = origModel.getValue();
      setLeftDirty(true);
      setLastModifiedSide('left');
      setActiveFocusSide('left');
      if (chunk.modifiedStart > 0 && chunk.modifiedEnd >= chunk.modifiedStart) {
        flashCopiedHighlight('right', chunk.modifiedStart, chunk.modifiedEnd, false);
      }
      if (outRange.startLine > 0) {
        flashCopiedHighlight('left', outRange.startLine, outRange.endLine, false);
      }
      const isGapDelete = chunk.modifiedEnd === 0 && chunk.originalStart > 0;
      onUpdateStatus(isGapDelete ? `Copied empty space Right ⇦ Left (deleted line(s) on Left)` : `Copied diff chunk Right ⇦ Left`);
    }
  };

  // Single active line copy L -> R (respects alignment gaps)
  const handleCopyActiveLineL2R = () => {
    if (!diffEditorRef.current) return;
    const modEditor = diffEditorRef.current.getModifiedEditor();
    const origEditor = diffEditorRef.current.getOriginalEditor();
    const modModel = modEditor.getModel();
    const origModel = origEditor.getModel();
    if (!modModel || !origModel) return;

    if (activeGapRef.current) {
      handleCopyL2R();
      return;
    }

    if (cursorLineNumber === null) return;

    const chunk = findChunkAtLine(chunksRef.current, cursorLineNumber, 'left');
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
    const rightLineNum = mapLineNumber(chunksRef.current, cursorLineNumber, 'left');
    const clampedRightLineNum = Math.min(rightLineNum, modModel.getLineCount());
    const range = {
      startLineNumber: clampedRightLineNum,
      startColumn: 1,
      endLineNumber: clampedRightLineNum,
      endColumn: modModel.getLineMaxColumn(clampedRightLineNum),
    };
    modModel.pushEditOperations([], [{ range, text: leftLine }], () => null);
    rightContentRef.current = modModel.getValue();
    setRightDirty(true);
    flashCopiedHighlight('left', cursorLineNumber, cursorLineNumber, false);
    flashCopiedHighlight('right', clampedRightLineNum, clampedRightLineNum, false);
    onUpdateStatus(`Copied line ${cursorLineNumber} Left ⇨ Right`);
  };

  // Single active line copy R -> L (respects alignment gaps)
  const handleCopyActiveLineR2L = () => {
    if (!diffEditorRef.current) return;
    const modEditor = diffEditorRef.current.getModifiedEditor();
    const origEditor = diffEditorRef.current.getOriginalEditor();
    const modModel = modEditor.getModel();
    const origModel = origEditor.getModel();
    if (!modModel || !origModel) return;

    if (activeGapRef.current) {
      handleCopyR2L();
      return;
    }

    if (cursorLineNumber === null) return;

    const chunk = findChunkAtLine(chunksRef.current, cursorLineNumber, 'right');
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
    const leftLineNum = mapLineNumber(chunksRef.current, cursorLineNumber, 'right');
    const clampedLeftLineNum = Math.min(leftLineNum, origModel.getLineCount());
    const range = {
      startLineNumber: clampedLeftLineNum,
      startColumn: 1,
      endLineNumber: clampedLeftLineNum,
      endColumn: origModel.getLineMaxColumn(clampedLeftLineNum),
    };
    origModel.pushEditOperations([], [{ range, text: rightLine }], () => null);
    leftContentRef.current = origModel.getValue();
    setLeftDirty(true);
    flashCopiedHighlight('right', cursorLineNumber, cursorLineNumber, false);
    flashCopiedHighlight('left', clampedLeftLineNum, clampedLeftLineNum, false);
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
        setDiffError(`Save failed: ${res.error}`);
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
        setDiffError(`Save failed: ${res.error}`);
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

  const language = detectLanguage(leftPath || rightPath);
  const leftMeta = formatFileMetadata(leftData, leftPath);
  const rightMeta = formatFileMetadata(rightData, rightPath);

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-black overflow-hidden text-neutral-900 dark:text-neutral-100 font-sans select-none">
      {/* ================= 1. Beyond Compare Action Toolbar ================= */}
      <div className="bg-[#f0f0f0] dark:bg-[#0a0a0a] border-b border-[#c8c8c8] dark:border-neutral-800 px-2 py-1 flex items-center justify-between text-xs flex-shrink-0 select-none shadow-xs">
        {/* Left Toolbar Items: Home, Jumpers, Filter Trio (*, ≠, =) */}
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

          {/* Jumpers: Next & Prev Difference */}
          <button
            onClick={handlePrevDiff}
            data-action="prev-diff"
            title="Previous Difference (Shift+F7 / Alt+Up)"
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition text-[11px] shadow-xs"
          >
            <ArrowUp className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            <span>Prev</span>
          </button>
          <button
            onClick={handleNextDiff}
            data-action="next-diff"
            title="Next Difference (F7 / Alt+Down)"
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition text-[11px] shadow-xs"
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

        {/* Right Toolbar Items: Revert */}
        <div className="flex items-center space-x-2">
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
            placeholder="Left file path (or drag & drop file here)..."
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

        {/* Swap Sides Button */}
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
            placeholder="Right file path (or drag & drop file here)..."
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
              <span className="italic text-neutral-400">No file loaded on Left</span>
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
              <span className="italic text-neutral-400">No file loaded on Right</span>
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
          {/* UI/UX Pro Max: Floating Selection Action Box (Single unified pill) */}
          {activeSelection && (
            <div
              className="diffx-selection-action-box absolute z-30 top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3.5 py-1.5 rounded-full shadow-2xl border border-blue-500/40 bg-neutral-900/95 text-white backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150"
            >
              <span className="text-[11px] font-medium text-neutral-300">
                Selected <span className="text-white font-semibold">{activeSelection.endLine - activeSelection.startLine + 1}</span> {activeSelection.endLine - activeSelection.startLine + 1 === 1 ? 'line' : 'lines'} on {activeSelection.side === 'left' ? 'Left' : 'Right'}
              </span>
              <div className="h-3 w-px bg-neutral-700" />
              <button
                onClick={() => {
                  if (activeSelection.side === 'left') {
                    handleCopyL2R();
                  } else {
                    handleCopyR2L();
                  }
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-600 hover:bg-blue-500 active:scale-95 text-white transition shadow-sm cursor-pointer"
                title={activeSelection.side === 'left' ? "Copy selected lines to Right (⇨)" : "Copy selected lines to Left (⇦)"}
              >
                <span>{activeSelection.side === 'left' ? 'Copy to Right' : 'Copy to Left'}</span>
                <span className="text-sm font-bold">{activeSelection.side === 'left' ? '⇨' : '⇦'}</span>
              </button>
              <button
                onClick={() => {
                  setActiveSelection(null);
                  activeSelectionRef.current = null;
                  if (diffEditorRef.current) {
                    updateGutterDecorations(canonicalChunksRef.current, null);
                  }
                }}
                className="p-1 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
                title="Clear selection"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Beyond Compare Floating Gap Action Box when cursor is on an Empty Space */}
          {!activeSelection && activeGapState && (
            <div
              className="diffx-gap-action-box absolute z-30 top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3.5 py-1.5 rounded-full shadow-2xl border border-yellow-500/50 bg-neutral-900/95 text-white backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150"
            >
              <span className="text-[11px] font-medium text-yellow-300">
                Empty Space on <span className="text-white font-semibold">{activeGapState.side === 'left' ? 'Left' : 'Right'}</span> (Line {activeGapState.effectiveLineNumber || activeGapState.afterLineNumber + 1})
              </span>
              <div className="h-3 w-px bg-neutral-700" />
              <button
                onClick={() => {
                  if (activeGapState.side === 'left') {
                    handleCopyL2R();
                  } else {
                    handleCopyR2L();
                  }
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-600 hover:bg-yellow-500 active:scale-95 text-white transition shadow-sm cursor-pointer"
                title={activeGapState.side === 'left' ? "Copy empty space Left ⇨ Right (delete right line)" : "Copy empty space Right ⇦ Left (delete left line)"}
              >
                <span>{activeGapState.side === 'left' ? 'Copy Empty Space to Right' : 'Copy Empty Space to Left'}</span>
                <span className="text-sm font-bold">{activeGapState.side === 'left' ? '⇨' : '⇦'}</span>
              </button>
              <button
                onClick={() => {
                  clearGapTargetDecorations();
                }}
                className="p-1 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

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
                <FileCode className="w-10 h-10 mb-2 stroke-[1.2] text-blue-500" />
                <h4 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                  Left File
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-3 max-w-[220px]">
                  Drag & drop text or code file here or browse
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
                <FileCode className="w-10 h-10 mb-2 stroke-[1.2] text-purple-500" />
                <h4 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                  Right File
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-3 max-w-[220px]">
                  Drag & drop text or code file here or browse
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
              language={language}
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
                ignoreTrimWhitespace: options.ignoreWhitespace !== 'none',
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
                smoothScrolling: false,
                cursorSmoothCaretAnimation: 'off',
                cursorBlinking: 'blink',
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
                diffAlgorithm: 'advanced',
                experimental: { showMoves: false },
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
                <FileCode className="w-12 h-12 mb-2 text-blue-400 animate-bounce" />
                <span className="font-bold text-sm text-white drop-shadow-md">
                  Drop to Open as Left File
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
                <FileCode className="w-12 h-12 mb-2 text-purple-400 animate-bounce" />
                <span className="font-bold text-sm text-white drop-shadow-md">
                  Drop to Open as Right File
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
    </div>
  );
};
