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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-lg w-full shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-amber-400">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <h3 className="font-semibold text-sm text-slate-100">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 text-xs text-slate-300">
          <p className="text-slate-200 font-medium text-sm">{message}</p>
          {detail && <p className="text-slate-400 leading-relaxed">{detail}</p>}

          {/* Paths Preview */}
          {(sourcePath || destinationPath) && (
            <div className="bg-slate-950 p-3 rounded border border-slate-800 font-mono text-[11px] space-y-2">
              {sourcePath && (
                <div>
                  <span className="text-slate-500 uppercase tracking-wider text-[10px] block">
                    Source:
                  </span>
                  <span className="text-blue-300 break-all">{sourcePath}</span>
                </div>
              )}
              {sourcePath && destinationPath && (
                <div className="flex items-center text-slate-600">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              )}
              {destinationPath && (
                <div>
                  <span className="text-slate-500 uppercase tracking-wider text-[10px] block">
                    Destination:
                  </span>
                  <span className="text-emerald-300 break-all">{destinationPath}</span>
                </div>
              )}
            </div>
          )}

          {/* Conflict Warning */}
          {isDestinationExisting && (
            <div className="bg-amber-950/40 border border-amber-800/60 p-2.5 rounded flex items-start space-x-2 text-amber-200 text-xs">
              <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Warning:</strong> Destination already exists on disk. Proceeding will overwrite
                existing destination file contents.
              </span>
            </div>
          )}

          {/* Create safety backup checkbox */}
          {requireBackupOption && (
            <label className="flex items-center space-x-2 cursor-pointer select-none text-slate-300">
              <input
                type="checkbox"
                checked={createBackup}
                onChange={(e) => setCreateBackup(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0 focus:ring-offset-0"
              />
              <span>Create safety backup copy (.bak.timestamp) before modifying</span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-800/40 px-4 py-3 border-t border-slate-800 flex items-center justify-end space-x-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded text-xs text-slate-300 hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm({ createBackup })}
            className="px-4 py-1.5 rounded text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow transition"
          >
            Confirm & Execute
          </button>
        </div>
      </div>
    </div>
  );
};
