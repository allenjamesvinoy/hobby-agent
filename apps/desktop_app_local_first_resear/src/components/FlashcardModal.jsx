import React, { useState, useEffect } from 'react';
import {
  X,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronLeft,
  Brain,
  Award,
  BookOpen,
  Layers,
  HelpCircle,
  Check
} from 'lucide-react';

export default function FlashcardModal({
  isOpen,
  onClose,
  flashcards = [],
  initialIndex = 0,
  papers = [],
  onUpdateMastery
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionFinished, setSessionFinished] = useState(false);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, mastered: 0 });

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setIsFlipped(false);
    setSessionFinished(false);
    setSessionStats({ reviewed: 0, mastered: 0 });
  }, [initialIndex, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (isFlipped && !sessionFinished) {
        if (e.key === '1' || e.key === 'ArrowLeft') {
          handleScore('Review');
        } else if (e.key === '2' || e.key === 'ArrowRight' || e.key === '3') {
          handleScore('Mastered');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFlipped, currentIndex, flashcards, sessionFinished]);

  if (!isOpen || flashcards.length === 0) return null;

  const currentCard = flashcards[currentIndex] || flashcards[0];
  const linkedPaper = papers.find((p) => p.id === currentCard?.paperId);

  const handleCardClick = (e) => {
    e.stopPropagation();
    if (!sessionFinished) {
      setIsFlipped((prev) => !prev);
    }
  };

  const handleScore = (masteryLevel) => {
    if (currentCard && onUpdateMastery) {
      onUpdateMastery(currentCard.id, masteryLevel);
    }
    setSessionStats((prev) => ({
      reviewed: prev.reviewed + 1,
      mastered: prev.mastered + (masteryLevel === 'Mastered' ? 1 : 0)
    }));

    if (currentIndex + 1 < flashcards.length) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
    } else {
      setSessionFinished(true);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionFinished(false);
    setSessionStats({ reviewed: 0, mastered: 0 });
  };

  const progressPercent = Math.round(
    ((currentIndex + (sessionFinished ? 1 : 0)) / flashcards.length) * 100
  );

  const getMasteryBadge = (level) => {
    const status = level || 'unreviewed';
    if (status === 'Mastered') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Mastered
        </span>
      );
    }
    if (status === 'Review' || status === 'Needs Review') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertCircle className="w-3 h-3 text-rose-600" /> Needs Review
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <Sparkles className="w-3 h-3 text-amber-600" /> Unreviewed
      </span>
    );
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 select-none transition-opacity duration-200 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-gradient-to-b from-[#fcfcfb] to-[#f6f5f2] border border-stone-200/90 rounded-3xl shadow-2xl overflow-hidden flex flex-col justify-between min-h-[520px] p-6 sm:p-8 relative transition-all"
      >
        {/* Top Navigation Header */}
        <div className="flex items-center justify-between border-b border-stone-200/80 pb-4 shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-stone-900 text-white flex items-center justify-center shrink-0 shadow-md shadow-stone-900/10">
              <Brain className="w-5 h-5 text-indigo-300" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-stone-900 truncate tracking-tight">
                {linkedPaper ? linkedPaper.title : 'Active Recall Deck'}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                {currentCard?.sourcePage && (
                  <span className="text-[10px] text-stone-500 font-mono flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-stone-400" />
                    Page {currentCard.sourcePage}{
                      currentCard.sourceSection ? ` • ${currentCard.sourceSection}` : ''
                    }
                  </span>
                )}
                {currentCard && getMasteryBadge(currentCard.masteryLevel || currentCard.mastery)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {!sessionFinished && (
              <span className="text-xs font-mono font-semibold text-stone-600 bg-stone-100/90 px-3 py-1 rounded-full border border-stone-200 shadow-xs">
                {currentIndex + 1} <span className="text-stone-400">/</span> {flashcards.length}
              </span>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-2xl text-stone-400 hover:text-stone-800 hover:bg-stone-200/70 transition-all active:scale-95"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sleek Visual Progress Indicator */}
        <div className="w-full bg-stone-200/70 h-1.5 overflow-hidden shrink-0 mt-3 rounded-full relative">
          <div
            className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full transition-all duration-300 rounded-full shadow-xs"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Central Dynamic Content Area */}
        {sessionFinished ? (
          <div className="my-auto py-8 text-center space-y-6 animate-in zoom-in-95 duration-200 max-w-md mx-auto">
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-teal-50 border border-emerald-200 rounded-3xl flex items-center justify-center mx-auto text-emerald-600 shadow-md shadow-emerald-500/10">
              <Award className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-stone-900 tracking-tight">Deck Complete!</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Great job! You evaluated <span className="font-bold text-stone-800">{flashcards.length} flashcard{flashcards.length !== 1 ? 's' : ''}</span> in this session.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 bg-white rounded-2xl border border-stone-200/80 shadow-xs">
              <div className="text-center">
                <p className="text-[10px] font-mono text-stone-400 uppercase tracking-wider">Reviewed</p>
                <p className="text-lg font-black text-stone-800 font-mono mt-0.5">{sessionStats.reviewed}</p>
              </div>
              <div className="text-center border-l border-stone-100">
                <p className="text-[10px] font-mono text-emerald-600 uppercase tracking-wider">Marked Easy</p>
                <p className="text-lg font-black text-emerald-700 font-mono mt-0.5">{sessionStats.mastered}</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={handleRestart}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-all shadow-md active:scale-95"
              >
                <RotateCw className="w-4 h-4" /> Review Deck Again
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-stone-100 text-stone-700 text-xs font-semibold hover:bg-stone-200 border border-stone-200 transition-all active:scale-95"
              >
                Close Deck
              </button>
            </div>
          </div>
        ) : (
          <div className="my-auto py-6 flex flex-col items-center justify-center relative min-h-[260px]">
            {/* 3D Flip Card Container */}
            <div
              onClick={handleCardClick}
              className="w-full cursor-pointer group rounded-2xl transition-all duration-300 relative"
              style={{ perspective: '1000px' }}
            >
              <div
                className="w-full rounded-2xl p-6 sm:p-8 bg-white border border-stone-200/90 shadow-md hover:shadow-xl hover:border-stone-300 transition-all duration-300 flex flex-col justify-between relative min-h-[240px] transform-gpu"
                style={{
                  transformStyle: 'preserve-3d',
                  transition: 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
                  transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                }}
              >
                {/* Front Side */}
                <div
                  className="flex flex-col justify-between space-y-4 h-full w-full min-h-[200px]"
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden'
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100 flex items-center gap-1.5">
                      <HelpCircle className="w-3 h-3 text-indigo-600" /> Question
                    </span>
                    <span className="text-[11px] font-mono text-stone-400 group-hover:text-stone-600 transition-colors flex items-center gap-1">
                      <RotateCw className="w-3 h-3" /> Click to Flip
                    </span>
                  </div>

                  <p className="text-base sm:text-xl font-bold text-stone-800 leading-relaxed my-auto tracking-tight">
                    {currentCard.front}
                  </p>

                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-stone-400 text-xs font-mono">
                    <span>Spacebar / Click card to reveal</span>
                    <Sparkles className="w-4 h-4 text-amber-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                {/* Back Side (180deg) */}
                <div
                  className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-between space-y-4 h-full w-full bg-gradient-to-br from-white to-emerald-50/20 rounded-2xl"
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)'
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-emerald-600" /> Answer Key
                    </span>
                    <span className="text-[11px] font-mono text-stone-400 flex items-center gap-1">
                      <RotateCw className="w-3 h-3" /> Click to Flip Back
                    </span>
                  </div>

                  <p className="text-sm sm:text-base font-medium text-stone-800 leading-relaxed my-auto overflow-y-auto max-h-[140px] pr-1 font-sans">
                    {currentCard.back}
                  </p>

                  <div className="pt-2 border-t border-emerald-100/60 flex items-center justify-between text-stone-400 text-[11px] font-mono">
                    <span>Evaluate your recall accuracy below</span>
                    <span className="text-emerald-700 font-semibold">Answer Revealed</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Control Bar */}
        {!sessionFinished && (
          <div className="border-t border-stone-200/80 pt-4 flex items-center justify-between shrink-0 gap-2">
            <button
              onClick={() => {
                if (currentIndex > 0) {
                  setCurrentIndex((prev) => prev - 1);
                  setIsFlipped(false);
                }
              }}
              disabled={currentIndex === 0}
              className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900 disabled:opacity-30 disabled:pointer-events-none px-3 py-2 rounded-xl hover:bg-stone-200/60 transition-colors font-medium"
            >
              <ChevronLeft className="w-4 h-4" /> Prev Card
            </button>

            {isFlipped ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => handleScore('Review')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-bold transition-all shadow-xs hover:scale-105 active:scale-95"
                  title="Hotkey: 1 or Left Arrow"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600" /> Hard
                  <kbd className="hidden sm:inline-block text-[9px] bg-rose-200/60 px-1.5 py-0.5 rounded text-rose-800 font-mono font-normal ml-0.5">
                    1
                  </kbd>
                </button>
                <button
                  onClick={() => handleScore('Mastered')}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 border border-emerald-700 text-white hover:bg-emerald-700 text-xs font-bold transition-all shadow-xs hover:scale-105 active:scale-95"
                  title="Hotkey: 2 or Right Arrow"
                >
                  <CheckCircle2 className="w-4 h-4 text-white" /> Easy / Mastered
                  <kbd className="hidden sm:inline-block text-[9px] bg-emerald-800/40 px-1.5 py-0.5 rounded text-emerald-100 font-mono font-normal ml-0.5">
                    2
                  </kbd>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsFlipped(true)}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition-all shadow-xs hover:scale-105 active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Reveal Answer
                <kbd className="hidden sm:inline-block text-[9px] bg-stone-700/80 px-1.5 py-0.5 rounded text-stone-200 font-mono font-normal ml-1">
                  Space
                </kbd>
              </button>
            )}

            <button
              onClick={() => setIsFlipped((prev) => !prev)}
              className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900 px-3 py-2 rounded-xl hover:bg-stone-200/60 transition-colors font-medium"
            >
              <RotateCw className="w-3.5 h-3.5" /> Flip
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
