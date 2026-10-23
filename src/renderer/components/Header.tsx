import React from 'react';
import {
  FolderGit2,
  FileCode2,
  Boxes,
  Clock,
  Settings,
  Sun,
  Moon,
  Keyboard,
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
  const tabs: { id: NavigationTab; label: string; icon: React.ReactNode }[] = [
    { id: 'folder', label: 'Folder Compare', icon: <FolderGit2 className="w-3.5 h-3.5" /> },
    { id: 'text', label: 'Text Compare', icon: <FileCode2 className="w-3.5 h-3.5" /> },
    { id: 'structured', label: 'K8s & Config', icon: <Boxes className="w-3.5 h-3.5" /> },
    { id: 'home', label: 'Recent Sessions', icon: <Clock className="w-3.5 h-3.5" /> },
    { id: 'settings', label: 'Preferences', icon: <Settings className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="h-10 bg-neutral-100 dark:bg-black border-b border-neutral-300 dark:border-neutral-800 flex items-center justify-between px-3 select-none flex-shrink-0 z-20">
      {/* Left: Window spacer (for macOS traffic lights) + Brand logo */}
      <div className="flex items-center space-x-3 pl-16">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center font-bold text-[10px] text-white shadow">
            DX
          </div>
          <span className="font-semibold text-xs tracking-wide text-neutral-900 dark:text-neutral-100">
            DiffX
          </span>
          <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-neutral-200 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-800">
            Suite
          </span>
        </div>
      </div>

      {/* Center: Beyond Compare-style Session Tabs */}
      <nav className="flex items-center space-x-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs transition-colors ${
                isActive
                  ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 shadow-sm border border-neutral-300 dark:border-neutral-700 font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200/60 dark:hover:bg-neutral-900/60 font-medium'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right: Actions (Keyboard shortcuts & Theme Toggle) */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onOpenShortcuts}
          title="Keyboard Shortcuts (Cmd+/)"
          className="p-1 rounded text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-900 transition"
        >
          <Keyboard className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Pitch Black'} mode`}
          className="flex items-center space-x-1 px-2 py-0.5 rounded text-xs bg-neutral-200 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-medium">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-[11px] font-medium">Dark</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
