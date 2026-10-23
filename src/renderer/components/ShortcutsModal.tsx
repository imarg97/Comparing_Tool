import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Cmd/Ctrl + R', desc: 'Refresh active comparison' },
    { key: 'Cmd/Ctrl + Alt + S', desc: 'Swap Left and Right sides' },
    { key: 'F7  or  Alt + Down', desc: 'Navigate to next difference' },
    { key: 'Shift + F7  or  Alt + Up', desc: 'Navigate to previous difference' },
    { key: 'Cmd/Ctrl + Alt + →', desc: 'Copy selected change Left to Right' },
    { key: 'Cmd/Ctrl + Alt + ←', desc: 'Copy selected change Right to Left' },
    { key: 'Cmd/Ctrl + S', desc: 'Save changes in editor (with confirmation)' },
    { key: 'Cmd/Ctrl + F', desc: 'Search within diff or filter files' },
    { key: 'Cmd/Ctrl + /', desc: 'Open Keyboard Shortcuts cheat sheet' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-md w-full shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
        <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-100 font-semibold text-sm">
            <Keyboard className="w-4 h-4 text-blue-400" />
            <span>Keyboard Shortcuts</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2.5 text-xs">
          {shortcuts.map((sc) => (
            <div
              key={sc.key}
              className="flex items-center justify-between py-1.5 border-b border-slate-800/80"
            >
              <span className="text-slate-300">{sc.desc}</span>
              <kbd className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[11px] border border-slate-700">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="bg-slate-800/40 px-4 py-2.5 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
