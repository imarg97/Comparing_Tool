import React, { useState, useRef, useEffect } from 'react';
import {
  FolderGit2,
  FileCode2,
  Boxes,
  Clock,
  Settings,
  Sun,
  Moon,
  Keyboard,
  ArrowRight,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  RefreshCw,
  FolderOpen,
  BookOpen,
  ShieldCheck,
  Info,
  X,
  Plus,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { SessionTab } from '@shared/types.js';

export const DiffXLogo: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 512 512" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="diffx-bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#09090b" />
        <stop offset="100%" stopColor="#000000" />
      </linearGradient>
      <linearGradient id="diffx-left" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#2563eb" />
        <stop offset="100%" stopColor="#1d4ed8" />
      </linearGradient>
      <linearGradient id="diffx-right" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1e293b" />
        <stop offset="100%" stopColor="#0f172a" />
      </linearGradient>
      <linearGradient id="diffx-top" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="100%" stopColor="#0284c7" />
      </linearGradient>
    </defs>
    <rect width="512" height="512" rx="112" fill="url(#diffx-bg)" />
    <rect width="508" height="508" x="2" y="2" rx="110" fill="none" stroke="#27272a" strokeWidth="6" />
    <polygon points="256,100 376,170 256,240 136,170" fill="url(#diffx-top)" />
    <polygon points="136,170 256,240 256,380 136,310" fill="url(#diffx-left)" stroke="#38bdf8" strokeWidth="4" />
    <polygon points="256,240 376,170 376,310 256,380" fill="url(#diffx-right)" stroke="#475569" strokeWidth="4" />
    <line x1="256" y1="100" x2="256" y2="410" stroke="#ffffff" strokeWidth="10" strokeLinecap="round" />
    <circle cx="256" cy="240" r="28" fill="#ffffff" />
    <circle cx="256" cy="240" r="14" fill="#0284c7" />
    <path d="M 180 250 L 210 268 L 180 286" fill="none" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 332 250 L 302 268 L 332 286" fill="none" stroke="#94a3b8" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const MDiffLogo = DiffXLogo;

export type NavigationTab = 'folder' | 'text' | 'structured' | 'home' | 'settings';

export interface HeaderProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  sessionTabs: SessionTab[];
  activeTabId: string;
  onSelectSessionTab: (id: string) => void;
  onCloseSessionTab: (id: string) => void;
  onNewSession: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenShortcuts: () => void;
  isWeb?: boolean;
  zoomLevel?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  sessionTabs,
  activeTabId,
  onSelectSessionTab,
  onCloseSessionTab,
  onNewSession,
  theme,
  onToggleTheme,
  onOpenShortcuts,
  isWeb = false,
  zoomLevel = 100,
  onZoomIn,
  onZoomOut,
  onResetZoom,
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const tabLabels: Record<NavigationTab, string> = {
    folder: 'Folder Compare',
    text: 'Text Compare',
    structured: 'Config & XML',
    home: 'Sessions',
    settings: 'Preferences',
  };

  const handleMenuClick = (menuName: string) => {
    setActiveMenu((prev) => (prev === menuName ? null : menuName));
  };

  const handleAction = (cb: () => void) => {
    cb();
    setActiveMenu(null);
  };

  return (
    <div className="flex flex-col flex-shrink-0 select-none z-30 border-b border-[#c8c8c8] dark:border-neutral-800 bg-[#f0f0f0] dark:bg-black font-sans">
      {/* 1. Classic Beyond Compare Menu Bar: Session | File | Edit | Search | View | Tools | Help */}
      <div
        ref={menuBarRef}
        className="h-6 bg-[#eaeaea] dark:bg-[#0a0a0a] border-b border-[#dcdcdc] dark:border-neutral-800 flex items-center justify-between px-2 text-[11px] text-neutral-800 dark:text-neutral-200"
      >
        {/* Left: App Logo + Menu items */}
        <div className="flex items-center space-x-0.5">
          {/* Logo badge & session label */}
          <button
            onClick={() => onSelectTab('home')}
            title="Open Sessions Launcher (Ctrl+4)"
            className="flex items-center space-x-1.5 mr-2 pl-1 hover:opacity-80 transition cursor-pointer"
          >
            <span className="font-bold text-[11px] tracking-tight text-neutral-900 dark:text-neutral-100">
              mDiff
            </span>
            <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
              v5.0.0
            </span>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-normal">
              • {tabLabels[activeTab]}
            </span>
          </button>

          {/* Session Menu */}
          <div className="relative">
            <button
              onClick={() => handleMenuClick('session')}
              className={`px-2 py-0.5 rounded hover:bg-[#d6d6d6] dark:hover:bg-neutral-800 transition ${
                activeMenu === 'session' ? 'bg-[#d6d6d6] dark:bg-neutral-800 font-semibold' : ''
              }`}
            >
              Session
            </button>
            {activeMenu === 'session' && (
              <div className="absolute left-0 top-full mt-0.5 w-60 bg-white dark:bg-[#141414] border border-[#b8b8b8] dark:border-neutral-800 rounded shadow-lg py-1 text-xs z-50">
                <div className="px-3 py-1 font-semibold text-[10px] uppercase text-neutral-400">
                  New Comparison
                </div>
                <button
                  onClick={() => handleAction(() => onSelectTab('folder'))}
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between"
                >
                  <span className="flex items-center space-x-2">
                    <FolderGit2 className="w-3.5 h-3.5 text-amber-500" />
                    <span>Folder Compare</span>
                    {isWeb && (
                      <span className="px-1 py-0.2 text-[8px] font-semibold rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        App Only
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] opacity-60 font-mono">Ctrl+1</span>
                </button>
                <button
                  onClick={() => handleAction(() => onSelectTab('text'))}
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between"
                >
                  <span className="flex items-center space-x-2">
                    <FileCode2 className="w-3.5 h-3.5 text-blue-500" />
                    <span>Text Compare</span>
                  </span>
                  <span className="text-[10px] opacity-60 font-mono">Ctrl+2</span>
                </button>
                <button
                  onClick={() => handleAction(() => onSelectTab('structured'))}
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between"
                >
                  <span className="flex items-center space-x-2">
                    <Boxes className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Config & XML Compare</span>
                  </span>
                  <span className="text-[10px] opacity-60 font-mono">Ctrl+3</span>
                </button>
                <div className="my-1 border-t border-neutral-200 dark:border-neutral-800" />
                <button
                  onClick={() => handleAction(() => onSelectTab('home'))}
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between"
                >
                  <span className="flex items-center space-x-2">
                    <Clock className="w-3.5 h-3.5 text-purple-500" />
                    <span>All Sessions / Launcher</span>
                  </span>
                  <span className="text-[10px] opacity-60 font-mono">Ctrl+4</span>
                </button>
                <button
                  onClick={() => handleAction(() => window.location.reload())}
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between"
                >
                  <span className="flex items-center space-x-2">
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reload Session</span>
                  </span>
                  <span className="text-[10px] opacity-60 font-mono">Ctrl+R</span>
                </button>
              </div>
            )}
          </div>

          {/* File Menu */}
          <div className="relative">
            <button
              onClick={() => handleMenuClick('file')}
              className={`px-2 py-0.5 rounded hover:bg-[#d6d6d6] dark:hover:bg-neutral-800 transition ${
                activeMenu === 'file' ? 'bg-[#d6d6d6] dark:bg-neutral-800 font-semibold' : ''
              }`}
            >
              File
            </button>
            {activeMenu === 'file' && (
              <div className="absolute left-0 top-full mt-0.5 w-52 bg-white dark:bg-[#141414] border border-[#b8b8b8] dark:border-neutral-800 rounded shadow-lg py-1 text-xs z-50">
                <button
                  onClick={() => handleAction(() => onSelectTab('text'))}
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center space-x-2"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
                  <span>Open Left / Right Files...</span>
                </button>
                <button
                  onClick={() => handleAction(() => onSelectTab('folder'))}
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between"
                >
                  <span className="flex items-center space-x-2">
                    <FolderGit2 className="w-3.5 h-3.5 text-amber-500" />
                    <span>Open Folders...</span>
                  </span>
                  {isWeb && (
                    <span className="px-1 py-0.2 text-[8px] font-semibold rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      App Only
                    </span>
                  )}
                </button>
                <div className="my-1 border-t border-neutral-200 dark:border-neutral-800" />
                <button
                  onClick={() => handleAction(() => onSelectTab('home'))}
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between"
                >
                  <span>Close Session</span>
                  <span className="text-[10px] opacity-60 font-mono">Esc</span>
                </button>
              </div>
            )}
          </div>

          {/* Edit Menu */}
          <div className="relative">
            <button
              onClick={() => handleMenuClick('edit')}
              className={`px-2 py-0.5 rounded hover:bg-[#d6d6d6] dark:hover:bg-neutral-800 transition ${
                activeMenu === 'edit' ? 'bg-[#d6d6d6] dark:bg-neutral-800 font-semibold' : ''
              }`}
            >
              Edit
            </button>
            {activeMenu === 'edit' && (
              <div className="absolute left-0 top-full mt-0.5 w-56 bg-white dark:bg-[#141414] border border-[#b8b8b8] dark:border-neutral-800 rounded shadow-lg py-1 text-xs z-50">
                <button
                  onClick={() =>
                    handleAction(() => {
                      const btn = document.querySelector('[data-action="copy-l2r"]') as HTMLElement;
                      if (btn) btn.click();
                    })
                  }
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between"
                >
                  <span className="flex items-center space-x-2">
                    <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
                    <span>Copy Left to Right</span>
                  </span>
                  <span className="text-[10px] opacity-60 font-mono">Alt+Right</span>
                </button>
                <button
                  onClick={() =>
                    handleAction(() => {
                      const btn = document.querySelector('[data-action="copy-r2l"]') as HTMLElement;
                      if (btn) btn.click();
                    })
                  }
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between"
                >
                  <span className="flex items-center space-x-2">
                    <ArrowLeft className="w-3.5 h-3.5 text-purple-500" />
                    <span>Copy Right to Left</span>
                  </span>
                  <span className="text-[10px] opacity-60 font-mono">Alt+Left</span>
                </button>
                <div className="my-1 border-t border-neutral-200 dark:border-neutral-800" />
                <button
                  onClick={() =>
                    handleAction(() => {
                      const btn = document.querySelector('[data-action="swap"]') as HTMLElement;
                      if (btn) btn.click();
                    })
                  }
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between"
                >
                  <span>Swap Sides</span>
                  <span className="text-[10px] opacity-60 font-mono">Ctrl+Shift+S</span>
                </button>
              </div>
            )}
          </div>

          {/* Search Menu */}
          <div className="relative">
            <button
              onClick={() => handleMenuClick('search')}
              className={`px-2 py-0.5 rounded hover:bg-[#d6d6d6] dark:hover:bg-neutral-800 transition ${
                activeMenu === 'search' ? 'bg-[#d6d6d6] dark:bg-neutral-800 font-semibold' : ''
              }`}
            >
              Search
            </button>
            {activeMenu === 'search' && (
              <div className="absolute left-0 top-full mt-0.5 w-52 bg-white dark:bg-[#141414] border border-[#b8b8b8] dark:border-neutral-800 rounded shadow-lg py-1 text-xs z-50">
                <button
                  onClick={() =>
                    handleAction(() => {
                      const btn = document.querySelector('[data-action="next-diff"]') as HTMLElement;
                      if (btn) btn.click();
                    })
                  }
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between"
                >
                  <span className="flex items-center space-x-2">
                    <ArrowDown className="w-3.5 h-3.5 text-red-500" />
                    <span>Next Difference</span>
                  </span>
                  <span className="text-[10px] opacity-60 font-mono">F7</span>
                </button>
                <button
                  onClick={() =>
                    handleAction(() => {
                      const btn = document.querySelector('[data-action="prev-diff"]') as HTMLElement;
                      if (btn) btn.click();
                    })
                  }
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between"
                >
                  <span className="flex items-center space-x-2">
                    <ArrowUp className="w-3.5 h-3.5 text-red-500" />
                    <span>Previous Difference</span>
                  </span>
                  <span className="text-[10px] opacity-60 font-mono">Shift+F7</span>
                </button>
              </div>
            )}
          </div>

          {/* View Menu */}
          <div className="relative">
            <button
              onClick={() => handleMenuClick('view')}
              className={`px-2 py-0.5 rounded hover:bg-[#d6d6d6] dark:hover:bg-neutral-800 transition ${
                activeMenu === 'view' ? 'bg-[#d6d6d6] dark:bg-neutral-800 font-semibold' : ''
              }`}
            >
              View
            </button>
            {activeMenu === 'view' && (
              <div className="absolute left-0 top-full mt-0.5 w-52 bg-white dark:bg-[#141414] border border-[#b8b8b8] dark:border-neutral-800 rounded shadow-lg py-1 text-xs z-50">
                <button
                  onClick={() =>
                    handleAction(() => {
                      const btn = document.querySelector('[data-action="filter-all"]') as HTMLElement;
                      if (btn) btn.click();
                    })
                  }
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center space-x-2"
                >
                  <span className="font-bold text-blue-500 w-4 text-center">*</span>
                  <span>Show All</span>
                </button>
                <button
                  onClick={() =>
                    handleAction(() => {
                      const btn = document.querySelector('[data-action="filter-diffs"]') as HTMLElement;
                      if (btn) btn.click();
                    })
                  }
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center space-x-2"
                >
                  <span className="font-bold text-red-500 w-4 text-center">≠</span>
                  <span>Show Differences Only</span>
                </button>
                <button
                  onClick={() =>
                    handleAction(() => {
                      const btn = document.querySelector('[data-action="filter-same"]') as HTMLElement;
                      if (btn) btn.click();
                    })
                  }
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center space-x-2"
                >
                  <span className="font-bold text-emerald-500 w-4 text-center">=</span>
                  <span>Show Same Only</span>
                </button>
                <div className="my-1 border-t border-neutral-200 dark:border-neutral-800" />
                <button
                  onClick={() => handleAction(onToggleTheme)}
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between"
                >
                  <span className="flex items-center space-x-2">
                    {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-blue-600" />}
                    <span>Theme: {theme === 'dark' ? 'Light Mode' : 'Dark Theme'}</span>
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Tools Menu */}
          <div className="relative">
            <button
              onClick={() => handleMenuClick('tools')}
              className={`px-2 py-0.5 rounded hover:bg-[#d6d6d6] dark:hover:bg-neutral-800 transition ${
                activeMenu === 'tools' ? 'bg-[#d6d6d6] dark:bg-neutral-800 font-semibold' : ''
              }`}
            >
              Tools
            </button>
            {activeMenu === 'tools' && (
              <div className="absolute left-0 top-full mt-0.5 w-52 bg-white dark:bg-[#141414] border border-[#b8b8b8] dark:border-neutral-800 rounded shadow-lg py-1 text-xs z-50">
                <button
                  onClick={() => handleAction(() => onSelectTab('settings'))}
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between"
                >
                  <span className="flex items-center space-x-2">
                    <Settings className="w-3.5 h-3.5" />
                    <span>Options & Rules...</span>
                  </span>
                  <span className="text-[10px] opacity-60 font-mono">Ctrl+5</span>
                </button>
              </div>
            )}
          </div>

          {/* Help Menu */}
          <div className="relative">
            <button
              onClick={() => handleMenuClick('help')}
              className={`px-2 py-0.5 rounded hover:bg-[#d6d6d6] dark:hover:bg-neutral-800 transition ${
                activeMenu === 'help' ? 'bg-[#d6d6d6] dark:bg-neutral-800 font-semibold' : ''
              }`}
            >
              Help
            </button>
            {activeMenu === 'help' && (
              <div className="absolute left-0 top-full mt-0.5 w-64 bg-white dark:bg-[#141414] border border-[#b8b8b8] dark:border-neutral-800 rounded shadow-lg py-1 text-xs z-50">
                <button
                  onClick={() => handleAction(onOpenShortcuts)}
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between"
                >
                  <span className="flex items-center space-x-2">
                    <Keyboard className="w-3.5 h-3.5 text-blue-500" />
                    <span>Keyboard Shortcuts</span>
                  </span>
                  <span className="text-[10px] opacity-60 font-mono">Cmd+/</span>
                </button>

                <button
                  onClick={() => handleAction(() => onSelectTab('settings'))}
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between"
                >
                  <span className="flex items-center space-x-2">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Open Source Libraries & Licenses</span>
                  </span>
                  <span className="text-[10px] opacity-60 font-mono">MIT/ISC</span>
                </button>

                <button
                  onClick={() => handleAction(() => onSelectTab('settings'))}
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between"
                >
                  <span className="flex items-center space-x-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                    <span>Security & Privacy Architecture</span>
                  </span>
                  <span className="text-[10px] opacity-60 font-mono">Air-gapped</span>
                </button>

                <button
                  onClick={() => handleAction(() => onSelectTab('settings'))}
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between"
                >
                  <span className="flex items-center space-x-2">
                    <Info className="w-3.5 h-3.5 text-neutral-400" />
                    <span>About mDiff Comparison Suite</span>
                  </span>
                </button>

                <div className="my-1 border-t border-neutral-200 dark:border-neutral-800" />
                <div className="px-3 py-1.5 text-[11px] text-neutral-500">
                  mDiff Comparison Suite v5.0.0<br />
                  Mavenir Internal Release • Developed by im_arg
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Controls: Keyboard Shortcuts + Theme Toggle (Pitch Black / Light) */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={onOpenShortcuts}
            title="Keyboard Shortcuts (Cmd+/)"
            className="p-1 rounded text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition"
          >
            <Keyboard className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onToggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light Mode' : 'Dark Theme'} mode`}
            className="flex items-center space-x-1.5 px-2 py-0.5 rounded text-xs bg-neutral-200 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:white transition shadow-xs"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-medium">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-[11px] font-medium">Dark Theme</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Beyond Compare Multi-Session Tab Bar (Matching Beyond Compare Reference) */}
      <div className="h-8 bg-[#e8e8e8] dark:bg-[#0c0c0c] border-b border-[#c8c8c8] dark:border-neutral-800 flex items-center justify-between px-1.5 overflow-x-auto select-none">
        {/* Dynamic Session Tabs */}
        <div className="flex items-center space-x-1 min-w-0">
          {sessionTabs && sessionTabs.length > 0 ? (
            sessionTabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  onClick={() => onSelectSessionTab(tab.id)}
                  className={`group flex items-center space-x-1.5 px-3 py-1 rounded text-xs transition cursor-pointer select-none max-w-xs border ${
                    isActive
                      ? tab.type === 'folder'
                        ? 'bg-white dark:bg-[#1a1a1a] text-blue-700 dark:text-blue-400 font-semibold shadow-xs border-b-2 border-b-blue-600 border-t-transparent border-x-transparent'
                        : 'bg-[#eefbf0] dark:bg-[#092b15] text-[#15803d] dark:text-[#4ade80] font-semibold shadow-xs border border-[#86efac] dark:border-[#22c55e]/50'
                      : 'bg-[#d8d8d8] dark:bg-[#141414] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 border-transparent hover:bg-[#cfcfcf] dark:hover:bg-neutral-800'
                  }`}
                  title={tab.title}
                >
                  {tab.type === 'folder' ? (
                    <FolderGit2 className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  ) : tab.type === 'structured' ? (
                    <Boxes className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <FileCode2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  )}

                  <span className="truncate max-w-[200px] font-sans text-xs">
                    {tab.title}
                  </span>

                  {tab.closable && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseSessionTab(tab.id);
                      }}
                      title="Close session"
                      className="ml-1 p-0.5 rounded text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-300 dark:hover:bg-neutral-700 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex items-center space-x-1">
              <button
                onClick={() => onSelectTab('folder')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs transition cursor-pointer ${
                  activeTab === 'folder'
                    ? 'bg-white dark:bg-[#1a1a1a] text-blue-600 dark:text-blue-400 font-semibold shadow-xs border-b-2 border-blue-500'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200/50 dark:hover:bg-neutral-900/50'
                }`}
              >
                <FolderGit2 className="w-3.5 h-3.5 text-amber-500" />
                <span>Folder Compare</span>
              </button>
              <button
                onClick={() => onSelectTab('text')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs transition cursor-pointer ${
                  activeTab === 'text'
                    ? 'bg-white dark:bg-[#1a1a1a] text-blue-600 dark:text-blue-400 font-semibold shadow-xs border-b-2 border-blue-500'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200/50 dark:hover:bg-neutral-900/50'
                }`}
              >
                <FileCode2 className="w-3.5 h-3.5 text-blue-500" />
                <span>Text Compare</span>
              </button>
            </div>
          )}

          {/* New Tab Button */}
          <button
            onClick={onNewSession}
            title="Open New Comparison Session (Ctrl+4)"
            className="p-1 px-2 rounded hover:bg-neutral-300 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition flex items-center space-x-1 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="text-[11px] font-sans hidden sm:inline">New Session</span>
          </button>
        </div>

        {/* Right Controls: Interactive Zoom & Preferences */}
        <div className="flex items-center space-x-2 pl-2">
          {/* Zoom Feature (Ctrl + Mouse Wheel / Buttons) */}
          <div className="flex items-center space-x-1 border border-neutral-300 dark:border-neutral-800 rounded px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-900 text-xs text-neutral-600 dark:text-neutral-300">
            <button
              onClick={onZoomOut}
              title="Zoom Out (Ctrl+- or Ctrl+Wheel Down)"
              className="p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <button
              onClick={onResetZoom}
              title="Reset Zoom to 100% (Ctrl+0)"
              className="px-1 text-[10px] font-mono hover:text-blue-600"
            >
              {zoomLevel}%
            </button>
            <button
              onClick={onZoomIn}
              title="Zoom In (Ctrl++ or Ctrl+Wheel Up)"
              className="p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>

          {/* Preferences Button */}
          <button
            onClick={() => onSelectTab('settings')}
            title="Preferences & Configuration Rules (Ctrl+5)"
            className={`flex items-center space-x-1 px-2 py-0.5 rounded text-xs transition cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-white dark:bg-[#151515] text-neutral-900 dark:text-white font-semibold shadow-xs'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200/50 dark:hover:bg-neutral-900/50'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Preferences</span>
          </button>
        </div>
      </div>
    </div>
  );
};
