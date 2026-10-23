import React from 'react';
import { ArrowRight, ArrowLeft } from 'lucide-react';

interface LineDetailInspectorProps {
  leftLineNumber: number | null;
  rightLineNumber: number | null;
  leftText: string;
  rightText: string;
  onCopyLeftToRight?: () => void;
  onCopyRightToLeft?: () => void;
  theme?: 'dark' | 'light';
}

/**
 * Computes common prefix and suffix to highlight the differing character slice
 */
function highlightCharDiff(strA: string, strB: string) {
  if (strA === strB) {
    return { prefix: strA, diff: '', suffix: '' };
  }

  let start = 0;
  while (start < strA.length && start < strB.length && strA[start] === strB[start]) {
    start++;
  }

  let endA = strA.length - 1;
  let endB = strB.length - 1;
  while (endA >= start && endB >= start && strA[endA] === strB[endB]) {
    endA--;
    endB--;
  }

  const prefix = strA.slice(0, start);
  const diff = strA.slice(start, endA + 1);
  const suffix = strA.slice(endA + 1);

  return { prefix, diff, suffix };
}

export const LineDetailInspector: React.FC<LineDetailInspectorProps> = ({
  leftLineNumber,
  rightLineNumber,
  leftText,
  rightText,
  onCopyLeftToRight,
  onCopyRightToLeft,
  theme: _theme = 'light',
}) => {
  const leftDiff = highlightCharDiff(leftText, rightText);
  const rightDiff = highlightCharDiff(rightText, leftText);
  const hasDifference = leftText !== rightText;

  return (
    <div className="h-16 border-t border-[#c0c0c0] dark:border-neutral-800 bg-[#f8f8f8] dark:bg-[#080808] flex flex-col flex-shrink-0 select-text font-mono text-[11px] overflow-hidden">
      {/* Top Header Label */}
      <div className="h-4 bg-[#eaeaea] dark:bg-[#121212] px-2 flex items-center justify-between text-[10px] text-neutral-600 dark:text-neutral-400 border-b border-[#d8d8d8] dark:border-neutral-800 select-none">
        <span className="font-sans font-semibold uppercase tracking-wider text-[9px]">
          Beyond Compare • Line Details
        </span>
        <span className="text-[10px]">
          {hasDifference ? (
            <span className="text-red-600 dark:text-red-400 font-sans font-medium">Difference at cursor</span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400 font-sans font-medium">Lines identical</span>
          )}
        </span>
      </div>

      {/* Main Split Comparison Bar (Image 3) */}
      <div className="flex-1 flex items-center min-h-0 divide-x divide-[#d8d8d8] dark:divide-neutral-800">
        {/* Left Side Line */}
        <div className="flex-1 flex items-center px-2 py-1 min-w-0 h-full overflow-x-auto whitespace-pre bg-white dark:bg-black">
          <span className="text-[10px] font-sans font-bold text-neutral-400 dark:text-neutral-500 mr-2 select-none flex-shrink-0">
            {leftLineNumber !== null ? `${leftLineNumber}:` : '-:'}
          </span>
          <div className="truncate flex-1 text-neutral-900 dark:text-neutral-100">
            {leftDiff.prefix && <span>{leftDiff.prefix}</span>}
            {leftDiff.diff && (
              <span className="bg-[#ffcdd2] dark:bg-red-950/80 text-[#b71c1c] dark:text-red-300 font-bold px-0.5 rounded border border-red-300 dark:border-red-800">
                {leftDiff.diff}
              </span>
            )}
            {leftDiff.suffix && <span>{leftDiff.suffix}</span>}
            {!leftText && <span className="text-neutral-400 italic select-none">&lt;empty&gt;</span>}
          </div>
        </div>

        {/* Center Copy Arrows Gutter (Image 3) */}
        <div className="flex items-center space-x-1 px-1.5 bg-[#eeeeee] dark:bg-[#111111] flex-shrink-0 select-none h-full">
          <button
            onClick={onCopyLeftToRight}
            disabled={!hasDifference || !onCopyLeftToRight}
            title="Copy line from Left to Right (Alt+Right)"
            className="p-1 rounded bg-white dark:bg-neutral-900 hover:bg-blue-50 dark:hover:bg-blue-950 text-blue-600 dark:text-blue-400 border border-neutral-300 dark:border-neutral-700 disabled:opacity-30 disabled:pointer-events-none transition shadow-xs"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onCopyRightToLeft}
            disabled={!hasDifference || !onCopyRightToLeft}
            title="Copy line from Right to Left (Alt+Left)"
            className="p-1 rounded bg-white dark:bg-neutral-900 hover:bg-purple-50 dark:hover:bg-purple-950 text-purple-600 dark:text-purple-400 border border-neutral-300 dark:border-neutral-700 disabled:opacity-30 disabled:pointer-events-none transition shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right Side Line */}
        <div className="flex-1 flex items-center px-2 py-1 min-w-0 h-full overflow-x-auto whitespace-pre bg-white dark:bg-black">
          <span className="text-[10px] font-sans font-bold text-neutral-400 dark:text-neutral-500 mr-2 select-none flex-shrink-0">
            {rightLineNumber !== null ? `${rightLineNumber}:` : '-:'}
          </span>
          <div className="truncate flex-1 text-neutral-900 dark:text-neutral-100">
            {rightDiff.prefix && <span>{rightDiff.prefix}</span>}
            {rightDiff.diff && (
              <span className="bg-[#ffcdd2] dark:bg-red-950/80 text-[#b71c1c] dark:text-red-300 font-bold px-0.5 rounded border border-red-300 dark:border-red-800">
                {rightDiff.diff}
              </span>
            )}
            {rightDiff.suffix && <span>{rightDiff.suffix}</span>}
            {!rightText && <span className="text-neutral-400 italic select-none">&lt;empty&gt;</span>}
          </div>
        </div>
      </div>
    </div>
  );
};
