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
    <aside className="w-64 bg-[#f7f6f3] border-r border-stone-200/80 flex flex-col justify-between p-4 select-none pt-9 drag-region">
      <div className="space-y-6">
        {/* Header App Title */}
        <div className="flex items-center space-x-3 px-2 pt-2">
          <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center shadow-sm text-white font-serif font-bold text-base">
            <BookMarked className="w-4 h-4 text-stone-100" />
          </div>
          <div>
            <h1 className="font-bold text-stone-800 text-sm tracking-tight">Paper Companion</h1>
            <p className="text-[10px] text-stone-500 flex items-center gap-1 font-mono mt-0.5">
              <HardDrive className="w-3 h-3 text-emerald-600" /> Local-First
            </p>
          </div>
        </div>

        {/* Add Paper Button */}
        <button
          onClick={onNewPaper}
          className="no-drag w-full flex items-center justify-center gap-2 bg-white hover:bg-stone-50 text-stone-800 font-medium py-2 px-4 rounded-lg text-xs border border-stone-200/90 shadow-sm transition-all hover:border-stone-300 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 text-stone-600" /> Add Paper
        </button>

        {/* Navigation Sections */}
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider px-3 mb-1.5 font-mono">
            Library
          </p>
          <button
            onClick={() => {
              setActiveTab('papers');
              setFilterStatus('All');
            }}
            className={`no-drag w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'papers' && filterStatus === 'All'
                ? 'bg-stone-200/70 text-stone-900 font-semibold'
                : 'text-stone-600 hover:bg-stone-200/40 hover:text-stone-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <BookOpen className="w-3.5 h-3.5 text-stone-500" /> All Papers
            </span>
            <span className="text-[10px] bg-stone-200/60 text-stone-600 px-2 py-0.5 rounded-full font-mono font-medium">
              {totalPapers}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('papers');
              setFilterStatus('Reading');
            }}
            className={`no-drag w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'papers' && filterStatus === 'Reading'
                ? 'bg-stone-200/70 text-stone-900 font-semibold'
                : 'text-stone-600 hover:bg-stone-200/40 hover:text-stone-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" /> Reading
            </span>
            <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-mono font-medium">
              {readingCount}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('papers');
              setFilterStatus('Completed');
            }}
            className={`no-drag w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'papers' && filterStatus === 'Completed'
                ? 'bg-stone-200/70 text-stone-900 font-semibold'
                : 'text-stone-600 hover:bg-stone-200/40 hover:text-stone-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Completed
            </span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-mono font-medium">
              {completedCount}
            </span>
          </button>
        </div>

        {/* Study Section */}
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider px-3 mb-1.5 font-mono">
            Active Recall
          </p>
          <button
            onClick={() => setActiveTab('flashcards')}
            className={`no-drag w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'flashcards'
                ? 'bg-stone-200/70 text-stone-900 font-semibold'
                : 'text-stone-600 hover:bg-stone-200/40 hover:text-stone-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Brain className="w-3.5 h-3.5 text-indigo-600" /> Flashcards
            </span>
            <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-mono font-medium">
              {flashcards.length}
            </span>
          </button>
        </div>
      </div>

      {/* Bottom Stats & Settings Widget */}
      <div className="space-y-2 no-drag">
        <div className="bg-white rounded-xl p-3 border border-stone-200/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-700">
            <span className="flex items-center gap-1.5 text-stone-600 text-[11px] font-mono uppercase tracking-wider">
              <BarChart2 className="w-3.5 h-3.5 text-indigo-600" /> Reading
            </span>
            <button
              onClick={onOpenSettings}
              className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded transition-colors"
              title="Reading Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden border border-stone-200/60">
            <div
              className="bg-stone-800 h-full rounded-full transition-all duration-300"
              style={{
                width: `${totalPapers > 0 ? (completedCount / totalPapers) * 100 : 0}%`
              }}
            />
          </div>
          <p className="text-[10px] text-stone-500 text-right font-mono">
            {completedCount} / {totalPapers} read ({totalPapers > 0 ? Math.round((completedCount / totalPapers) * 100) : 0}%)
          </p>
        </div>
      </div>
    </aside>
  );
}
