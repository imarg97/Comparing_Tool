import React from 'react';
import { ShieldCheck, Cpu, HardDrive } from 'lucide-react';

interface StatusBarProps {
  statusText: string;
  itemCount?: number;
  durationMs?: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  statusText,
  itemCount,
  durationMs,
}) => {
  return (
    <footer className="h-6 bg-neutral-100 dark:bg-black border-t border-neutral-300 dark:border-neutral-800 text-[11px] text-neutral-600 dark:text-neutral-400 flex items-center justify-between px-3 select-none flex-shrink-0">
      <div className="flex items-center space-x-2.5">
        <span className="text-[10px] text-neutral-500 dark:text-neutral-500 font-mono select-none" title="DiffX v3.0.0 • Developed by IM_ARG">
          v3.0.0 • Developed by AMRG
        </span>
        <span className="text-neutral-300 dark:text-neutral-700">|</span>
        <span className="flex items-center space-x-1 text-neutral-800 dark:text-neutral-200">
          <HardDrive className="w-3 h-3 text-neutral-500 dark:text-neutral-400" />
          <span>{statusText}</span>
        </span>
        {itemCount !== undefined && (
          <span className="text-neutral-500">| {itemCount} items</span>
        )}
        {durationMs !== undefined && durationMs > 0 && (
          <span className="text-neutral-500">| {durationMs} ms</span>
        )}
      </div>

      <div className="flex items-center space-x-4">
        <span className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400" title="100% offline local-first comparison">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Local-First (Offline)</span>
        </span>
        <span className="flex items-center space-x-1 text-neutral-500 dark:text-neutral-400">
          <Cpu className="w-3 h-3" />
          <span>SHA-256 Hash Engine</span>
        </span>
      </div>
    </footer>
  );
};
