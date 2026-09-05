import React, { useState } from 'react';
import {
  Search,
  FileText,
  BookOpen,
  Brain,
  Trash2,
  CheckCircle,
  Clock,
  Circle
} from 'lucide-react';

export default function PaperList({
  papers,
  flashcards,
  onSelectPaper,
  onDeletePaper,
  filterStatus
}) {
  const [search, setSearch] = useState('');

  const filtered = papers.filter((paper) => {
    const matchesStatus =
      filterStatus === 'All' || paper.status === filterStatus;
    const matchesSearch =
      paper.title.toLowerCase().includes(search.toLowerCase()) ||
      paper.authors.toLowerCase().includes(search.toLowerCase()) ||
      (paper.tags && paper.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())));
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-3 h-3" /> Completed
          </span>
        );
      case 'Reading':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" /> Reading
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700/50 text-slate-400 border border-slate-600/30">
            <Circle className="w-3 h-3" /> Not Started
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
      {/* Top Search & Filter Bar */}
      <div className="p-6 border-b border-slate-800 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search papers by title, author, or tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <div className="text-xs text-slate-400 font-mono">
          Showing {filtered.length} paper{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Paper Cards Grid */}
      <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 auto-rows-max">
        {filtered.length === 0 ? (
          <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-500 space-y-3">
            <FileText className="w-12 h-12 text-slate-600 stroke-[1.5]" />
            <p className="text-sm font-medium">No research papers found</p>
            <p className="text-xs text-slate-600">Click "Add Paper" to track a new research article.</p>
          </div>
        ) : (
          filtered.map((paper) => {
            const paperCards = flashcards.filter((c) => c.paperId === paper.id);
            const progress = paper.totalPages
              ? Math.min(100, Math.round((paper.currentPage / paper.totalPages) * 100))
              : 0;

            return (
              <div
                key={paper.id}
                onClick={() => onSelectPaper(paper)}
                className="group relative bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/50 hover:border-indigo-500/50 rounded-xl p-5 transition-all cursor-pointer flex flex-col justify-between hover:shadow-xl hover:shadow-indigo-500/5"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    {getStatusBadge(paper.status)}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Remove "${paper.title}"?`)) onDeletePaper(paper.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-500 hover:text-rose-400 rounded-md hover:bg-slate-700/50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <h2 className="font-semibold text-slate-100 text-base leading-snug group-hover:text-indigo-300 transition-colors line-clamp-2">
                    {paper.title}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                    {paper.authors} {paper.year ? `(${paper.year})` : ''}
                  </p>

                  {/* Tags */}
                  {paper.tags && paper.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {paper.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-700/40 text-slate-300 border border-slate-600/30"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Reading Progress & Stats */}
                <div className="mt-5 pt-4 border-t border-slate-700/40 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                      Page {paper.currentPage} / {paper.totalPages || '?'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Brain className="w-3.5 h-3.5 text-purple-400" />
                      {paperCards.length} cards
                    </span>
                  </div>

                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}