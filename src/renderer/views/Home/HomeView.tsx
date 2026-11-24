import React, { useState } from 'react';
import {
  Folder,
  FileText,
  FileCode,
  Search,
  Plus,
  Minus,
  ChevronRight,
  ChevronDown,
  X,
  Clock,
} from 'lucide-react';
import { RecentComparison } from '@shared/types.js';
import { NavigationTab } from '../../components/Header.js';

interface HomeViewProps {
  onNavigate: (tab: NavigationTab) => void;
  recentList: RecentComparison[];
  onOpenRecent: (item: RecentComparison) => void;
  onClearRecent: () => void;
  isWeb?: boolean;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onNavigate,
  recentList,
  onOpenRecent,
  onClearRecent,
  isWeb = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [newSessionsOpen, setNewSessionsOpen] = useState(true);
  const [recentSessionsOpen, setRecentSessionsOpen] = useState(true);
  const [showBottomBanner, setShowBottomBanner] = useState(true);

  const filteredRecent = recentList.filter((item) =>
    (item.leftPath + ' ' + item.rightPath).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f4f4f4] dark:bg-black text-neutral-900 dark:text-neutral-100 font-sans select-none overflow-hidden">
      {/* Main Beyond Compare Home Body: Split Left Sessions Tree + Right Session Grid */}
      <div className="flex-1 flex min-h-0">
        {/* ================= LEFT SESSIONS SIDEBAR ================= */}
        <div className="w-64 bg-white dark:bg-[#0a0a0a] border-r border-[#d4d4d4] dark:border-neutral-800 flex flex-col flex-shrink-0">
          {/* Header */}
          <div className="bg-[#e9e9e9] dark:bg-[#141414] border-b border-[#d4d4d4] dark:border-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
            Sessions
          </div>

          {/* Tree View */}
          <div className="flex-1 overflow-y-auto p-1 text-xs">
            {/* New Group */}
            <div>
              <div
                onClick={() => setNewSessionsOpen((prev) => !prev)}
                className="flex items-center space-x-1.5 px-2 py-1 rounded cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-900 font-medium text-neutral-800 dark:text-neutral-200"
              >
                {newSessionsOpen ? (
                  <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />
                )}
                <Folder className="w-4 h-4 text-amber-500 fill-amber-400" />
                <span>New</span>
              </div>

              {newSessionsOpen && (
                <div className="pl-6 space-y-0.5 mt-0.5">
                  <div
                    onClick={() => onNavigate('folder')}
                    className="flex items-center space-x-2 px-2 py-1 rounded cursor-pointer hover:bg-blue-50 dark:hover:bg-neutral-900 hover:text-blue-600 dark:hover:text-blue-400 text-neutral-700 dark:text-neutral-300"
                  >
                    <Folder className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                    <span>Folder Compare</span>
                    {isWeb && (
                      <span className="px-1 py-0.2 text-[8px] font-semibold rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 ml-auto">
                        App Only
                      </span>
                    )}
                  </div>
                  <div
                    onClick={() => onNavigate('folder')}
                    className="flex items-center space-x-2 px-2 py-1 rounded cursor-pointer hover:bg-blue-50 dark:hover:bg-neutral-900 hover:text-blue-600 dark:hover:text-blue-400 text-neutral-700 dark:text-neutral-300"
                  >
                    <Folder className="w-3.5 h-3.5 text-cyan-500 fill-cyan-400" />
                    <span>Folder Sync</span>
                  </div>
                  <div
                    onClick={() => onNavigate('text')}
                    className="flex items-center space-x-2 px-2 py-1 rounded cursor-pointer hover:bg-blue-50 dark:hover:bg-neutral-900 hover:text-blue-600 dark:hover:text-blue-400 text-neutral-700 dark:text-neutral-300"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-500" />
                    <span>Text Compare</span>
                  </div>
                  <div
                    onClick={() => onNavigate('structured')}
                    className="flex items-center space-x-2 px-2 py-1 rounded cursor-pointer hover:bg-blue-50 dark:hover:bg-neutral-900 hover:text-blue-600 dark:hover:text-blue-400 text-neutral-700 dark:text-neutral-300"
                  >
                    <FileCode className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Config & XML Compare</span>
                  </div>
                  <div
                    onClick={() => onNavigate('text')}
                    className="flex items-center space-x-2 px-2 py-1 rounded cursor-pointer hover:bg-blue-50 dark:hover:bg-neutral-900 hover:text-blue-600 dark:hover:text-blue-400 text-neutral-700 dark:text-neutral-300"
                  >
                    <FileText className="w-3.5 h-3.5 text-purple-500" />
                    <span>Table & Data Compare</span>
                  </div>
                </div>
              )}
            </div>

