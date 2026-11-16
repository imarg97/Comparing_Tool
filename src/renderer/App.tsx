import React, { useState, useEffect } from 'react';
import { Header, NavigationTab } from './components/Header.js';
import { StatusBar } from './components/StatusBar.js';
import { ConfirmModal, ConfirmModalConfig } from './components/ConfirmModal.js';
import { ShortcutsModal } from './components/ShortcutsModal.js';
import { WebFolderNoticeModal } from './components/WebFolderNoticeModal.js';
import { FolderCompareView } from './views/FolderCompare/FolderCompareView.js';
import { TextCompareView } from './views/TextCompare/TextCompareView.js';
import { StructuredCompareView } from './views/StructuredCompare/StructuredCompareView.js';
import { HomeView } from './views/Home/HomeView.js';
import { SettingsView } from './views/Settings/SettingsView.js';
import { AppSettings, RecentComparison, SessionTab } from '@shared/types.js';
import { isBrowserEnvironment } from './utils/browser-api.js';

export const App: React.FC = () => {
  // Environment Detection (Desktop vs Web Browser)
  const [isWeb, setIsWeb] = useState<boolean>(() => isBrowserEnvironment());

  useEffect(() => {
    if (window.diffxAPI?.getPlatform) {
      window.diffxAPI.getPlatform().then((p) => {
        setIsWeb(p === 'browser');
      });
    }
  }, []);

  // Navigation & Theme (defaults to Beyond Compare Home Screen Dashboard on application launch)
  const [activeTab, setActiveTab] = useState<NavigationTab>('home');

  // Dynamic Beyond Compare Multi-Session Tabs State
  const [sessionTabs, setSessionTabs] = useState<SessionTab[]>([
    {
      id: 'session-home',
      type: 'home',
      title: 'Home',
      closable: false,
    },
    {
      id: 'folder-main',
      type: 'folder',
      title: 'Folder Compare',
      closable: false,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('session-home');
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Dynamic file status map (tracks live differences made identical/modified: relativePath/filename -> isIdentical)
  const [dynamicFileStatusMap, setDynamicFileStatusMap] = useState<Record<string, boolean>>({});

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
  const [structuredLeftPath, setStructuredLeftPath] = useState('');
  const [structuredRightPath, setStructuredRightPath] = useState('');

  // Status Bar State
  const [statusText, setStatusText] = useState('mDiff Ready');
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
  const [webFolderModalOpen, setWebFolderModalOpen] = useState(false);

  const handleSelectTab = (tab: NavigationTab) => {
    if (tab === 'folder' && isWeb) {
      setWebFolderModalOpen(true);
      return;
    }
    setActiveTab(tab);
  };

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
      if (isWeb) {
        setWebFolderModalOpen(true);
        return;
      }
      setFolderLeftPath(item.leftPath);
      setFolderRightPath(item.rightPath);
      setActiveTab('folder');
      setActiveTabId('folder-main');
    } else if (item.type === 'text') {
      setTextLeftPath(item.leftPath);
      setTextRightPath(item.rightPath);
      setActiveTab('text');
      handleOpenInTextCompare(item.leftPath, item.rightPath);
    } else {
      setStructuredLeftPath(item.leftPath);
      setStructuredRightPath(item.rightPath);
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

  // Synchronize folder-main tab title when folders are selected
  useEffect(() => {
    setSessionTabs((prev) =>
      prev.map((tab) => {
        if (tab.id === 'folder-main') {
          let title = 'Folder Compare';
          if (folderLeftPath || folderRightPath) {
            const leftBase = folderLeftPath ? folderLeftPath.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || folderLeftPath : 'Left';
            const rightBase = folderRightPath ? folderRightPath.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || folderRightPath : 'Right';
            title = `${leftBase} <-> ${rightBase}`;
          }
          return { ...tab, title };
        }
        return tab;
      })
    );
  }, [folderLeftPath, folderRightPath]);

  const handleSelectSessionTab = (id: string) => {
    const tab = sessionTabs.find((t) => t.id === id);
    if (!tab) return;
    if (tab.type === 'folder' && isWeb) {
      setWebFolderModalOpen(true);
      return;
    }
    setActiveTabId(id);
    setActiveTab(tab.type);
    if (tab.type === 'text' && tab.leftPath && tab.rightPath) {
      setTextLeftPath(tab.leftPath);
      setTextRightPath(tab.rightPath);
    } else if (tab.type === 'structured' && tab.leftPath && tab.rightPath) {
      setStructuredLeftPath(tab.leftPath);
      setStructuredRightPath(tab.rightPath);
    }
  };

  const handleCloseSessionTab = (id: string) => {
    setSessionTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      const filtered = prev.filter((t) => t.id !== id);
      if (activeTabId === id) {
        const nextActive = filtered[Math.max(0, idx - 1)] || filtered[0];
        if (nextActive) {
          setActiveTabId(nextActive.id);
          setActiveTab(nextActive.type);
          if (nextActive.type === 'text' && nextActive.leftPath && nextActive.rightPath) {
            setTextLeftPath(nextActive.leftPath);
            setTextRightPath(nextActive.rightPath);
          }
        }
      }
      return filtered;
    });
  };

  const handleNewSession = () => {
    setActiveTab('home');
  };

  const handleZoomIn = () => setZoomLevel((z) => Math.min(z + 10, 200));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z - 10, 70));
  const handleResetZoom = () => setZoomLevel(100);

  // Global Ctrl + Mouse Wheel Zoom
  useEffect(() => {
    const handleGlobalWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          setZoomLevel((z) => Math.min(z + 5, 200));
        } else if (e.deltaY > 0) {
          setZoomLevel((z) => Math.max(z - 5, 70));
        }
      }
    };
    window.addEventListener('wheel', handleGlobalWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleGlobalWheel);
  }, []);

  const handleOpenInTextCompare = (left: string, right: string) => {
    setTextLeftPath(left);
    setTextRightPath(right);
    addRecent('text', left, right);
    setActiveTab('text');

    const leftName = left.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || '';
    const rightName = right.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || '';
    const fileName =
      leftName && rightName && leftName !== rightName
        ? `${leftName} ↔ ${rightName}`
        : leftName || rightName || 'values.yaml';

    setSessionTabs((prev) => {
      const existing = prev.find((t) => t.leftPath === left && t.rightPath === right);
      if (existing) {
        setActiveTabId(existing.id);
        return prev;
      }
      const newTab: SessionTab = {
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'text',
        title: fileName,
        leftPath: left,
        rightPath: right,
        closable: true,
      };
      setActiveTabId(newTab.id);
      return [...prev, newTab];
    });
  };

  const handleFileComparisonStatusChange = (leftPath: string, rightPath: string, isIdentical: boolean) => {
    let rel = '';
    if (folderLeftPath) {
      const normLeftRoot = folderLeftPath.replace(/[\\/]+$/, '').replace(/\\/g, '/');
      const normLeft = leftPath.replace(/\\/g, '/');
      if (normLeft.startsWith(normLeftRoot)) {
        rel = normLeft.slice(normLeftRoot.length).replace(/^[/\\]+/, '');
      }
    }
    if (!rel && folderRightPath) {
      const normRightRoot = folderRightPath.replace(/[\\/]+$/, '').replace(/\\/g, '/');
      const normRight = rightPath.replace(/\\/g, '/');
      if (normRight.startsWith(normRightRoot)) {
        rel = normRight.slice(normRightRoot.length).replace(/^[/\\]+/, '');
      }
    }
    const leftBase = leftPath.split(/[\\/]/).pop() || '';
    const rightBase = rightPath.split(/[\\/]/).pop() || '';

    setDynamicFileStatusMap((prev) => {
      const next = { ...prev };
      if (rel) next[rel] = isIdentical;
      if (leftBase) next[leftBase] = isIdentical;
      if (rightBase) next[rightBase] = isIdentical;
      return next;
    });
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
      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        handleZoomIn();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        handleZoomOut();
      } else if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        handleResetZoom();
      }
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        if (e.key === '1') {
          e.preventDefault();
          if (isWeb) {
            setWebFolderModalOpen(true);
          } else {
            setActiveTab('folder');
          }
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
  }, [isWeb]);

  return (
    <div className={`h-full w-full flex flex-col bg-white dark:bg-black text-neutral-900 dark:text-neutral-100 ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Header Shell */}
      <Header
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        sessionTabs={sessionTabs}
        activeTabId={activeTabId}
        onSelectSessionTab={handleSelectSessionTab}
        onCloseSessionTab={handleCloseSessionTab}
        onNewSession={handleNewSession}
        isWeb={isWeb}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        zoomLevel={zoomLevel}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 flex flex-col min-h-0 relative bg-white dark:bg-black">
        {/* Persistent Folder Compare Workspace (Kept in memory, zero-latency session switching without reloading) */}
        <div className={`flex-1 flex flex-col min-h-0 ${activeTab === 'folder' ? '' : 'hidden'}`}>
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
            onNavigateHome={() => setActiveTab('home')}
            onRequestConfirm={(cfg) => setConfirmConfig(cfg)}
            onUpdateStatus={handleUpdateStatus}
            isWeb={isWeb}
            onNavigateTab={handleSelectTab}
            onShowWebNotice={() => setWebFolderModalOpen(true)}
            zoomLevel={zoomLevel}
            onSetZoomLevel={setZoomLevel}
            dynamicFileStatusMap={dynamicFileStatusMap}
          />
        </div>

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
            onNavigateHome={() => setActiveTab('home')}
            onRequestConfirm={(cfg) => setConfirmConfig(cfg)}
            onUpdateStatus={handleUpdateStatus}
            onFileStatusChange={handleFileComparisonStatusChange}
          />
        )}

        {activeTab === 'structured' && (
          <StructuredCompareView
            leftPath={structuredLeftPath}
            rightPath={structuredRightPath}
            theme={theme}
            onSetLeftPath={(path) => {
              setStructuredLeftPath(path);
              if (path && structuredRightPath) addRecent('structured', path, structuredRightPath);
            }}
            onSetRightPath={(path) => {
              setStructuredRightPath(path);
              if (structuredLeftPath && path) addRecent('structured', structuredLeftPath, path);
            }}
            onNavigateHome={() => setActiveTab('home')}
            onRequestConfirm={(cfg) => setConfirmConfig(cfg)}
            onUpdateStatus={handleUpdateStatus}
          />
        )}

        {activeTab === 'home' && (
          <HomeView
            onNavigate={handleSelectTab}
            recentList={recentList}
            onOpenRecent={handleOpenRecent}
            onClearRecent={handleClearRecent}
            isWeb={isWeb}
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

      {/* Web Folder Notice Modal */}
      <WebFolderNoticeModal
        isOpen={webFolderModalOpen}
        onClose={() => setWebFolderModalOpen(false)}
        onSwitchTab={(tab) => {
          setWebFolderModalOpen(false);
          setActiveTab(tab);
        }}
      />
    </div>
  );
};

export default App;
