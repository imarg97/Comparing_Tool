import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Cmd/Ctrl + R', desc: 'Refresh / Re-compare active folders' },
    { key: 'Cmd/Ctrl + Alt + S', desc: 'Swap Left and Right sides' },
    { key: 'F7  or  Alt + Down', desc: 'Jump to Next Difference' },
    { key: 'Shift + F7  or  Alt + Up', desc: 'Jump to Previous Difference' },
    { key: 'Cmd/Ctrl + Alt + →', desc: 'Copy selected change Left to Right' },
    { key: 'Cmd/Ctrl + Alt + ←', desc: 'Copy selected change Right to Left' },
    { key: 'Cmd/Ctrl + S', desc: 'Save changes in editor (with confirmation)' },
    { key: 'Cmd/Ctrl + F', desc: 'Search within diff or filter files' },
    { key: 'Cmd/Ctrl + /', desc: 'Open Keyboard Shortcuts cheat sheet' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-black border border-neutral-300 dark:border-neutral-800 rounded-lg max-w-md w-full shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
        <div className="bg-neutral-100 dark:bg-neutral-900 px-4 py-2.5 border-b border-neutral-300 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-neutral-900 dark:text-neutral-100 font-semibold text-xs">
            <Keyboard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Keyboard Shortcuts</span>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-800 dark:hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2 text-xs">
          {shortcuts.map((sc) => (
            <div
              key={sc.key}
              className="flex items-center justify-between py-1 border-b border-neutral-200 dark:border-neutral-900"
            >
              <span className="text-neutral-700 dark:text-neutral-300">{sc.desc}</span>
              <kbd className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 font-mono text-[11px] border border-neutral-300 dark:border-neutral-800">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="bg-neutral-100 dark:bg-neutral-900 px-4 py-2 border-t border-neutral-300 dark:border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1 rounded text-xs bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
