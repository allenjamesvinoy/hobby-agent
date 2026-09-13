import React, { useState } from 'react';
import { Sparkles, Brain, Play, CheckCircle2, AlertCircle, Layers, Search, RotateCw, BookOpen } from 'lucide-react';
import FlashcardModal from './FlashcardModal';

export default function FlashcardReview({ flashcards = [], papers = [], onUpdateMastery }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialIndex, setModalInitialIndex] = useState(0);
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  if (flashcards.length === 0) {
    return (
      <div className="flex-1 bg-[#fbfbfa] flex flex-col items-center justify-center p-8 text-stone-400 select-none max-w-md mx-auto text-center">
        <div className="w-16 h-16 bg-stone-100 rounded-3xl flex items-center justify-center text-stone-300 mb-4 border border-stone-200/80 shadow-xs">
          <Sparkles className="w-8 h-8 stroke-[1.5]" />
        </div>
        <h2 className="text-base font-bold text-stone-800">No Flashcards Created Yet</h2>
        <p className="text-xs text-stone-500 mt-1 leading-relaxed">
          Open a research paper from your library and create active recall flashcards to review key findings and concepts here.
        </p>
      </div>
    );
  }

  const filteredCards = flashcards.filter((card) => {
    const status = card.masteryLevel || card.mastery || 'unreviewed';
    const matchesFilter =
      filter === 'All' ||
      (filter === 'Mastered' && status === 'Mastered') ||
      (filter === 'Review' && (status === 'Review' || status === 'Needs Review')) ||
      (filter === 'Unreviewed' && (status === 'unreviewed' || status === 'New'));

    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      card.front?.toLowerCase().includes(query) ||
      card.back?.toLowerCase().includes(query);

    return matchesFilter && matchesSearch;
  });

  const totalCount = flashcards.length;
  const masteredCount = flashcards.filter(
    (c) => (c.masteryLevel || c.mastery) === 'Mastered'
  ).length;
  const reviewCount = flashcards.filter(
    (c) =>
      (c.masteryLevel || c.mastery) === 'Review' ||
      (c.masteryLevel || c.mastery) === 'Needs Review'
  ).length;
  const unreviewedCount = Math.max(0, totalCount - masteredCount - reviewCount);

  const handleStartReview = (cardIndex = 0) => {
    setModalInitialIndex(cardIndex);
    setIsModalOpen(true);
  };

  const getStatusBadge = (card) => {
    const status = card.masteryLevel || card.mastery || 'unreviewed';
    if (status === 'Mastered') {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Mastered
        </span>
      );
    }
    if (status === 'Review' || status === 'Needs Review') {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold uppercase bg-rose-50 text-rose-700 border border-rose-200/80 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 text-rose-600" /> Needs Review
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold uppercase bg-amber-50 text-amber-700 border border-amber-200/80 flex items-center gap-1">
        <Sparkles className="w-3 h-3 text-amber-600" /> Unreviewed
      </span>
    );
  };

  return (
    <div className="flex-1 bg-[#fbfbfa] flex flex-col overflow-hidden select-none">
      {/* Top Navigation Header */}
      <div className="p-6 pt-9 border-b border-stone-200 bg-white/80 backdrop-blur-sm flex items-center justify-between gap-4 drag-region shrink-0">
        <div>
          <h1 className="text-base font-bold text-stone-900 flex items-center gap-2 tracking-tight">
            <Brain className="w-5 h-5 text-indigo-600" /> Active Recall Flashcards
          </h1>
          <p className="text-xs text-stone-500 mt-0.5 font-sans">
            Spaced repetition and active recall decks for academic literature
          </p>
        </div>

        <button
          onClick={() => handleStartReview(0)}
          disabled={filteredCards.length === 0}
          className="no-drag flex items-center gap-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs hover:scale-105 active:scale-95 cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current text-emerald-400" /> Start Study Session ({filteredCards.length})
        </button>
      </div>

      {/* Stats Cards & Filter Section */}
      <div className="p-6 border-b border-stone-200/80 bg-stone-50/50 space-y-4 shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div
            onClick={() => setFilter('All')}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${'bg-white shadow-xs hover:border-stone-300'} ${'All' === filter ? 'ring-2 ring-stone-900 border-stone-900 bg-stone-900/5' : 'border-stone-200'}`}
          >
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-stone-600" /> Total Cards
            </p>
            <p className="text-2xl font-black text-stone-900 mt-1 font-mono tracking-tight">{totalCount}</p>
          </div>

          <div
            onClick={() => setFilter('Mastered')}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${'bg-white shadow-xs hover:border-stone-300'} ${'Mastered' === filter ? 'ring-2 ring-emerald-600 border-emerald-600 bg-emerald-50/30' : 'border-stone-200'}`}
          >
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Mastered
            </p>
            <p className="text-2xl font-black text-stone-900 mt-1 font-mono tracking-tight">{masteredCount}</p>
          </div>

          <div
            onClick={() => setFilter('Review')}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${'bg-white shadow-xs hover:border-stone-300'} ${'Review' === filter ? 'ring-2 ring-rose-600 border-rose-600 bg-rose-50/30' : 'border-stone-200'}`}
          >
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Needs Review
            </p>
            <p className="text-2xl font-black text-stone-900 mt-1 font-mono tracking-tight">{reviewCount}</p>
          </div>

          <div
            onClick={() => setFilter('Unreviewed')}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${'bg-white shadow-xs hover:border-stone-300'} ${'Unreviewed' === filter ? 'ring-2 ring-amber-600 border-amber-600 bg-amber-50/30' : 'border-stone-200'}`}
          >
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Unreviewed
            </p>
            <p className="text-2xl font-black text-stone-900 mt-1 font-mono tracking-tight">{unreviewedCount}</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search questions or answers in deck..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-stone-200/90 rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-400 shadow-xs font-sans"
          />
        </div>
      </div>

      {/* Grid of Flashcard Tiles */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCards.length === 0 ? (
            <div className="col-span-full py-16 text-center text-stone-400 text-xs font-mono space-y-2">
              <RotateCw className="w-6 h-6 mx-auto text-stone-300 stroke-[1.5] animate-spin-slow" />
              <p>No flashcards match your selected filter or search query.</p>
            </div>
          ) : (
            filteredCards.map((card, idx) => {
              const paper = papers.find((p) => p.id === card.paperId);
              return (
                <div
                  key={card.id}
                  onClick={() => handleStartReview(idx)}
                  className="group bg-white border border-stone-200/90 rounded-2xl p-5 hover:border-stone-400 transition-all cursor-pointer flex flex-col justify-between space-y-4 shadow-xs hover:shadow-md relative transform hover:-translate-y-0.5"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      {getStatusBadge(card)}
                      {card.sourcePage && (
                        <span className="text-[10px] text-stone-400 font-mono flex items-center gap-1">
                          <BookOpen className="w-3 h-3 text-stone-300" /> p. {card.sourcePage}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-stone-800 leading-snug line-clamp-3 group-hover:text-stone-900 tracking-tight">
                      {card.front}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-[11px] font-mono">
                    <span className="truncate max-w-[170px] text-stone-500 font-medium">
                      {paper?.title || 'Research Paper'}
                    </span>
                    <span className="text-stone-700 group-hover:text-indigo-600 font-semibold flex items-center gap-1 transition-colors font-sans text-xs">
                      Practice &rarr;
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Interactive Review Modal */}
      <FlashcardModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        flashcards={filteredCards}
        initialIndex={modalInitialIndex}
        papers={papers}
        onUpdateMastery={onUpdateMastery}
      />
    </div>
  );
}
