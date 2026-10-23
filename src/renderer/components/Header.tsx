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
    { id: 'folder', label: 'Folder Compare', icon: <FolderGit2 className="w-4 h-4" /> },
    { id: 'text', label: 'Text Compare', icon: <FileCode2 className="w-4 h-4" /> },
    { id: 'structured', label: 'K8s & Config', icon: <Boxes className="w-4 h-4" /> },
    { id: 'home', label: 'Recent', icon: <Clock className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <header className="h-11 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3 select-none flex-shrink-0 z-20">
      {/* Left: Window spacer (for macOS traffic lights) + Brand logo */}
      <div className="flex items-center space-x-3 pl-16">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-xs text-white shadow">
            DX
          </div>
          <span className="font-semibold text-sm tracking-wide text-slate-100">DiffX</span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800/60">
            v1.0
          </span>
        </div>
      </div>

      {/* Center: Navigation Tabs */}
      <nav className="flex items-center space-x-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-slate-800 text-blue-400 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right: Quick actions (Shortcuts, Theme toggle) */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onOpenShortcuts}
          title="Keyboard Shortcuts (Cmd+/)"
          className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
        >
          <Keyboard className="w-4 h-4" />
        </button>

        <button
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} theme`}
          className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
        </button>
      </div>
    </header>
  );
};
