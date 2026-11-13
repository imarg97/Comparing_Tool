import React from 'react';
import { AlertCircle, FileCode2, Boxes, X, ShieldAlert, Monitor } from 'lucide-react';
import { NavigationTab } from './Header.js';

interface WebFolderNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchTab: (tab: NavigationTab) => void;
}

export const WebFolderNoticeModal: React.FC<WebFolderNoticeModalProps> = ({
  isOpen,
  onClose,
  onSwitchTab,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-[#121212] border border-neutral-300 dark:border-neutral-800 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
        {/* Modal Header */}
        <div className="bg-neutral-100 dark:bg-neutral-900 px-4 py-3 border-b border-neutral-300 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <h3 className="font-semibold text-xs text-neutral-900 dark:text-white">
              Folder Compare Unavailable in Web App
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-800 dark:hover:text-white transition cursor-pointer p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs font-sans">
          {/* Requested Highlight Callout */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3.5 text-amber-900 dark:text-amber-200 space-y-1">
            <div className="flex items-center space-x-1.5 font-semibold text-xs text-amber-800 dark:text-amber-300">
              <Monitor className="w-3.5 h-3.5" />
              <span>Desktop Application Required</span>
            </div>
            <p className="text-[12px] leading-relaxed text-neutral-800 dark:text-neutral-200">
              This folder compare feature does not work on the web app. Please download and install
              the application on your computer to access this feature.
            </p>
          </div>

          {/* Technical Context */}
          <div className="space-y-1.5 text-neutral-600 dark:text-neutral-400 leading-relaxed text-[11px]">
            <p>
              <strong className="text-neutral-800 dark:text-neutral-200">Why?</strong> Web browsers
              operate within a strict security sandbox that isolates web pages from your local operating
              system. A web browser cannot directly traverse your computer&apos;s hard drive paths
              (e.g.{' '}
              <code className="px-1 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 font-mono text-[10px]">
                C:\...
              </code>{' '}
              or{' '}
              <code className="px-1 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 font-mono text-[10px]">
                /home/...
              </code>
              ), scan nested directory trees with raw disk I/O, or copy and sync files in-place.
            </p>
            <p>
              Full recursive directory comparison, background cryptographic SHA-256 tree hashing, and
              safe in-place copy synchronization are exclusively supported in the standalone native
              mDiff desktop application.
            </p>
          </div>

          {/* Web-Supported Alternatives */}
          <div className="bg-neutral-100 dark:bg-neutral-900/60 rounded-lg p-3 border border-neutral-200 dark:border-neutral-800 space-y-2">
            <div className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
              Available Web Comparison Modes:
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  onClose();
                  onSwitchTab('text');
                }}
                className="flex items-center space-x-2 p-2 rounded bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition text-left cursor-pointer group"
              >
                <FileCode2 className="w-4 h-4 text-blue-500 flex-shrink-0 group-hover:scale-110 transition-transform" />
                <div className="min-w-0">
                  <div className="font-semibold text-neutral-900 dark:text-white text-[11px] truncate">
                    Text Compare
                  </div>
                  <div className="text-[10px] text-neutral-500 truncate">Side-by-side code diff</div>
                </div>
              </button>

              <button
                onClick={() => {
                  onClose();
                  onSwitchTab('structured');
                }}
                className="flex items-center space-x-2 p-2 rounded bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 transition text-left cursor-pointer group"
              >
                <Boxes className="w-4 h-4 text-emerald-500 flex-shrink-0 group-hover:scale-110 transition-transform" />
                <div className="min-w-0">
                  <div className="font-semibold text-neutral-900 dark:text-white text-[11px] truncate">
                    Config & XML
                  </div>
                  <div className="text-[10px] text-neutral-500 truncate">K8s, YAML & JSON</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-neutral-50 dark:bg-neutral-950 px-4 py-3 border-t border-neutral-300 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-neutral-400 text-[10px]">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Air-gapped & zero-telemetry</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium text-xs transition cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
