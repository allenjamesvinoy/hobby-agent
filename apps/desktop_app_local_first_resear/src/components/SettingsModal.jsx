import React from 'react';
import { X, Settings, Clock, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, settings, onSaveSettings }) {
  if (!isOpen) return null;

  const handleThresholdChange = (e) => {
    const val = Math.max(1, Math.min(10, Number(e.target.value) || 1));
    onSaveSettings({ ...settings, dwellThresholdMinutes: val });
  };

  const handleToggleAutoMark = () => {
    onSaveSettings({ ...settings, autoMarkDwell: !settings.autoMarkDwell });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-stone-200 rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 px-6 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-2.5">
            <Settings className="w-4 h-4 text-stone-700" />
            <h2 className="font-bold text-stone-800 text-sm">Reading Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs">
          {/* Dwell Time Threshold */}
          <div className="space-y-3 bg-stone-50/70 p-4 rounded-xl border border-stone-200/80">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-stone-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" /> Dwell Time Threshold
              </label>
              <span className="font-mono text-stone-800 font-bold bg-white px-2 py-0.5 rounded border border-stone-200/80 shadow-xs">
                {settings.dwellThresholdMinutes} min{settings.dwellThresholdMinutes > 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              Reading time spent on a section before it is marked as completed.
            </p>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={settings.dwellThresholdMinutes}
              onChange={handleThresholdChange}
              className="w-full accent-stone-800 bg-stone-200 rounded-lg cursor-pointer h-2"
            />
            <div className="flex justify-between text-[10px] font-mono text-stone-400">
              <span>1 min (Quick)</span>
              <span>5 mins</span>
              <span>10 mins (Deep)</span>
            </div>
          </div>

          {/* Silent Auto-Mark Switch */}
          <div className="flex items-center justify-between bg-stone-50/70 p-4 rounded-xl border border-stone-200/80">
            <div className="space-y-1 pr-4">
              <span className="font-semibold text-stone-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Auto-Mark Completed
              </span>
              <p className="text-[11px] text-stone-500 leading-relaxed">
                Quietly mark sections as read in the background.
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleAutoMark}
              className={`w-11 h-6 rounded-full transition-colors relative p-1 shrink-0 ${
                settings.autoMarkDwell ? 'bg-stone-900' : 'bg-stone-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform shadow-xs ${
                  settings.autoMarkDwell ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Local Privacy Banner */}
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-stone-100 border border-stone-200 text-stone-700 text-[11px]">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>100% Local First. OCR and storage run entirely inside your browser.</span>
          </div>
        </div>

        <div className="p-4 border-t border-stone-200 bg-stone-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white font-medium rounded-xl text-xs transition-colors shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
