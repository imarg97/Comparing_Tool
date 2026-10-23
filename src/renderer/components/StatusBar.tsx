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
    <footer className="h-6 bg-slate-900 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between px-3 select-none flex-shrink-0">
      <div className="flex items-center space-x-3">
        <span className="flex items-center space-x-1 text-slate-300">
          <HardDrive className="w-3 h-3 text-slate-400" />
          <span>{statusText}</span>
        </span>
        {itemCount !== undefined && (
          <span className="text-slate-500">| {itemCount} items</span>
        )}
        {durationMs !== undefined && durationMs > 0 && (
          <span className="text-slate-500">| {durationMs} ms</span>
        )}
      </div>

      <div className="flex items-center space-x-4">
        <span className="flex items-center space-x-1 text-emerald-400" title="All operations run 100% locally on your machine">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Local-First (Offline)</span>
        </span>
        <span className="flex items-center space-x-1 text-slate-400">
          <Cpu className="w-3 h-3" />
          <span>Strict Content Hash</span>
        </span>
      </div>
    </footer>
  );
};
