import React from 'react';
import {
  BookOpen,
  Brain,
  CheckCircle2,
  Clock,
  Plus,
  BookMarked,
  BarChart2,
  HardDrive,
  Settings
} from 'lucide-react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  filterStatus,
  setFilterStatus,
  papers,
  flashcards,
  onNewPaper,
  onOpenSettings
}) {
  const totalPapers = papers.length;
  const completedCount = papers.filter((p) => p.status === 'Completed').length;
  const readingCount = papers.filter((p) => p.status === 'Reading').length;

  return (
    <aside className="w-64 bg-slate-950/80 border-r border-slate-800 flex flex-col justify-between p-4 select-none pt-8">
      <div className="space-y-6">
        {/* Header App Title */}
        <div className="flex items-center space-x-3 px-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <BookMarked className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-slate-100 text-sm tracking-wide">Paper Companion</h1>
            <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
              <HardDrive className="w-3 h-3" /> Local-First Storage
            </p>
          </div>
        </div>

        {/* Add Paper Button */}
        <button
          onClick={onNewPaper}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-xl text-sm transition-all shadow-md shadow-indigo-600/20 active:scale-95"
        >
          <Plus className="w-4 h-4" /> Add Paper
        </button>

        {/* Navigation Sections */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
            Library
          </p>
          <button
            onClick={() => {
              setActiveTab('papers');
              setFilterStatus('All');
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${' '}{
              activeTab === 'papers' && filterStatus === 'All'
                ? 'bg-slate-800 text-indigo-400'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <BookOpen className="w-4 h-4" /> All Papers
            </span>
            <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
              {totalPapers}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('papers');
              setFilterStatus('Reading');
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${' '}{
              activeTab === 'papers' && filterStatus === 'Reading'
                ? 'bg-slate-800 text-indigo-400'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-amber-400" /> Currently Reading
            </span>
            <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-mono">
              {readingCount}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('papers');
              setFilterStatus('Completed');
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${' '}{
              activeTab === 'papers' && filterStatus === 'Completed'
                ? 'bg-slate-800 text-indigo-400'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Completed
            </span>
            <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-mono">
              {completedCount}
            </span>
          </button>
        </div>

        {/* Study Section */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
            Active Recall
          </p>
          <button
            onClick={() => setActiveTab('flashcards')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${' '}{
              activeTab === 'flashcards'
                ? 'bg-slate-800 text-indigo-400'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Brain className="w-4 h-4 text-purple-400" /> Flashcards Review
            </span>
            <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full font-mono">
              {flashcards.length}
            </span>
          </button>
        </div>
      </div>

      {/* Bottom Stats & Settings Widget */}
      <div className="space-y-3">
        <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span className="flex items-center gap-2">
              <BarChart2 className="w-3.5 h-3.5 text-indigo-400" /> Reading Progress
            </span>
            <button
              onClick={onOpenSettings}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
              title="Reading Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-300"
              style={{
                width: `${totalPapers > 0 ? (completedCount / totalPapers) * 100 : 0}%`
              }}
            />
          </div>
          <p className="text-[11px] text-slate-500 text-right font-mono">
            {completedCount} / {totalPapers} finished ({totalPapers > 0 ? Math.round((completedCount / totalPapers) * 100) : 0}%)
          </p>
        </div>
      </div>
    </aside>
  );
}
