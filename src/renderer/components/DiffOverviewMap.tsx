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
  const safeTotalLines = Math.max(totalLines, 50);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickY = e.clientY - rect.top;

    // Check if clicked near an existing chunk (within 24px)
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

    if (bestChunk && minDistance <= 24) {
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
  const thumbHeightPercent = Math.max(5, (35 / safeTotalLines) * 100);
  const thumbTopPercent = Math.max(0, Math.min(100 - thumbHeightPercent, ((currentLine - 1) / safeTotalLines) * 100));

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      title="Comparison Overview Map • Click marker to jump directly to difference"
      className="w-4 h-full bg-[#f4f4f4] dark:bg-[#121212] border-r border-[#d4d4d4] dark:border-neutral-800 flex-shrink-0 relative select-none cursor-pointer overflow-hidden shadow-inner"
    >
      {/* Background outline hash grid */}
      <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_bottom,#888_1px,transparent_1px)] bg-[size:100%_8px]" />

      {/* Difference markers */}
      {chunks.map((chunk) => {
        const start = chunk.originalStart > 0 ? chunk.originalStart : chunk.modifiedStart;
        const end = chunk.originalEnd > 0 ? chunk.originalEnd : (chunk.modifiedEnd > 0 ? chunk.modifiedEnd : start);
        const count = Math.max(1, end - start + 1);

        const top = Math.max(0, Math.min(99, ((start - 1) / safeTotalLines) * 100));
        const height = Math.max(2.2, (count / safeTotalLines) * 100);

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
              height: `${height}%`,
            }}
            className="absolute left-0.5 right-0.5 bg-red-500 hover:bg-red-400 dark:bg-red-600 dark:hover:bg-red-500 rounded-[1px] shadow-xs cursor-pointer transition-colors"
            title={`Diff: lines ${start}–${end} (Click to jump)`}
          />
        );
      })}

      {/* Viewport thumb indicator (yellow outline matching Beyond Compare Image 3) */}
      <div
        style={{
          top: `${thumbTopPercent}%`,
          height: `${thumbHeightPercent}%`,
        }}
        className="absolute left-0 right-0 border-2 border-amber-500 bg-amber-400/25 pointer-events-none rounded-[1px] shadow-sm transition-[top] duration-75"
      />
    </div>
  );
};
