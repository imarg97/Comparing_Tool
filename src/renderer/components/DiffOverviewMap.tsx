import React, { useRef } from 'react';
import { DiffChunk } from '@shared/comparison-engine/diff-copy.js';

interface DiffOverviewMapProps {
  chunks: DiffChunk[];
  totalLines: number;
  currentLine?: number;
  visibleStartLine?: number;
  visibleLineCount?: number;
  onScrollToLine: (line: number) => void;
  onScrollToChunk?: (chunk: DiffChunk) => void;
  theme?: 'dark' | 'light';
}

export const DiffOverviewMap: React.FC<DiffOverviewMapProps> = ({
  chunks,
  totalLines,
  currentLine = 1,
  visibleStartLine,
  visibleLineCount,
  onScrollToLine,
  onScrollToChunk,
  theme: _theme = 'light',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const maxChunkLine = chunks.reduce(
    (max, c) => Math.max(max, c.originalEnd || c.originalStart, c.modifiedEnd || c.modifiedStart),
    1
  );
  const safeTotalLines = Math.max(totalLines || 1, maxChunkLine, 30);

  const calculateTargetLine = (clientY: number) => {
    if (!containerRef.current) return { line: 1, chunk: null };
    const rect = containerRef.current.getBoundingClientRect();
    const offsetY = clientY - rect.top;
    const fraction = Math.max(0, Math.min(1, offsetY / Math.max(1, rect.height)));
    const line = Math.max(1, Math.round(fraction * safeTotalLines));

    // Snap to closest diff chunk if click falls within 1.5% height of a diff
    if (chunks.length > 0) {
      const tolerance = Math.max(20, Math.round(safeTotalLines * 0.015));
      let closest: DiffChunk | null = null;
      let minDiff = Infinity;
      for (const c of chunks) {
        const cStart = c.originalStart > 0 ? c.originalStart : c.modifiedStart;
        const d = Math.abs(cStart - line);
        if (d < minDiff && d <= tolerance) {
          minDiff = d;
          closest = c;
        }
      }
      if (closest) {
        return { line, chunk: closest };
      }
    }
    return { line, chunk: null };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    if (e.button !== 0) return; // Only primary button
    isDraggingRef.current = true;
    try {
      containerRef.current.setPointerCapture(e.pointerId);
    } catch {
      // non-fatal
    }
    const target = calculateTargetLine(e.clientY);
    if (target.chunk && onScrollToChunk) {
      onScrollToChunk(target.chunk);
    } else {
      onScrollToLine(target.line);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const target = calculateTargetLine(e.clientY);
    onScrollToLine(target.line);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current && containerRef.current) {
      isDraggingRef.current = false;
      try {
        containerRef.current.releasePointerCapture(e.pointerId);
      } catch {
        // non-fatal
      }
    }
  };

  // Viewport thumb based on actual visible ranges or fallback to currentLine
  const visibleStart = visibleStartLine !== undefined ? visibleStartLine : (currentLine || 1);
  const visibleCount = visibleLineCount !== undefined ? visibleLineCount : 35;
  const thumbHeightPercent = Math.max(3, Math.min(100, (visibleCount / safeTotalLines) * 100));
  const thumbTopPercent = Math.max(0, Math.min(100 - thumbHeightPercent, ((visibleStart - 1) / safeTotalLines) * 100));

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      title="Comparison Overview Map • Drag or click to scroll smoothly, click diff ticks to jump"
      className="w-5 h-full bg-[#f8f8f8] dark:bg-black border-r border-[#d4d4d4] dark:border-neutral-800 flex-shrink-0 relative select-none cursor-pointer overflow-hidden touch-none"
    >
      {/* Subtle guide line */}
      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-neutral-200/60 dark:bg-neutral-800 pointer-events-none" />

      {/* Difference markers (Beyond Compare exact visual fidelity) */}
      {chunks.map((chunk) => {
        const isLeftGap = chunk.originalEnd === 0 || chunk.originalStart === 0;
        const isRightGap = chunk.modifiedEnd === 0 || chunk.modifiedStart === 0;
        const isAlignmentGap = Boolean(chunk.isAlignmentGap || chunk.isWhitespaceOnly || isLeftGap || isRightGap);

        let start = 1;
        let count = 1;

        if (isLeftGap) {
          start = chunk.originalStart > 0 ? chunk.originalStart : 1;
          const modCount = chunk.modifiedEnd >= chunk.modifiedStart && chunk.modifiedStart > 0
            ? chunk.modifiedEnd - chunk.modifiedStart + 1
            : 1;
          count = modCount;
        } else if (isRightGap) {
          start = chunk.originalStart > 0 ? chunk.originalStart : (chunk.modifiedStart > 0 ? chunk.modifiedStart : 1);
          const origCount = chunk.originalEnd >= chunk.originalStart && chunk.originalStart > 0
            ? chunk.originalEnd - chunk.originalStart + 1
            : 1;
          count = origCount;
        } else {
          start = chunk.originalStart > 0 ? chunk.originalStart : chunk.modifiedStart;
          const origCount = chunk.originalEnd >= chunk.originalStart ? chunk.originalEnd - chunk.originalStart + 1 : 1;
          const modCount = chunk.modifiedEnd >= chunk.modifiedStart ? chunk.modifiedEnd - chunk.modifiedStart + 1 : 1;
          count = Math.max(origCount, modCount);
        }

        const end = start + count - 1;
        const top = Math.max(0, Math.min(99.5, ((start - 1) / safeTotalLines) * 100));

        // Single difference = crisp thin line; Cluster = solid filled block
        const isSingleLine = count === 1;
        const heightPercent = isSingleLine
          ? Math.max(1.2, (1 / safeTotalLines) * 100)
          : Math.max(2.5, (count / safeTotalLines) * 100);

        return (
          <div
            key={chunk.id}
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (onScrollToChunk) {
                onScrollToChunk(chunk);
              } else {
                onScrollToLine(start);
              }
            }}
            style={{
              top: `${top}%`,
              height: isSingleLine ? '3px' : `${heightPercent}%`,
              minHeight: isSingleLine ? '3px' : '6px',
            }}
            className={`absolute left-0.5 right-0.5 ${
              isAlignmentGap
                ? 'bg-[#2563eb] hover:bg-[#1d4ed8] dark:bg-[#3b82f6]' // Blue line for indentation / alignment gaps
                : 'bg-[#dc2626] hover:bg-[#b91c1c] dark:bg-[#ef4444]' // Red tick or solid bar for text diff
            } cursor-pointer transition-colors shadow-2xs z-10 before:absolute before:-inset-y-1 before:inset-x-0`}
            title={
              isAlignmentGap
                ? `Indentation / Alignment Gap: lines ${start}–${end} (Click to jump)`
                : isSingleLine
                ? `Difference: line ${start} (Click to jump)`
                : `Diff Cluster: lines ${start}–${end} (${count} lines) (Click to jump)`
            }
          />
        );
      })}

      {/* Viewport thumb indicator (Crisp Blue Rectangular Frame matching Beyond Compare Image 5) */}
      <div
        style={{
          top: `${thumbTopPercent}%`,
          height: `${thumbHeightPercent}%`,
        }}
        className="absolute left-0.5 right-0.5 border-1.5 border-[#2563eb] bg-[#3b82f6]/15 pointer-events-none rounded-[1px] transition-[top] duration-75 z-20"
      />
    </div>
  );
};
