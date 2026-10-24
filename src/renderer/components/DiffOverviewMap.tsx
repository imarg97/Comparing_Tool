import React, { useRef } from 'react';
import { DiffChunk } from '@shared/comparison-engine/diff-copy.js';

interface DiffOverviewMapProps {
  chunks: DiffChunk[];
  totalLines: number;
  currentLine?: number;
  onScrollToLine: (line: number) => void;
  onScrollToChunk?: (chunk: DiffChunk) => void;
  theme?: 'dark' | 'light';
}

export const DiffOverviewMap: React.FC<DiffOverviewMapProps> = ({
  chunks,
  totalLines,
  currentLine = 1,
  onScrollToLine,
  onScrollToChunk,
  theme: _theme = 'light',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const safeTotalLines = Math.max(totalLines, 30);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickY = e.clientY - rect.top;

    // Check if clicked near an existing chunk (within 20px)
    let bestChunk: DiffChunk | null = null;
    let minDistance = Infinity;

    for (const chunk of chunks) {
      const start = chunk.originalStart > 0 ? chunk.originalStart : chunk.modifiedStart;
      const chunkFraction = (start - 1) / safeTotalLines;
      const chunkY = chunkFraction * rect.height;
      const dist = Math.abs(clickY - chunkY);
      if (dist < minDistance) {
        minDistance = dist;
        bestChunk = chunk;
      }
    }

    if (bestChunk && minDistance <= 20) {
      if (onScrollToChunk) {
        onScrollToChunk(bestChunk);
        return;
      }
      const line = bestChunk.originalStart > 0 ? bestChunk.originalStart : bestChunk.modifiedStart;
      onScrollToLine(line);
      return;
    }

    const fraction = Math.max(0, Math.min(1, clickY / rect.height));
    const targetLine = Math.max(1, Math.round(fraction * safeTotalLines));
    onScrollToLine(targetLine);
  };

  // Viewport thumb approximation (approx 35 visible lines)
  const thumbHeightPercent = Math.max(4, (35 / safeTotalLines) * 100);
  const thumbTopPercent = Math.max(0, Math.min(100 - thumbHeightPercent, ((currentLine - 1) / safeTotalLines) * 100));

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      title="Comparison Overview Map • Red/Amber = Differences, Blue = Alignment Gaps, Blue Box = Viewport"
      className="w-5 h-full bg-[#f8f8f8] dark:bg-[#13141d] border-r border-[#d4d4d4] dark:border-[#262638] flex-shrink-0 relative select-none cursor-pointer overflow-hidden"
    >
      {/* Subtle guide line */}
      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-neutral-200/60 dark:bg-[#262638] pointer-events-none" />

      {/* Difference markers (Beyond Compare exact visual fidelity) */}
      {chunks.map((chunk) => {
        const isLeftOnly = chunk.originalStart > 0 && chunk.modifiedStart === 0;
        const isRightOnly = chunk.modifiedStart > 0 && chunk.originalStart === 0;
        const isAlignmentGap = isLeftOnly || isRightOnly || chunk.originalEnd === 0 || chunk.modifiedEnd === 0;

        const start = chunk.originalStart > 0 ? chunk.originalStart : chunk.modifiedStart;
        const end = chunk.originalEnd > 0 ? chunk.originalEnd : (chunk.modifiedEnd > 0 ? chunk.modifiedEnd : start);
        const count = Math.max(1, end - start + 1);

        const top = Math.max(0, Math.min(99.5, ((start - 1) / safeTotalLines) * 100));

        // Single difference = crisp thin line; Cluster = solid filled block
        const isSingleLine = count === 1;
        const heightPercent = isSingleLine
          ? Math.max(1.2, (1 / safeTotalLines) * 100)
          : Math.max(2.5, (count / safeTotalLines) * 100);

        return (
          <div
            key={chunk.id}
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
              height: isSingleLine ? '2px' : `${heightPercent}%`,
              minHeight: isSingleLine ? '2px' : '6px',
            }}
            className={`absolute left-0.5 right-0.5 ${
              isAlignmentGap
                ? 'bg-[#2563eb] hover:bg-[#1d4ed8] dark:bg-[#3b82f6]' // Blue line for alignment gap
                : isRightOnly
                ? 'bg-[#d97706] hover:bg-[#b45309] dark:bg-[#f59e0b]' // Amber on right side insertions
                : 'bg-[#dc2626] hover:bg-[#b91c1c] dark:bg-[#ef4444]' // Red tick or solid bar for text diff
            } cursor-pointer transition-colors shadow-2xs z-10`}
            title={
              isAlignmentGap
                ? `Alignment Gap: lines ${start}–${end} (Click to jump)`
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
