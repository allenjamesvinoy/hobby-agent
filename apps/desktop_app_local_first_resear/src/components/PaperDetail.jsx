import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Brain,
  FileText,
  Plus,
  Save,
  Trash2,
  Eye
} from 'lucide-react';

export default function PaperDetail({
  paper,
  flashcards,
  onBack,
  onUpdatePaper,
  onAddFlashcard,
  onDeleteFlashcard,
  onOpenPdf
}) {
  const [activeSubTab, setActiveSubTab] = useState('notes');
  const [notes, setNotes] = useState(paper.notes || '');
  const [currentPage, setCurrentPage] = useState(paper.currentPage || 0);
  const [status, setStatus] = useState(paper.status || 'Not Started');

  // Synchronize state whenever prop updates (e.g. switching selected paper)
  useEffect(() => {
    setNotes(paper.notes || '');
    setCurrentPage(paper.currentPage || 0);
    setStatus(paper.status || 'Not Started');
  }, [paper]);

  // Flashcard Form State
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [showAddCard, setShowAddCard] = useState(false);

  const paperCards = flashcards.filter((c) => c.paperId === paper.id);

  const handleSaveNotes = () => {
    onUpdatePaper({
      ...paper,
      notes,
      currentPage: Number(currentPage),
      status
    });
  };

  const handleCreateCard = (e) => {
    e.preventDefault();
    if (!newFront.trim() || !newBack.trim()) return;
    onAddFlashcard({
      paperId: paper.id,
      front: newFront,
      back: newBack,
      mastery: 'New',
      lastReviewed: null
    });
    setNewFront('');
    setNewBack('');
    setShowAddCard(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
      {/* Top Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-100 transition-colors px-2 py-1 rounded-lg hover:bg-slate-800"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Papers
        </button>

        <div className="flex items-center gap-3">
          {(paper.pdfUrl || paper.pdfFile) && (
            <button
              onClick={() => onOpenPdf(paper)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 text-xs font-medium border border-indigo-500/30 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" /> Open PDF Reader
            </button>
          )}
          <button
            onClick={handleSaveNotes}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-md shadow-indigo-600/20"
          >
            <Save className="w-3.5 h-3.5" /> Save Changes
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Specs & Reading Controls Sidebar */}
        <div className="w-80 border-r border-slate-800 p-6 flex flex-col justify-between overflow-y-auto bg-slate-950/20">
          <div className="space-y-6">
            <div>
              <h1 className="text-lg font-bold text-slate-100 leading-snug">{paper.title}</h1>
              <p className="text-xs text-slate-400 mt-2 font-medium">{paper.authors}</p>
              {paper.year && (
                <p className="text-xs text-slate-500 font-mono mt-0.5">Year: {paper.year}</p>
              )}
            </div>

            {/* Status Control */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="Not Started">Not Started</option>
                <option value="Reading">Reading</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            {/* Page Reading Tracker */}
            <div className="space-y-3 bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
              <div className="flex justify-between items-center text-xs text-slate-300 font-medium">
                <span>Page Tracker</span>
                <span className="font-mono text-indigo-400">
                  {Math.min(100, Math.round(((currentPage || 0) / (paper.totalPages || 1)) * 100))}{
                  ' '
                }%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max={paper.totalPages || 999}
                  value={currentPage}
                  onChange={(e) => setCurrentPage(e.target.value)}
                  className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-center text-sm font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <span className="text-xs text-slate-500">/ {paper.totalPages || 1} total</span>
              </div>
            </div>

            {/* Tags */}
            {paper.tags && paper.tags.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Tags
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {paper.tags.map((t, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300 border border-slate-700/60 font-mono"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Tabbed Section (Notes & Flashcards) */}
        <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
          {/* Tabs header */}
          <div className="flex border-b border-slate-800 px-6 pt-3 bg-slate-950/20">
            <button
              onClick={() => setActiveSubTab('notes')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                activeSubTab === 'notes'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" /> Paper Notes Scratchpad
            </button>
            <button
              onClick={() => setActiveSubTab('flashcards')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                activeSubTab === 'flashcards'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Brain className="w-4 h-4" /> Active Recall Cards ({paperCards.length})
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeSubTab === 'notes' ? (
              <div className="h-full flex flex-col space-y-2">
                <p className="text-xs text-slate-500 font-mono">
                  Scratchpad / Markdown Summary for this paper:
                </p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Write down key equations, takeaways, methodologies, or criticisms..."
                  className="flex-1 w-full bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500/80 resize-none leading-relaxed"
                />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">
                    Create question & answer pairs to test your knowledge.
                  </p>
                  <button
                    onClick={() => setShowAddCard(!showAddCard)}
                    className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> {showAddCard ? 'Cancel' : 'New Flashcard'}
                  </button>
                </div>

                {/* Create Flashcard Form */}
                {showAddCard && (
                  <form
                    onSubmit={handleCreateCard}
                    className="bg-slate-800/60 border border-indigo-500/30 rounded-xl p-4 space-y-4 shadow-lg"
                  >
                    <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                      Create New Flashcard
                    </h3>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Front (Question or Concept)
                      </label>
                      <input
                        type="text"
                        value={newFront}
                        onChange={(e) => setNewFront(e.target.value)}
                        placeholder="e.g., What is Scaled Dot-Product Attention?"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Back (Answer or Key Takeaway)
                      </label>
                      <textarea
                        rows={3}
                        value={newBack}
                        onChange={(e) => setNewBack(e.target.value)}
                        placeholder="e.g., An attention mechanism where queries and keys are dot-producted and scaled by sqrt(d_k)..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
                        required
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-colors"
                      >
                        Add Card
                      </button>
                    </div>
                  </form>
                )}

                {/* Flashcards List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {paperCards.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-slate-500 text-xs font-mono">
                      No flashcards created for this paper yet.
                    </div>
                  ) : (
                    paperCards.map((card) => (
                      <div
                        key={card.id}
                        className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between space-y-3 relative group"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                              {card.mastery || 'New'}
                            </span>
                            <button
                              onClick={() => onDeleteFlashcard(card.id)}
                              className="text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-xs font-semibold text-indigo-300">Q: {card.front}</p>
                          <p className="text-xs text-slate-300 border-t border-slate-700/40 pt-2">
                            A: {card.back}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
