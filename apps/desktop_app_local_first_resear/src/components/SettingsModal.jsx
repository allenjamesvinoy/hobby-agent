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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-indigo-400" />
            <h2 className="font-bold text-slate-100 text-sm">Reading & Intelligence Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 text-xs">
          {/* Dwell Time Threshold */}
          <div className="space-y-3 bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-200 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" /> Average Section Reading Dwell Time
              </label>
              <span className="font-mono text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                {settings.dwellThresholdMinutes} min{settings.dwellThresholdMinutes > 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Amount of active reading time spent on a section before it is automatically marked as complete.
            </p>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={settings.dwellThresholdMinutes}
              onChange={handleThresholdChange}
              className="w-full accent-indigo-500 bg-slate-700 rounded-lg cursor-pointer h-2"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>1 min (Quick)</span>
              <span>5 mins</span>
              <span>10 mins (Deep Study)</span>
            </div>
          </div>

          {/* Silent Auto-Mark Switch */}
          <div className="flex items-center justify-between bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
            <div className="space-y-1 pr-4">
              <span className="font-semibold text-slate-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Silent Dwell-Time Auto-Marking
              </span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Quietly mark sections as read in background without toast notifications or interruptions.
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleAutoMark}
              className={`w-11 h-6 rounded-full transition-colors relative p-1 shrink-0 ${' '}{
                settings.autoMarkDwell ? 'bg-indigo-600' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${' '}{
                  settings.autoMarkDwell ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Local Privacy Banner */}
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 text-[11px]">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>100% Offline & Local First. OCR and text analytics run entirely in your browser.</span>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-xs transition-colors shadow-md shadow-indigo-600/20"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
