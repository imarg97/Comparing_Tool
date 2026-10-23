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
  Copy,
  Check,
} from 'lucide-react';
import { FileContentResult, TextCompareOptions } from '@shared/types.js';
import { compareTextContent } from '@shared/comparison-engine/whitespace.js';
import {
  DiffChunk,
  normalizeLineChanges,
  findChunkAtLine,
  executeChunkCopyL2R,
  executeChunkCopyR2L,
} from '@shared/comparison-engine/diff-copy.js';
import { ConfirmModalConfig } from '../../components/ConfirmModal.js';
import { LineDetailInspector } from '../../components/LineDetailInspector.js';
import { DiffOverviewMap } from '../../components/DiffOverviewMap.js';

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

  // Drag and drop states
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);

  const extractDroppedPath = (e: React.DragEvent): string | null => {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      return (file as any).path || file.name || null;
    }
    return null;
  };

  const handleDropLeft = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingLeft(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length >= 2) {
      const p1 = (e.dataTransfer.files[0] as any).path || e.dataTransfer.files[0].name;
      const p2 = (e.dataTransfer.files[1] as any).path || e.dataTransfer.files[1].name;
      if (p1) onSetLeftPath(p1);
      if (p2) onSetRightPath(p2);
      return;
    }

    const p = extractDroppedPath(e);
    if (p) onSetLeftPath(p);
  };

  const handleDropRight = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingRight(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length >= 2) {
      const p1 = (e.dataTransfer.files[0] as any).path || e.dataTransfer.files[0].name;
      const p2 = (e.dataTransfer.files[1] as any).path || e.dataTransfer.files[1].name;
      if (p1) onSetLeftPath(p1);
      if (p2) onSetRightPath(p2);
      return;
    }

    const p = extractDroppedPath(e);
    if (p) onSetRightPath(p);
  };

  // Monaco references
  const diffEditorRef = useRef<any>(null);
  const leftDecorationsRef = useRef<string[]>([]);
  const rightDecorationsRef = useRef<string[]>([]);
  const chunksRef = useRef<DiffChunk[]>([]);
  chunksRef.current = diffChunks;

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

      // Check if this line is part of a diff chunk
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
      // Disable sticky scroll and enable glyph margin for natural Beyond Compare scrolling
      const origEditor = editor.getOriginalEditor();
      const modEditor = editor.getModifiedEditor();

      origEditor.updateOptions({ stickyScroll: { enabled: false }, glyphMargin: true });
      modEditor.updateOptions({ stickyScroll: { enabled: false }, glyphMargin: true });

      editor.onDidUpdateDiff(() => {
        const lineChanges = editor.getLineChanges();
        setDiffStats((prev) => ({
          ...prev,
          diffCount: lineChanges ? lineChanges.length : 0,
        }));
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

      // Click on Left Editor Gutter / Line Numbers
      origEditor.onMouseDown((e: any) => {
        const line = e.target?.position?.lineNumber;
        if (!line) return;

        // If clicked on gutter glyph arrow
        if (e.target?.type === 2 /* GUTTER_GLYPH_MARGIN */) {
          const chunk = findChunkAtLine(chunksRef.current, line, 'left');
          if (chunk) {
            executeChunkCopyL2R(origEditor.getModel(), modEditor.getModel(), chunk);
            setRightEditorContent(modEditor.getValue());
            setRightDirty(true);
            setCopiedNotification(`Copied chunk lines ${chunk.originalStart}–${chunk.originalEnd} Left ⇨ Right`);
            setTimeout(() => setCopiedNotification(null), 2500);
            onUpdateStatus(`Copied diff paragraph (lines ${chunk.originalStart}–${chunk.originalEnd}) Left ⇨ Right`);
          }
        } else {
          const chunk = findChunkAtLine(chunksRef.current, line, 'left');
          setActiveDiffChunk(chunk);
        }
      });

      // Click on Right Editor Gutter / Line Numbers
      modEditor.onMouseDown((e: any) => {
        const line = e.target?.position?.lineNumber;
        if (!line) return;

        if (e.target?.type === 2 /* GUTTER_GLYPH_MARGIN */) {
          const chunk = findChunkAtLine(chunksRef.current, line, 'right');
          if (chunk) {
            executeChunkCopyR2L(origEditor.getModel(), modEditor.getModel(), chunk);
            setLeftEditorContent(origEditor.getValue());
            setLeftDirty(true);
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
  const handleCopyL2R = () => {
    if (!diffEditorRef.current) return;
    const origEditor = diffEditorRef.current.getOriginalEditor();
    const modEditor = diffEditorRef.current.getModifiedEditor();
    const origModel = origEditor.getModel();
    const modModel = modEditor.getModel();
    if (!origModel || !modModel) return;

    // If active user line selection exists on left
    if (activeSelection && activeSelection.side === 'left') {
      const text = activeSelection.text;
      const chunk = findChunkAtLine(chunksRef.current, activeSelection.startLine, 'left');
      if (chunk) {
        executeChunkCopyL2R(origModel, modModel, chunk);
      } else {
        const targetLine = Math.min(activeSelection.startLine, modModel.getLineCount());
        const range = {
          startLineNumber: targetLine,
          startColumn: 1,
          endLineNumber: Math.min(activeSelection.endLine, modModel.getLineCount()),
          endColumn: modModel.getLineMaxColumn(Math.min(activeSelection.endLine, modModel.getLineCount())),
        };
        modModel.pushEditOperations([], [{ range, text }], () => null);
      }
      setRightEditorContent(modModel.getValue());
      setRightDirty(true);
      setCopiedNotification(`Copied lines ${activeSelection.startLine}–${activeSelection.endLine} Left ⇨ Right`);
      setTimeout(() => setCopiedNotification(null), 2500);
      onUpdateStatus(`Copied lines ${activeSelection.startLine}–${activeSelection.endLine} Left ⇨ Right`);
      return;
    }

    // If active diff chunk exists
    const chunk = activeDiffChunk || (chunksRef.current.length > 0 ? chunksRef.current[0] : null);
    if (chunk) {
      executeChunkCopyL2R(origModel, modModel, chunk);
      setRightEditorContent(modModel.getValue());
      setRightDirty(true);
      setCopiedNotification(`Copied diff paragraph (lines ${chunk.originalStart}–${chunk.originalEnd}) Left ⇨ Right`);
      setTimeout(() => setCopiedNotification(null), 2500);
      onUpdateStatus(`Copied diff paragraph (lines ${chunk.originalStart}–${chunk.originalEnd}) Left ⇨ Right`);
    }
  };

  // Copy Active Chunk or Selection from Right to Left (⇦)
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
      if (chunk) {
        executeChunkCopyR2L(origModel, modModel, chunk);
      } else {
        const targetLine = Math.min(activeSelection.startLine, origModel.getLineCount());
        const range = {
          startLineNumber: targetLine,
          startColumn: 1,
          endLineNumber: Math.min(activeSelection.endLine, origModel.getLineCount()),
          endColumn: origModel.getLineMaxColumn(Math.min(activeSelection.endLine, origModel.getLineCount())),
        };
        origModel.pushEditOperations([], [{ range, text }], () => null);
      }
      setLeftEditorContent(origModel.getValue());
      setLeftDirty(true);
      setCopiedNotification(`Copied lines ${activeSelection.startLine}–${activeSelection.endLine} Right ⇦ Left`);
      setTimeout(() => setCopiedNotification(null), 2500);
      onUpdateStatus(`Copied lines ${activeSelection.startLine}–${activeSelection.endLine} Right ⇦ Left`);
      return;
    }

    const chunk = activeDiffChunk || (chunksRef.current.length > 0 ? chunksRef.current[0] : null);
    if (chunk) {
      executeChunkCopyR2L(origModel, modModel, chunk);
      setLeftEditorContent(origModel.getValue());
      setLeftDirty(true);
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

          {/* Section & Selection Level Copy Actions (Image 2 & 3) */}
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
              <span className="italic text-neutral-400">No file loaded on Left</span>
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
              <span className="italic text-neutral-400">No file loaded on Right</span>
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

        <div className="flex-1 relative h-full min-w-0 overflow-hidden">
          {!leftPath && !rightPath ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-600 bg-white dark:bg-black p-8 text-center select-none">
              <FileCheck2 className="w-12 h-12 mb-3 stroke-[1.2] text-blue-500" />
              <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                No Files Loaded in Text Compare
              </h4>
              <p className="text-xs max-w-sm text-neutral-500 mb-4">
                Click <strong>Browse</strong> above, drag and drop files here, or double-click any file in Folder Compare to start comparing.
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
                // Crisp light theme (soft, readable, pleasant diff background)
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
                    'diffEditor.insertedTextBackground': '#dcfce7',
                    'diffEditor.removedTextBackground': '#fde8e8',
                    'diffEditor.insertedLineBackground': '#f0fdf4',
                    'diffEditor.removedLineBackground': '#fff0f0',
                    'diffEditor.diagonalFill': '#e5e5e5',
                  },
                });

                // Pitch black theme (dark subtle wine highlight, 100% readable text)
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
                    'diffEditor.insertedTextBackground': '#14532d55',
                    'diffEditor.removedTextBackground': '#7f1d1d44',
                    'diffEditor.insertedLineBackground': '#14532d20',
                    'diffEditor.removedLineBackground': '#7f1d1d20',
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
