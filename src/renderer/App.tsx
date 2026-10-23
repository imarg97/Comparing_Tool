import React, { useState, useEffect } from 'react';
import { Header, NavigationTab } from './components/Header.js';
import { StatusBar } from './components/StatusBar.js';
import { ConfirmModal, ConfirmModalConfig } from './components/ConfirmModal.js';
import { ShortcutsModal } from './components/ShortcutsModal.js';
import { FolderCompareView } from './views/FolderCompare/FolderCompareView.js';
import { TextCompareView } from './views/TextCompare/TextCompareView.js';
import { StructuredCompareView } from './views/StructuredCompare/StructuredCompareView.js';
import { HomeView } from './views/Home/HomeView.js';
import { SettingsView } from './views/Settings/SettingsView.js';
import { AppSettings, RecentComparison } from '@shared/types.js';

export const App: React.FC = () => {
  // Navigation & Theme
  const [activeTab, setActiveTab] = useState<NavigationTab>('folder');

  // Initialize theme from storage (default to 'dark' pitch black)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('diffx_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // ignore
    }
    return 'dark';
  });

  // Synchronize <html> root class for Tailwind and body background immediately
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      root.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    try {
      localStorage.setItem('diffx_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Shared Path State across Views
  const [folderLeftPath, setFolderLeftPath] = useState('');
  const [folderRightPath, setFolderRightPath] = useState('');
  const [textLeftPath, setTextLeftPath] = useState('');
  const [textRightPath, setTextRightPath] = useState('');

  // Status Bar State
  const [statusText, setStatusText] = useState('DiffX Ready');
  const [statusItemCount, setStatusItemCount] = useState<number | undefined>(undefined);
  const [statusDuration, setStatusDuration] = useState<number | undefined>(undefined);

  // Modals
  const [confirmConfig, setConfirmConfig] = useState<ConfirmModalConfig>({
    isOpen: false,
    title: '',
    actionType: 'custom',
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
  });
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // App Settings
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('diffx_settings');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {
      theme: 'dark',
      defaultIgnorePatterns: ['.git', 'node_modules', '.DS_Store', '*.log', 'dist'],
      caseSensitive: true,
      confirmDestructiveActions: true,
      createBackups: true,
      enableHistory: true,
    };
  });

  // Recent History
  const [recentList, setRecentList] = useState<RecentComparison[]>(() => {
    try {
      const saved = localStorage.getItem('diffx_recent');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });

  // Persist settings
  useEffect(() => {
    try {
      localStorage.setItem('diffx_settings', JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  // Persist recent comparisons (only paths & timestamps, never file contents)
  useEffect(() => {
    if (settings.enableHistory) {
      try {
        localStorage.setItem('diffx_recent', JSON.stringify(recentList));
      } catch {
        // ignore
      }
    }
  }, [recentList, settings.enableHistory]);

  const addRecent = (type: 'folder' | 'text' | 'structured', left: string, right: string) => {
    if (!settings.enableHistory || !left || !right) return;
    setRecentList((prev) => {
      const filtered = prev.filter(
        (item) => !(item.type === type && item.leftPath === left && item.rightPath === right)
      );
      return [
        {
          id: `${Date.now()}_${Math.random()}`,
          type,
          leftPath: left,
          rightPath: right,
          timestamp: Date.now(),
        },
        ...filtered.slice(0, 19),
      ];
    });
  };

  const handleOpenRecent = (item: RecentComparison) => {
    if (item.type === 'folder') {
      setFolderLeftPath(item.leftPath);
      setFolderRightPath(item.rightPath);
      setActiveTab('folder');
    } else if (item.type === 'text') {
      setTextLeftPath(item.leftPath);
      setTextRightPath(item.rightPath);
      setActiveTab('text');
    } else {
      setActiveTab('structured');
    }
  };

  const handleClearRecent = () => {
    setRecentList([]);
    try {
      localStorage.removeItem('diffx_recent');
    } catch {
      // ignore
    }
  };

  const handleOpenInTextCompare = (left: string, right: string) => {
    setTextLeftPath(left);
    setTextRightPath(right);
    addRecent('text', left, right);
    setActiveTab('text');
  };

  const handleUpdateStatus = (text: string, count?: number, durationMs?: number) => {
    setStatusText(text);
    setStatusItemCount(count);
    setStatusDuration(durationMs);
  };

  // Global Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        if (e.key === '1') {
          e.preventDefault();
          setActiveTab('folder');
        } else if (e.key === '2') {
          e.preventDefault();
          setActiveTab('text');
        } else if (e.key === '3') {
          e.preventDefault();
          setActiveTab('structured');
        } else if (e.key === '4') {
          e.preventDefault();
          setActiveTab('home');
        } else if (e.key === '5') {
          e.preventDefault();
          setActiveTab('settings');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={`h-full w-full flex flex-col bg-white dark:bg-black text-neutral-900 dark:text-neutral-100 ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Header Shell */}
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 flex flex-col min-h-0 relative bg-white dark:bg-black">
        {activeTab === 'folder' && (
          <FolderCompareView
            leftFolder={folderLeftPath}
            rightFolder={folderRightPath}
            onSetLeftFolder={(path) => {
              setFolderLeftPath(path);
              if (path && folderRightPath) addRecent('folder', path, folderRightPath);
            }}
            onSetRightFolder={(path) => {
              setFolderRightPath(path);
              if (folderLeftPath && path) addRecent('folder', folderLeftPath, path);
            }}
            onOpenInTextCompare={handleOpenInTextCompare}
            onRequestConfirm={(cfg) => setConfirmConfig(cfg)}
            onUpdateStatus={handleUpdateStatus}
          />
        )}

        {activeTab === 'text' && (
          <TextCompareView
            leftPath={textLeftPath}
            rightPath={textRightPath}
            theme={theme}
            onSetLeftPath={(path) => {
              setTextLeftPath(path);
              if (path && textRightPath) addRecent('text', path, textRightPath);
            }}
            onSetRightPath={(path) => {
              setTextRightPath(path);
              if (textLeftPath && path) addRecent('text', textLeftPath, path);
            }}
            onRequestConfirm={(cfg) => setConfirmConfig(cfg)}
            onUpdateStatus={handleUpdateStatus}
          />
        )}

        {activeTab === 'structured' && (
          <StructuredCompareView
            theme={theme}
            onUpdateStatus={handleUpdateStatus}
          />
        )}

        {activeTab === 'home' && (
          <HomeView
            onNavigate={setActiveTab}
            recentList={recentList}
            onOpenRecent={handleOpenRecent}
            onClearRecent={handleClearRecent}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdateSettings={setSettings}
            onClearHistory={handleClearRecent}
            onUpdateStatus={handleUpdateStatus}
          />
        )}
      </main>

      {/* Global Status Bar */}
      <StatusBar
        statusText={statusText}
        itemCount={statusItemCount}
        durationMs={statusDuration}
      />

      {/* Safe Confirmation Modal */}
      <ConfirmModal
        {...confirmConfig}
        onConfirm={(options) => {
          confirmConfig.onConfirm(options);
          setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        }}
        onCancel={() => {
          confirmConfig.onCancel();
          setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        }}
      />

      {/* Keyboard Shortcuts Reference Modal */}
      <ShortcutsModal
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
};

export default App;
