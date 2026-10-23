import React from 'react';
import { AlertTriangle, ArrowRight, ShieldAlert, X } from 'lucide-react';

export interface ConfirmModalConfig {
  isOpen: boolean;
  title: string;
  actionType: 'copy-l2r' | 'copy-r2l' | 'save' | 'delete' | 'custom';
  sourcePath?: string;
  destinationPath?: string;
  isDestinationExisting?: boolean;
  message: string;
  detail?: string;
  requireBackupOption?: boolean;
  onConfirm: (options: { createBackup: boolean }) => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalConfig> = ({
  isOpen,
  title,
  sourcePath,
  destinationPath,
  isDestinationExisting,
  message,
  detail,
  requireBackupOption = true,
  onConfirm,
  onCancel,
}) => {
  const [createBackup, setCreateBackup] = React.useState(true);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-black border border-neutral-300 dark:border-neutral-800 rounded-lg max-w-lg w-full shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="bg-neutral-100 dark:bg-neutral-900 px-4 py-2.5 border-b border-neutral-300 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <h3 className="font-semibold text-xs text-neutral-900 dark:text-white">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="text-neutral-400 hover:text-neutral-800 dark:hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3.5 text-xs text-neutral-800 dark:text-neutral-200 font-sans">
          <p className="font-semibold text-xs">{message}</p>
          {detail && <p className="text-neutral-500 leading-relaxed text-[11px]">{detail}</p>}

          {/* Paths Preview */}
          {(sourcePath || destinationPath) && (
            <div className="bg-neutral-100 dark:bg-neutral-950 p-2.5 rounded border border-neutral-300 dark:border-neutral-800 font-mono text-[11px] space-y-1.5">
              {sourcePath && (
                <div>
                  <span className="text-neutral-500 text-[10px] block font-sans uppercase font-bold">
                    Source:
                  </span>
                  <span className="text-blue-600 dark:text-blue-400 break-all">{sourcePath}</span>
                </div>
              )}
              {sourcePath && destinationPath && (
                <div className="flex items-center text-neutral-400">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              )}
              {destinationPath && (
                <div>
                  <span className="text-neutral-500 text-[10px] block font-sans uppercase font-bold">
                    Destination:
                  </span>
                  <span className="text-purple-600 dark:text-purple-400 break-all">{destinationPath}</span>
                </div>
              )}
            </div>
          )}

          {/* Conflict Warning */}
          {isDestinationExisting && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 p-2 rounded flex items-start space-x-2 text-amber-800 dark:text-amber-300 text-xs">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Warning:</strong> Destination already exists. Confirming will overwrite the destination file.
              </span>
            </div>
          )}

          {/* Create safety backup checkbox */}
          {requireBackupOption && (
            <label className="flex items-center space-x-2 cursor-pointer select-none text-neutral-700 dark:text-neutral-300 text-xs">
              <input
                type="checkbox"
                checked={createBackup}
                onChange={(e) => setCreateBackup(e.target.checked)}
                className="rounded border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-blue-600 focus:ring-0"
              />
              <span>Create safety backup copy (.bak.timestamp) before overwriting</span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="bg-neutral-100 dark:bg-neutral-900 px-4 py-2 border-t border-neutral-300 dark:border-neutral-800 flex items-center justify-end space-x-2">
          <button
            onClick={onCancel}
            className="px-3 py-1 rounded text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm({ createBackup })}
            className="px-4 py-1 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition"
          >
            Confirm & Execute
          </button>
        </div>
      </div>
    </div>
  );
};
