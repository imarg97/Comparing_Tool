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
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-y-auto p-8 text-slate-200">
      <div className="max-w-4xl mx-auto w-full space-y-8">
        {/* Hero Banner */}
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-lg text-white shadow-lg">
              DX
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-100">
                DiffX Comparison Suite
              </h1>
              <p className="text-xs text-slate-400">
                Local-first, deterministic file and folder comparison built for professional engineering teams.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Launch Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Folder Compare Card */}
          <div
            onClick={() => onNavigate('folder')}
            className="group bg-slate-900 border border-slate-800 hover:border-blue-500/60 p-5 rounded-lg cursor-pointer transition shadow hover:shadow-blue-950/20 flex flex-col justify-between"
          >
            <div>
              <div className="w-8 h-8 rounded bg-blue-950/80 border border-blue-800/80 text-blue-400 flex items-center justify-center mb-3">
                <FolderGit2 className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-slate-100 group-hover:text-blue-400 transition">
                Folder Compare
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Recursively scan directory trees, detect additions/modifications using SHA-256 hashes, and safely reconcile files.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-blue-400 group-hover:translate-x-1 transition-transform">
              <span>Launch workspace</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>

          {/* Text Compare Card */}
          <div
            onClick={() => onNavigate('text')}
            className="group bg-slate-900 border border-slate-800 hover:border-indigo-500/60 p-5 rounded-lg cursor-pointer transition shadow hover:shadow-indigo-950/20 flex flex-col justify-between"
          >
            <div>
              <div className="w-8 h-8 rounded bg-indigo-950/80 border border-indigo-800/80 text-indigo-400 flex items-center justify-center mb-3">
                <FileCode2 className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-slate-100 group-hover:text-indigo-400 transition">
                Text Compare
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Monaco-powered side-by-side syntax diffing with whitespace isolation, jump-to-difference, and safe backup writing.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-indigo-400 group-hover:translate-x-1 transition-transform">
              <span>Launch workspace</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>

          {/* Structured Compare Card */}
          <div
            onClick={() => onNavigate('structured')}
            className="group bg-slate-900 border border-slate-800 hover:border-purple-500/60 p-5 rounded-lg cursor-pointer transition shadow hover:shadow-purple-950/20 flex flex-col justify-between"
          >
            <div>
              <div className="w-8 h-8 rounded bg-purple-950/80 border border-purple-800/80 text-purple-400 flex items-center justify-center mb-3">
                <Boxes className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-slate-100 group-hover:text-purple-400 transition">
                K8s & Config Compare
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Semantic YAML/JSON diffing with Kubernetes & Helm noise filters (strips managedFields, resourceVersion, and timestamps).
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-purple-400 group-hover:translate-x-1 transition-transform">
              <span>Launch workspace</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>
        </div>

        {/* Recent Comparisons Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
            <div className="flex items-center space-x-2 text-slate-200 font-semibold text-sm">
              <Clock className="w-4 h-4 text-blue-400" />
              <span>Recent Comparisons</span>
            </div>
            {recentList.length > 0 && (
              <button
                onClick={onClearRecent}
                className="flex items-center space-x-1 text-xs text-slate-400 hover:text-rose-400 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear History</span>
              </button>
            )}
          </div>

          {recentList.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              No recent comparisons saved. Select folders or files to begin.
            </p>
          ) : (
            <div className="space-y-2">
              {recentList.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onOpenRecent(item)}
                  className="flex items-center justify-between p-2.5 rounded bg-slate-950 hover:bg-slate-800/70 border border-slate-800/80 cursor-pointer transition text-xs"
                >
                  <div className="flex items-center space-x-3">
                    <span className="uppercase text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-900">
                      {item.type}
                    </span>
                    <div className="font-mono text-slate-300">
                      <span className="text-blue-300">{item.leftPath}</span>
                      <span className="text-slate-600 mx-2">↔</span>
                      <span className="text-purple-300">{item.rightPath}</span>
                    </div>
                  </div>
                  <span className="text-slate-500 text-[11px]">
                    {new Date(item.timestamp).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Local-First & Security Assurance Box */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-4 flex items-start space-x-3 text-xs text-slate-400">
          <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-slate-200">
              Zero-Telemetry & 100% Offline Architecture
            </span>
            <p className="leading-relaxed">
              DiffX performs all calculations entirely on your local CPU. No files or contents are ever sent over network sockets. No user accounts, tracking cookies, or license beacons are required.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
