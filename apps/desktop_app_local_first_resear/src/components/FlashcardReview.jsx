import React, { useState } from 'react';
import { RotateCw, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

export default function FlashcardReview({ flashcards, papers, onUpdateMastery }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  if (flashcards.length === 0) {
    return (
      <div className="flex-1 bg-slate-900 flex flex-col items-center justify-center p-6 text-slate-500">
        <Sparkles className="w-12 h-12 text-purple-400 mb-3 stroke-[1.5]" />
        <h2 className="text-lg font-bold text-slate-200">No Flashcards Created Yet</h2>
        <p className="text-xs text-slate-400 mt-1 max-w-sm text-center">
          Open a research paper from your library and create flashcards under the active recall tab to review them here.
        </p>
      </div>
    );
  }

  const card = flashcards[currentIndex] || flashcards[0];
  const linkedPaper = papers.find((p) => p.id === card.paperId);

  const handleNext = (masteryLevel) => {
    onUpdateMastery(card.id, masteryLevel);
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % flashcards.length);
  };

  return (
    <div className="flex-1 bg-slate-900 flex flex-col items-center justify-center p-8 select-none">
      {/* Progress Header */}
      <div className="w-full max-w-xl flex items-center justify-between mb-6 text-xs text-slate-400 font-mono">
        <span>Card {currentIndex + 1} of {flashcards.length}</span>
        {linkedPaper && (
          <span className="text-indigo-400 truncate max-w-xs">Paper: {linkedPaper.title}</span>
        )}
      </div>

      {/* Flashcard Box */}
      <div
        onClick={() => setIsFlipped(!isFlipped)}
        className="w-full max-w-xl h-80 bg-slate-800/80 border border-slate-700 rounded-2xl p-8 flex flex-col justify-between cursor-pointer hover:border-indigo-500/50 transition-all shadow-2xl relative group transform active:scale-[0.99]"
      >
        <div className="flex justify-between items-center text-xs font-mono text-slate-400">
          <span className="uppercase tracking-wider text-indigo-400 font-semibold">
            {isFlipped ? 'Back (Answer)' : 'Front (Question)'}
          </span>
          <span className="flex items-center gap-1 text-slate-500 group-hover:text-slate-300 transition-colors">
            <RotateCw className="w-3.5 h-3.5" /> Click to Flip
          </span>
        </div>

        <div className="my-auto text-center">
          <p className="text-lg font-medium text-slate-100 leading-relaxed">
            {isFlipped ? card.back : card.front}
          </p>
        </div>

        <div className="flex justify-between items-center border-t border-slate-700/50 pt-4 text-xs text-slate-500 font-mono">
          <span>Status: <strong className="text-slate-300">{card.mastery || 'New'}</strong></span>
          <span>Tap to flip card</span>
        </div>
      </div>

      {/* Assessment Controls (When flipped) */}
      {isFlipped && (
        <div className="mt-8 flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <button
            onClick={() => handleNext('Review')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 text-xs font-semibold transition-colors shadow-lg shadow-rose-500/10"
          >
            <AlertCircle className="w-4 h-4" /> Hard (Needs Review)
          </button>
          <button
            onClick={() => handleNext('Mastered')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 text-xs font-semibold transition-colors shadow-lg shadow-emerald-500/10"
          >
            <CheckCircle2 className="w-4 h-4" /> Easy (Mastered)
          </button>
        </div>
      )}
    </div>
  );
}