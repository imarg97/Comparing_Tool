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
    onUpdateStatus('Settings saved successfully');
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
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-y-auto p-8 text-slate-200">
      <div className="max-w-3xl mx-auto w-full space-y-8">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2 text-slate-100 font-semibold text-base">
            <Settings className="w-5 h-5 text-blue-400" />
            <span>Preferences & System Configuration</span>
          </div>
          <button
            onClick={handleSave}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow transition"
          >
            {savedMessage ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            <span>{savedMessage ? 'Saved!' : 'Save Preferences'}</span>
          </button>
        </div>

        {/* 1. Comparison Engine Defaults */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
          <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-400">
            Comparison Engine Defaults
          </h3>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Default Ignore Patterns:
            </label>
            <input
              type="text"
              value={ignorePatternsText}
              onChange={(e) => setIgnorePatternsText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 font-mono text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
            <span className="text-[11px] text-slate-500 block mt-1">
              Glob patterns and directory names separated by commas.
            </span>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <label className="flex items-center space-x-2 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={localSettings.caseSensitive}
                onChange={(e) =>
                  setLocalSettings((prev) => ({ ...prev, caseSensitive: e.target.checked }))
                }
                className="rounded border-slate-700 bg-slate-800 text-blue-600 w-3.5 h-3.5"
              />
              <span>Case-sensitive file name matching by default</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={localSettings.confirmDestructiveActions}
                onChange={(e) =>
                  setLocalSettings((prev) => ({
                    ...prev,
                    confirmDestructiveActions: e.target.checked,
                  }))
                }
                className="rounded border-slate-700 bg-slate-800 text-blue-600 w-3.5 h-3.5"
              />
              <span>Require explicit confirmation before overwriting or copying files (Safety Guard)</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={localSettings.createBackups}
                onChange={(e) =>
                  setLocalSettings((prev) => ({ ...prev, createBackups: e.target.checked }))
                }
                className="rounded border-slate-700 bg-slate-800 text-blue-600 w-3.5 h-3.5"
              />
              <span>Automatically create safety backup (.bak.timestamp) when replacing existing files</span>
            </label>
          </div>
        </div>

        {/* 2. Privacy & History */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
          <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-400">
            Privacy & Comparison History
          </h3>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-slate-200 block">
                Save Recent Comparison Paths
              </span>
              <span className="text-[11px] text-slate-400 block">
                DiffX only stores paths and timestamps locally on your machine. File contents are never stored in history.
              </span>
            </div>
            <input
              type="checkbox"
              checked={localSettings.enableHistory}
              onChange={(e) =>
                setLocalSettings((prev) => ({ ...prev, enableHistory: e.target.checked }))
              }
              className="rounded border-slate-700 bg-slate-800 text-blue-600 w-4 h-4"
            />
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <span className="text-xs text-slate-400">Clear stored comparison history paths:</span>
            <button
              onClick={() => {
                onClearHistory();
                onUpdateStatus('Comparison history cleared');
              }}
              className="px-3 py-1 rounded text-xs bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-300 border border-slate-700 transition"
            >
              Clear History Now
            </button>
          </div>
        </div>

        {/* 3. Third-Party Licenses Inventory */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-400">
              Third-Party Dependencies & Open-Source Licenses
            </h3>
            <span className="text-[11px] font-mono text-slate-500">All MIT / ISC Compatible</span>
          </div>

          <div className="divide-y divide-slate-800/80 text-xs">
            {thirdPartyLicenses.map((dep) => (
              <div key={dep.name} className="py-2 flex items-center justify-between">
                <div>
                  <span className="font-medium text-slate-200">{dep.name}</span>
                  <span className="text-slate-500 font-mono text-[11px] ml-2">{dep.version}</span>
                  <span className="text-slate-400 block text-[11px] mt-0.5">{dep.purpose}</span>
                </div>
                <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-blue-950 text-blue-400 border border-blue-900">
                  {dep.license}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
