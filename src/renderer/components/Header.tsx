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
} from 'lucide-react';

export type NavigationTab = 'folder' | 'text' | 'structured' | 'home' | 'settings';

interface HeaderProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenShortcuts: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  theme,
  onToggleTheme,
  onOpenShortcuts,
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

  const tabs: { id: NavigationTab; label: string; icon: React.ReactNode }[] = [
    { id: 'folder', label: 'Folder Compare', icon: <FolderGit2 className="w-3.5 h-3.5" /> },
    { id: 'text', label: 'Text Compare', icon: <FileCode2 className="w-3.5 h-3.5" /> },
    { id: 'structured', label: 'Config & XML', icon: <Boxes className="w-3.5 h-3.5" /> },
    { id: 'home', label: 'Sessions', icon: <Clock className="w-3.5 h-3.5" /> },
    { id: 'settings', label: 'Preferences', icon: <Settings className="w-3.5 h-3.5" /> },
  ];

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
          {/* Logo badge */}
          <div className="flex items-center space-x-1.5 mr-2 pl-1">
            <span className="w-3.5 h-3.5 rounded bg-blue-600 text-white font-bold text-[9px] flex items-center justify-center">
              DX
            </span>
            <span className="font-bold text-[11px] tracking-tight text-neutral-900 dark:text-neutral-100">
              DiffX
            </span>
          </div>

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
              <div className="absolute left-0 top-full mt-0.5 w-56 bg-white dark:bg-[#141414] border border-[#b8b8b8] dark:border-neutral-800 rounded shadow-lg py-1 text-xs z-50">
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
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center space-x-2"
                >
                  <FolderGit2 className="w-3.5 h-3.5 text-amber-500" />
                  <span>Open Folders...</span>
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
                    <span>Theme: {theme === 'dark' ? 'Light Mode' : 'Pitch Black'}</span>
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
              <div className="absolute left-0 top-full mt-0.5 w-56 bg-white dark:bg-[#141414] border border-[#b8b8b8] dark:border-neutral-800 rounded shadow-lg py-1 text-xs z-50">
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
                <div className="my-1 border-t border-neutral-200 dark:border-neutral-800" />
                <div className="px-3 py-1.5 text-[11px] text-neutral-500">
                  DiffX Comparison Suite v1.2<br />
                  Beyond Compare 5 Alignment
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right side status / hint */}
        <div className="flex items-center space-x-2 text-[10px] text-neutral-500">
          <span className="font-mono">Beyond Compare Layout</span>
        </div>
      </div>

      {/* 2. Beyond Compare Session Tabs Row */}
      <div className="h-9 px-2 flex items-end justify-between bg-[#f0f0f0] dark:bg-black pt-1">
        {/* Navigation Tabs */}
        <nav className="flex items-end space-x-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs rounded-t-md transition border-t border-l border-r ${
                  isActive
                    ? 'bg-white dark:bg-[#111111] text-blue-600 dark:text-blue-400 font-semibold border-[#c4c4c4] dark:border-neutral-700 -mb-px z-10 shadow-sm'
                    : 'bg-[#e2e2e2] dark:bg-[#181818] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 border-[#d0d0d0] dark:border-neutral-800'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Controls: Keyboard Shortcuts + Theme Toggle (Pitch Black / Light) */}
        <div className="flex items-center space-x-2 pb-1.5">
          <button
            onClick={onOpenShortcuts}
            title="Keyboard Shortcuts (Cmd+/)"
            className="p-1 rounded text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-900 transition"
          >
            <Keyboard className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onToggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light Mode' : 'Pitch Black'} mode`}
            className="flex items-center space-x-1.5 px-2 py-0.5 rounded text-xs bg-neutral-200 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition shadow-sm"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-medium">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-[11px] font-medium">Pitch Black</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