            {/* Saved / Recent Group */}
            <div className="mt-2">
              <div
                onClick={() => setRecentSessionsOpen((prev) => !prev)}
                className="flex items-center justify-between px-2 py-1 rounded cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-900 font-medium text-neutral-800 dark:text-neutral-200"
              >
                <div className="flex items-center space-x-1.5">
                  {recentSessionsOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />
                  )}
                  <Clock className="w-4 h-4 text-blue-500" />
                  <span>Recent Comparisons</span>
                </div>
                {recentList.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-mono">
                    {recentList.length}
                  </span>
                )}
              </div>

              {recentSessionsOpen && (
                <div className="pl-6 space-y-0.5 mt-0.5">
                  {filteredRecent.length === 0 ? (
                    <div className="text-[11px] text-neutral-400 italic px-2 py-1">
                      No recent comparisons
                    </div>
                  ) : (
                    filteredRecent.slice(0, 8).map((item) => (
                      <div
                        key={item.id}
                        onClick={() => onOpenRecent(item)}
                        className="group flex items-center justify-between px-2 py-1 rounded cursor-pointer hover:bg-blue-50 dark:hover:bg-neutral-900 text-neutral-700 dark:text-neutral-300"
                        title={`${item.leftPath} ↔ ${item.rightPath}`}
                      >
                        <span className="truncate text-[11px] font-mono">
                          {item.leftPath.split('/').pop() || 'Left'} ↔{' '}
                          {item.rightPath.split('/').pop() || 'Right'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Search Controls in Left Sidebar (Beyond Compare iconic + - 🔍 box) */}
          <div className="bg-[#f0f0f0] dark:bg-[#101010] border-t border-[#d4d4d4] dark:border-neutral-800 p-1.5 flex items-center space-x-1">
            <button
              onClick={() => onNavigate('text')}
              title="New Comparison"
              className="w-6 h-6 rounded bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClearRecent}
              disabled={recentList.length === 0}
              title="Clear Recent List"
              className="w-6 h-6 rounded bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 disabled:opacity-40"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <div className="flex-1 flex items-center bg-white dark:bg-black border border-neutral-300 dark:border-neutral-700 rounded px-1.5 py-0.5">
              <Search className="w-3 h-3 text-neutral-400 mr-1 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="bg-transparent text-[11px] w-full focus:outline-none text-neutral-800 dark:text-neutral-200 placeholder-neutral-400"
              />
            </div>
          </div>
        </div>

        {/* ================= RIGHT MAIN AREA: BEYOND COMPARE LAUNCHER GRID ================= */}
        <div className="flex-1 bg-white dark:bg-black overflow-y-auto flex flex-col items-center justify-center p-6">
          <div className="max-w-3xl w-full">
            {/* Grid of 5 Beyond Compare Comparison Launchers */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 justify-items-center mb-6">
              {/* 1. Folder Compare */}
              <div
                onClick={() => onNavigate('folder')}
                className="group flex flex-col items-center cursor-pointer p-3 rounded-lg hover:bg-[#f0f7ff] dark:hover:bg-neutral-900 border border-transparent hover:border-blue-300 dark:hover:border-blue-900/60 transition w-full"
              >
                <div className="relative w-16 h-16 mb-2 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <div className="absolute top-1 left-1 w-11 h-10 rounded bg-[#e8a838] shadow border border-[#c48820]" />
                  <div className="absolute top-3 left-4 w-11 h-10 rounded bg-[#f5bc4b] shadow-md border border-[#c48820] flex items-center justify-center" />
                  <Folder className="w-8 h-8 text-white fill-white relative z-10 opacity-80" />
                </div>
                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 text-center flex items-center space-x-1">
                  <span>Folder Compare</span>
                </span>
                {isWeb && (
                  <span className="mt-1 px-1 py-0.2 text-[8px] font-semibold rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    App Only
                  </span>
                )}
                <span className="text-[10px] text-neutral-400 text-center mt-1">
                  Dual-pane synchronized explorer
                </span>
              </div>

              {/* 2. Text Compare */}
              <div
                onClick={() => onNavigate('text')}
                className="group flex flex-col items-center cursor-pointer p-3 rounded-lg hover:bg-[#f0f7ff] dark:hover:bg-neutral-900 border border-transparent hover:border-blue-300 dark:hover:border-blue-900/60 transition w-full"
              >
                <div className="relative w-16 h-16 mb-2 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <div className="absolute top-1 left-2 w-10 h-12 rounded bg-white dark:bg-neutral-800 shadow border border-neutral-300 dark:border-neutral-700" />
                  <div className="absolute top-3 left-4 w-10 h-12 rounded bg-white dark:bg-neutral-800 shadow-md border border-neutral-300 dark:border-neutral-700 flex flex-col justify-center px-1.5 space-y-1">
                    <div className="h-1 bg-blue-500 rounded w-full" />
                    <div className="h-1 bg-neutral-300 dark:bg-neutral-600 rounded w-4/5" />
                    <div className="h-1 bg-red-400 rounded w-full" />
                    <div className="h-1 bg-neutral-300 dark:bg-neutral-600 rounded w-3/4" />
                  </div>
                </div>
                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 text-center">
                  Text Compare
                </span>
                <span className="text-[10px] text-neutral-400 text-center mt-1">
                  Side-by-side Monaco diffing
                </span>
              </div>

              {/* 3. Config & XML Compare */}
              <div
                onClick={() => onNavigate('structured')}
                className="group flex flex-col items-center cursor-pointer p-3 rounded-lg hover:bg-[#f0f7ff] dark:hover:bg-neutral-900 border border-transparent hover:border-blue-300 dark:hover:border-blue-900/60 transition w-full"
              >
                <div className="relative w-16 h-16 mb-2 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <div className="absolute top-1 left-2 w-10 h-12 rounded bg-white dark:bg-neutral-800 shadow border border-neutral-300 dark:border-neutral-700" />
                  <div className="absolute top-3 left-4 w-10 h-12 rounded bg-emerald-50 dark:bg-emerald-950/60 shadow-md border border-emerald-400 dark:border-emerald-700 flex flex-col items-center justify-center text-emerald-600 dark:text-emerald-400 font-mono font-bold text-xs">
                    &lt;/&gt;
                  </div>
                </div>
                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 text-center">
                  Config & XML
                </span>
                <span className="text-[10px] text-neutral-400 text-center mt-1">
                  site.xml & values.yaml
                </span>
              </div>

              {/* 4. Folder Sync */}
              <div
                onClick={() => onNavigate('folder')}
                className="group flex flex-col items-center cursor-pointer p-3 rounded-lg hover:bg-[#f0f7ff] dark:hover:bg-neutral-900 border border-transparent hover:border-blue-300 dark:hover:border-blue-900/60 transition w-full"
              >
                <div className="relative w-16 h-16 mb-2 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <div className="absolute top-1 left-1 w-11 h-10 rounded bg-[#0284c7] shadow border border-[#0369a1]" />
                  <div className="absolute top-3 left-4 w-11 h-10 rounded bg-[#38bdf8] shadow-md border border-[#0369a1] flex items-center justify-center" />
                  <Folder className="w-8 h-8 text-white fill-white relative z-10 opacity-90" />
                </div>
                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 group-hover:text-sky-600 dark:group-hover:text-sky-400 text-center">
                  Folder Sync
                </span>
                <span className="text-[10px] text-neutral-400 text-center mt-1">
                  Bi-directional folder sync
                </span>
              </div>

              {/* 5. Table & Data Compare */}
              <div
                onClick={() => onNavigate('text')}
                className="group flex flex-col items-center cursor-pointer p-3 rounded-lg hover:bg-[#f0f7ff] dark:hover:bg-neutral-900 border border-transparent hover:border-blue-300 dark:hover:border-blue-900/60 transition w-full"
              >
                <div className="relative w-16 h-16 mb-2 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <div className="absolute top-1 left-2 w-10 h-12 rounded bg-purple-100 dark:bg-purple-950/60 shadow border border-purple-300 dark:border-purple-800" />
                  <div className="absolute top-3 left-4 w-10 h-12 rounded bg-white dark:bg-neutral-800 shadow-md border border-purple-400 dark:border-purple-700 flex flex-col justify-center px-1.5 space-y-1">
                    <div className="h-1 bg-purple-500 rounded w-full" />
                    <div className="h-1 bg-neutral-300 dark:bg-neutral-600 rounded w-full" />
                    <div className="h-1 bg-purple-400 rounded w-full" />
                    <div className="h-1 bg-neutral-300 dark:bg-neutral-600 rounded w-full" />
                  </div>
                </div>
                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 text-center">
                  Table & Data
                </span>
                <span className="text-[10px] text-neutral-400 text-center mt-1">
                  CSV, TSV & tabular diffs
                </span>
              </div>
            </div>

            {/* Quick Helper Text */}
            <div className="text-center text-xs text-neutral-500 dark:text-neutral-400">
              Select a session above or open a recent comparison from the left panel.
            </div>
          </div>
        </div>
      </div>

      {/* ================= BOTTOM MDIFF INFO BANNER (MODERN TECH PALETTE) ================= */}
      {showBottomBanner && (
        <div className="bg-[#0f172a] dark:bg-black text-slate-100 dark:text-neutral-200 border-t border-slate-800 dark:border-neutral-800 px-6 py-2.5 flex items-center justify-between text-xs flex-shrink-0 shadow-lg relative z-10">
          <div className="grid grid-cols-4 gap-6 max-w-5xl w-full">
            <div>
              <div className="font-semibold uppercase tracking-wider text-[11px] mb-1 text-sky-400 dark:text-sky-300">
                KNOWLEDGE BASE
              </div>
              <div className="text-[11px] text-slate-300 dark:text-neutral-400 leading-tight">
                Offline, local-first engine. No telemetry, cloud accounts, or subscriptions.
              </div>
            </div>

            <div>
              <div className="font-semibold uppercase tracking-wider text-[11px] mb-1 text-sky-400 dark:text-sky-300">
                KEYBOARD SHORTCUTS
              </div>
              <div className="text-[11px] text-slate-300 dark:text-neutral-400 leading-tight">
                <span className="font-mono bg-slate-800/90 text-sky-200 border border-slate-700/60 px-1 py-0.2 rounded">Ctrl+1</span> Folders •{' '}
                <span className="font-mono bg-slate-800/90 text-sky-200 border border-slate-700/60 px-1 py-0.2 rounded">Ctrl+2</span> Text •{' '}
                <span className="font-mono bg-slate-800/90 text-sky-200 border border-slate-700/60 px-1 py-0.2 rounded">Ctrl+S</span> Save
              </div>
            </div>

            <div>
              <div className="font-semibold uppercase tracking-wider text-[11px] mb-1 text-sky-400 dark:text-sky-300">
                TELECOM & CLOUD
              </div>
              <div className="text-[11px] text-slate-300 dark:text-neutral-400 leading-tight">
                Specialized modes for Helm charts, values.yaml, and XML cellular configs.
              </div>
            </div>

            <div>
              <div className="font-semibold uppercase tracking-wider text-[11px] mb-1 text-sky-400 dark:text-sky-300">
                MDIFF SUITE v7.0.0
              </div>
              <div className="text-[11px] text-slate-300 dark:text-neutral-400 leading-tight">
                Designed for high-performance file, folder, and configuration comparison.
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowBottomBanner(false)}
            title="Dismiss Banner"
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition ml-4 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
