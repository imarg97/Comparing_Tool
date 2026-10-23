import React from 'react';
import {
  FolderGit2,
  FileCode2,
  Boxes,
  Clock,
  Trash2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { RecentComparison } from '@shared/types.js';
import { NavigationTab } from '../../components/Header.js';

interface HomeViewProps {
  onNavigate: (tab: NavigationTab) => void;
  recentList: RecentComparison[];
  onOpenRecent: (item: RecentComparison) => void;
  onClearRecent: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onNavigate,
  recentList,
  onOpenRecent,
  onClearRecent,
}) => {
  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-black overflow-y-auto p-6 text-neutral-900 dark:text-neutral-100 font-sans">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-3 pb-3 border-b border-neutral-200 dark:border-neutral-800">
          <div className="w-9 h-9 rounded bg-blue-600 flex items-center justify-center font-bold text-sm text-white shadow">
            DX
          </div>
          <div>
            <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              DiffX Comparison Suite
            </h1>
            <p className="text-xs text-neutral-500">
              Beyond Compare-aligned professional desktop comparison suite for engineering teams.
            </p>
          </div>
        </div>

        {/* Quick Launch Sessions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Folder Compare Card */}
          <div
            onClick={() => onNavigate('folder')}
            className="group bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 hover:border-blue-500 p-4 rounded-lg cursor-pointer transition shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="w-7 h-7 rounded bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2.5">
                <FolderGit2 className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-xs text-neutral-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                Folder Compare
              </h3>
              <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
                Dual-pane synchronized explorer with SHA-256 verification and Show Differences / Same filters.
              </p>
            </div>
            <div className="mt-3 flex items-center text-xs font-medium text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform">
              <span>Open Folder Session</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>

          {/* Text Compare Card */}
          <div
            onClick={() => onNavigate('text')}
            className="group bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 hover:border-blue-500 p-4 rounded-lg cursor-pointer transition shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="w-7 h-7 rounded bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-2.5">
                <FileCode2 className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-xs text-neutral-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition">
                Text Compare
              </h3>
              <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
                Monaco side-by-side diffing, next/previous difference jumpers, and whitespace isolation rules.
              </p>
            </div>
            <div className="mt-3 flex items-center text-xs font-medium text-purple-600 dark:text-purple-400 group-hover:translate-x-1 transition-transform">
              <span>Open Text Session</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>

          {/* Structured Compare Card */}
          <div
            onClick={() => onNavigate('structured')}
            className="group bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 hover:border-blue-500 p-4 rounded-lg cursor-pointer transition shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="w-7 h-7 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2.5">
                <Boxes className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-xs text-neutral-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
                K8s & Config Compare
              </h3>
              <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
                Semantic AST comparison with Kubernetes runtime noise suppression (resourceVersion, status, uid).
              </p>
            </div>
            <div className="mt-3 flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform">
              <span>Open Config Session</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>
        </div>

        {/* Recent Comparison Sessions */}
        <div className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center space-x-2 font-semibold text-xs text-neutral-900 dark:text-neutral-100">
              <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Recent Sessions</span>
            </div>
            {recentList.length > 0 && (
              <button
                onClick={onClearRecent}
                className="flex items-center space-x-1 text-[11px] text-neutral-500 hover:text-red-500 transition"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear History</span>
              </button>
            )}
          </div>

          {recentList.length === 0 ? (
            <p className="text-xs text-neutral-500 py-3 text-center">
              No recent comparisons stored. Select directories or files above to begin.
            </p>
          ) : (
            <div className="space-y-1.5">
              {recentList.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onOpenRecent(item)}
                  className="flex items-center justify-between p-2 rounded bg-white dark:bg-black hover:bg-neutral-100 dark:hover:bg-neutral-900 border border-neutral-200 dark:border-neutral-800/80 cursor-pointer transition text-xs font-mono"
                >
                  <div className="flex items-center space-x-2.5">
                    <span className="uppercase text-[9px] font-sans font-bold px-1.5 py-0.2 rounded bg-neutral-200 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-800">
                      {item.type}
                    </span>
                    <div>
                      <span className="text-blue-600 dark:text-blue-400">{item.leftPath}</span>
                      <span className="text-neutral-400 mx-2">↔</span>
                      <span className="text-purple-600 dark:text-purple-400">{item.rightPath}</span>
                    </div>
                  </div>
                  <span className="text-neutral-400 font-sans text-[11px]">
                    {new Date(item.timestamp).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Local-First Assurance */}
        <div className="bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg p-3.5 flex items-start space-x-2.5 text-xs text-neutral-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>100% Offline & Local-First:</strong> All comparisons run on your local machine. No file contents or telemetry are transmitted over any network socket.
          </p>
        </div>
      </div>
    </div>
  );
};
