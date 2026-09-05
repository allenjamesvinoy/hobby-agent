import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Brain,
  FileText,
  Plus,
  Save,
  Trash2,
  Eye,
  ListChecks,
  CheckSquare,
  Square,
  PlusCircle,
  Check
} from 'lucide-react';

export const DEFAULT_ACADEMIC_SECTIONS = [
  'Abstract',
  'Introduction',
  'Background / Related Work',
  'Methodology / Architecture',
  'Experiments / Results',
  'Discussion',
  'Conclusion'
];

const createDefaultSections = () =>
  DEFAULT_ACADEMIC_SECTIONS.map((name, idx) => ({
    id: 'sec_' + idx + '_' + Math.random().toString(36).substring(2, 9),
    name,
    completed: false
  }));

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
  const [currentPage, setCurrentPage] = useState(paper.currentPage || 1);
  const [status, setStatus] = useState(paper.status || 'Not Started');
  const [sections, setSections] = useState(() => {
    return paper.sections && paper.sections.length > 0
      ? paper.sections
      : createDefaultSections();
  });
  const [newCustomSection, setNewCustomSection] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Synchronize state when selected paper ID changes
  useEffect(() => {
    setNotes(paper.notes || '');
    setCurrentPage(paper.currentPage || 1);
    setStatus(paper.status || 'Not Started');
    setSections(
      paper.sections && paper.sections.length > 0
        ? paper.sections
        : createDefaultSections()
    );
  }, [paper.id]);

  // Keep page tracker in sync when updated from PDF viewer
  useEffect(() => {
    if (paper.currentPage !== undefined && paper.currentPage !== currentPage) {
      setCurrentPage(paper.currentPage);
    }
  }, [paper.currentPage]);

  // Flashcard Form State
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [showAddCard, setShowAddCard] = useState(false);

  const paperCards = flashcards.filter((c) => c.paperId === paper.id);

  const handleSaveNotes = () => {
    onUpdatePaper({
      notes,
      currentPage: Number(currentPage),
      status,
      sections
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleToggleSection = (sectionId) => {
    const updated = sections.map((sec) =>
      sec.id === sectionId ? { ...sec, completed: !sec.completed } : sec
    );
    setSections(updated);
    onUpdatePaper({ sections: updated });
  };

  const handleAddSection = (e) => {
    if (e) e.preventDefault();
    if (!newCustomSection.trim()) return;
    const updated = [
      ...sections,
      {
        id: 'sec_' + Date.now(),
        name: newCustomSection.trim(),
        completed: false
      }
    ];
    setSections(updated);
    onUpdatePaper({ sections: updated });
    setNewCustomSection('');
  };

  const handleDeleteSection = (sectionId) => {
    const updated = sections.filter((s) => s.id !== sectionId);
    setSections(updated);
    onUpdatePaper({ sections: updated });
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

  const completedSectionsCount = sections.filter((s) => s.completed).length;
  const sectionsProgressPercent = sections.length > 0
    ? Math.round((completedSectionsCount / sections.length) * 100)
    : 0;

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
              <Eye className="w-3.5 h-3.5" /> Open PDF Reader (Page {currentPage})
            </button>
          )}
          <button
            onClick={handleSaveNotes}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-md shadow-indigo-600/20"
          >
            {saveSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-300" /> Saved!
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" /> Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Specs & Reading Controls Sidebar */}
        <div className="w-80 border-r border-slate-800 p-6 flex flex-col justify-between overflow-y-auto bg-slate-950/20 space-y-6 shrink-0">
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
                onChange={(e) => {
                  const newStatus = e.target.value;
                  setStatus(newStatus);
                  onUpdatePaper({ status: newStatus });
                }}
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
                <span>Page Resumption Tracker</span>
                <span className="font-mono text-indigo-400">
                  {Math.min(
                    100,
                    Math.round(((currentPage || 1) / (paper.totalPages || 1)) * 100)
                  )}
                  %
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max={paper.totalPages || 999}
                  value={currentPage}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 1;
                    setCurrentPage(val);
                    onUpdatePaper({ currentPage: val });
                  }}
                  className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-center text-sm font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <span className="text-xs text-slate-500">
                  / {paper.totalPages || 1} total pages
                </span>
              </div>
            </div>

            {/* Section Reading Checklist (Sidebar Widget) */}
            <div className="space-y-3 bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <ListChecks className="w-4 h-4 text-emerald-400" /> Sections Checklist
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[10px]">
                  {completedSectionsCount} / {sections.length} read
                </span>
              </div>

              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${sectionsProgressPercent}%` }}
                />
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {sections.map((sec) => (
                  <label
                    key={sec.id}
                    className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-slate-700/40 cursor-pointer text-xs group transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={sec.completed}
                        onChange={() => handleToggleSection(sec.id)}
                        className="hidden"
                      />
                      {sec.completed ? (
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      )}
                      <span
                        className={`truncate ${
                          sec.completed ? 'line-through text-slate-500' : 'text-slate-200'
                        }`}
                      >
                        {sec.name}
                      </span>
                    </div>
                    {!DEFAULT_ACADEMIC_SECTIONS.includes(sec.name) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSection(sec.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 transition-opacity p-0.5"
                        title="Remove custom section"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </label>
                ))}
              </div>

              {/* Inline Add Section */}
              <form
                onSubmit={handleAddSection}
                className="flex gap-1.5 pt-1 border-t border-slate-700/40"
              >
                <input
                  type="text"
                  placeholder="Add custom section..."
                  value={newCustomSection}
                  onChange={(e) => setNewCustomSection(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  className="p-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-xs"
                  title="Add Section"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                </button>
              </form>
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

        {/* Right Tabbed Section (Notes, Sections Checklist & Flashcards) */}
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
              onClick={() => setActiveSubTab('sections')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                activeSubTab === 'sections'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListChecks className="w-4 h-4" /> Section Checklist ({completedSectionsCount}/
              {sections.length})
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
                  className="flex-1 w-full bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500/80 resize-none leading-relaxed min-h-[300px]"
                />
              </div>
            ) : activeSubTab === 'sections' ? (
              <div className="space-y-6 max-w-3xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      Academic Paper Reading Workflow
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Track reading progress through academic sections.
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-mono text-xs font-semibold">
                    {completedSectionsCount} of {sections.length} sections read • {sectionsProgressPercent}%
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sections.map((sec) => (
                    <div
                      key={sec.id}
                      onClick={() => handleToggleSection(sec.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        sec.completed
                          ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                          : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {sec.completed ? (
                          <CheckSquare className="w-5 h-5 text-emerald-400 shrink-0" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-500 shrink-0" />
                        )}
                        <span
                          className={`text-xs font-medium truncate ${
                            sec.completed ? 'line-through text-slate-400' : ''
                          }`}
                        >
                          {sec.name}
                        </span>
                      </div>
                      {!DEFAULT_ACADEMIC_SECTIONS.includes(sec.name) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSection(sec.id);
                          }}
                          className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-slate-700/50 transition-colors shrink-0 ml-2"
                          title="Remove custom section"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddSection} className="flex gap-2 pt-2">
                  <input
                    type="text"
                    placeholder="Add custom section name (e.g. Appendix A, Ablation Study)..."
                    value={newCustomSection}
                    onChange={(e) => setNewCustomSection(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Section
                  </button>
                </form>
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
                              {card.masteryLevel || card.mastery || 'New'}
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
