import React, { useState } from 'react';
import {
  Settings,
  Check,
  Save,
} from 'lucide-react';
import { AppSettings } from '@shared/types.js';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onClearHistory: () => void;
  onUpdateStatus: (text: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onClearHistory,
  onUpdateStatus,
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [ignorePatternsText, setIgnorePatternsText] = useState(
    settings.defaultIgnorePatterns.join(', ')
  );
  const [savedMessage, setSavedMessage] = useState(false);

  const handleSave = () => {
    const cleaned = ignorePatternsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const updated: AppSettings = {
      ...localSettings,
      defaultIgnorePatterns: cleaned,
    };
    onUpdateSettings(updated);
    setSavedMessage(true);
    onUpdateStatus('Preferences saved');
    setTimeout(() => setSavedMessage(false), 2500);
  };

  const thirdPartyLicenses = [
    { name: 'Monaco Editor', version: '^0.52.2', license: 'MIT', purpose: 'Syntax highlighting & core text diff engine' },
    { name: '@monaco-editor/react', version: '^4.7.0', license: 'MIT', purpose: 'React bridge for Monaco diff editor' },
    { name: 'React', version: '^19.0.0', license: 'MIT', purpose: 'Component-driven UI architecture' },
    { name: 'YAML', version: '^2.7.0', license: 'ISC', purpose: 'YAML parsing & AST semantic comparison' },
    { name: 'Lucide React', version: '^1.16.0', license: 'ISC', purpose: 'Accessible desktop UI iconography' },
    { name: 'Tailwind CSS', version: '^3.4.17', license: 'MIT', purpose: 'High-density design token styling' },
    { name: 'Electron', version: '^34.2.0', license: 'MIT', purpose: 'Native macOS & Windows desktop framework' },
    { name: 'Vitest', version: '^3.0.5', license: 'MIT', purpose: 'Deterministic unit testing engine' },
    { name: 'Vite', version: '^6.1.0', license: 'MIT', purpose: 'Renderer bundling & fast HMR' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-black overflow-y-auto p-6 text-neutral-900 dark:text-neutral-100 font-sans">
      <div className="max-w-3xl mx-auto w-full space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center space-x-2 font-semibold text-sm">
            <Settings className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Preferences & System Configuration</span>
          </div>
          <button
            onClick={handleSave}
            className="flex items-center space-x-1.5 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-sm transition"
          >
            {savedMessage ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            <span>{savedMessage ? 'Saved!' : 'Save Preferences'}</span>
          </button>
        </div>

        {/* 1. Comparison Engine Defaults */}
        <div className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-lg p-4 space-y-3.5">
          <h3 className="font-semibold text-xs uppercase tracking-wider text-neutral-500">
            Comparison Rules
          </h3>

          <div>
            <label className="block text-xs font-medium mb-1">
              Default Ignore Patterns:
            </label>
            <input
              type="text"
              value={ignorePatternsText}
              onChange={(e) => setIgnorePatternsText(e.target.value)}
              className="w-full bg-white dark:bg-black border border-neutral-300 dark:border-neutral-800 rounded px-2.5 py-1 font-mono text-xs focus:outline-none focus:border-blue-500 text-neutral-900 dark:text-neutral-100"
            />
            <span className="text-[11px] text-neutral-500 block mt-1">
              Glob patterns and directory names separated by commas.
            </span>
          </div>

          <div className="space-y-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <label className="flex items-center space-x-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={localSettings.caseSensitive}
                onChange={(e) =>
                  setLocalSettings((prev) => ({ ...prev, caseSensitive: e.target.checked }))
                }
                className="rounded border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-blue-600 w-3.5 h-3.5"
              />
              <span>Case-sensitive file name matching by default</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={localSettings.confirmDestructiveActions}
                onChange={(e) =>
                  setLocalSettings((prev) => ({
                    ...prev,
                    confirmDestructiveActions: e.target.checked,
                  }))
                }
                className="rounded border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-blue-600 w-3.5 h-3.5"
              />
              <span>Require explicit confirmation before copying or saving files</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={localSettings.createBackups}
                onChange={(e) =>
                  setLocalSettings((prev) => ({ ...prev, createBackups: e.target.checked }))
                }
                className="rounded border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-blue-600 w-3.5 h-3.5"
              />
              <span>Create safety backup copy (.bak.timestamp) when replacing existing files</span>
            </label>
          </div>
        </div>

        {/* 2. Privacy & History */}
        <div className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-lg p-4 space-y-3.5">
          <h3 className="font-semibold text-xs uppercase tracking-wider text-neutral-500">
            Privacy & History
          </h3>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium block">
                Save Recent Comparison Paths
              </span>
              <span className="text-[11px] text-neutral-500 block">
                DiffX only stores paths and timestamps locally. File contents are never stored.
              </span>
            </div>
            <input
              type="checkbox"
              checked={localSettings.enableHistory}
              onChange={(e) =>
                setLocalSettings((prev) => ({ ...prev, enableHistory: e.target.checked }))
              }
              className="rounded border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-blue-600 w-4 h-4"
            />
          </div>

          <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <span className="text-xs text-neutral-500">Clear stored comparison history paths:</span>
            <button
              onClick={() => {
                onClearHistory();
                onUpdateStatus('Comparison history cleared');
              }}
              className="px-2.5 py-1 rounded text-xs bg-white dark:bg-neutral-900 hover:bg-red-50 dark:hover:bg-red-950/40 text-neutral-700 dark:text-neutral-300 hover:text-red-600 border border-neutral-300 dark:border-neutral-800 transition"
            >
              Clear History Now
            </button>
          </div>
        </div>

        {/* 3. Licenses */}
        <div className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-xs uppercase tracking-wider text-neutral-500">
              Open-Source Dependencies
            </h3>
            <span className="text-[11px] font-mono text-neutral-500">All MIT / ISC Compatible</span>
          </div>

          <div className="divide-y divide-neutral-200 dark:divide-neutral-800 text-xs">
            {thirdPartyLicenses.map((dep) => (
              <div key={dep.name} className="py-2 flex items-center justify-between">
                <div>
                  <span className="font-medium text-neutral-900 dark:text-white">{dep.name}</span>
                  <span className="text-neutral-500 font-mono text-[11px] ml-2">{dep.version}</span>
                  <span className="text-neutral-500 block text-[11px] mt-0.5">{dep.purpose}</span>
                </div>
                <span className="px-1.5 py-0.2 rounded font-mono text-[10px] font-bold bg-neutral-200 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-800">
                  {dep.license}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 4. About & System Information */}
        <div className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-xs uppercase tracking-wider text-neutral-500">
            About DiffX
          </h3>
          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="font-medium text-neutral-900 dark:text-white">DiffX Comparison Suite</span>
              <span className="text-neutral-500 block text-[11px] mt-0.5">Developed by IM_ARG</span>
            </div>
            <span className="px-2 py-0.5 rounded font-mono text-[11px] font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              v3.0.0
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
