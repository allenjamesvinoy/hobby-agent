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
    <div className="flex-1 flex flex-col bg-[#fbfbfa] overflow-hidden">
      {/* Top Header */}
      <div className="p-4 pt-8 px-6 border-b border-stone-200 flex items-center justify-between bg-white/80 backdrop-blur-sm drag-region">
        <button
          onClick={onBack}
          className="no-drag flex items-center gap-2 text-xs font-medium text-stone-500 hover:text-stone-800 transition-colors px-2 py-1.5 rounded-md hover:bg-stone-100"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Papers
        </button>

        <div className="flex items-center gap-3 no-drag">
          {(paper.pdfUrl || paper.pdfFile) && (
            <button
              onClick={() => onOpenPdf(paper)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-medium border border-stone-200 transition-colors shadow-xs"
            >
              <Eye className="w-3.5 h-3.5 text-stone-600" /> Open PDF Reader (Page {currentPage})
            </button>
          )}
          <button
            onClick={handleSaveNotes}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium transition-colors shadow-xs"
          >
            {saveSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" /> Saved!
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
        <div className="w-80 border-r border-stone-200 p-6 flex flex-col justify-between overflow-y-auto bg-[#f7f6f3]/60 space-y-6 shrink-0">
          <div className="space-y-6">
            <div>
              <h1 className="text-base font-bold text-stone-900 leading-snug">{paper.title}</h1>
              <p className="text-xs text-stone-600 mt-2 font-medium">{paper.authors}</p>
              {paper.year && (
                <p className="text-xs text-stone-400 font-mono mt-0.5">Year: {paper.year}</p>
              )}
            </div>

            {/* Status Control */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-stone-400 uppercase font-mono tracking-wider">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => {
                  const newStatus = e.target.value;
                  setStatus(newStatus);
                  onUpdatePaper({ status: newStatus });
                }}
                className="w-full bg-white border border-stone-200 rounded-lg px-3 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-stone-400 shadow-xs"
              >
                <option value="Not Started">Not Started</option>
                <option value="Reading">Reading</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            {/* Page Reading Tracker */}
            <div className="space-y-2.5 bg-white p-3.5 rounded-xl border border-stone-200/90 shadow-xs">
              <div className="flex justify-between items-center text-xs text-stone-700 font-medium">
                <span>Reading Progress</span>
                <span className="font-mono text-stone-800 font-bold">
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
                  className="w-16 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-center text-xs font-mono text-stone-800 focus:outline-none focus:border-stone-400"
                />
                <span className="text-xs text-stone-400 font-mono">
                  / {paper.totalPages || 1} pages
                </span>
              </div>
            </div>

            {/* Section Reading Checklist (Sidebar Widget) */}
            <div className="space-y-2.5 bg-white p-3.5 rounded-xl border border-stone-200/90 shadow-xs">
              <div className="flex items-center justify-between text-xs font-semibold text-stone-700">
                <span className="flex items-center gap-1.5">
                  <ListChecks className="w-4 h-4 text-emerald-600" /> Sections
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono text-[10px] font-medium">
                  {completedSectionsCount} / {sections.length}
                </span>
              </div>

              <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden border border-stone-200/60">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${sectionsProgressPercent}%` }}
                />
              </div>

              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {sections.map((sec) => (
                  <label
                    key={sec.id}
                    className="flex items-center justify-between gap-2 p-1.5 rounded-md hover:bg-stone-50 cursor-pointer text-xs group transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={sec.completed}
                        onChange={() => handleToggleSection(sec.id)}
                        className="hidden"
                      />
                      {sec.completed ? (
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      )}
                      <span
                        className={`truncate text-xs ${
                          sec.completed ? 'line-through text-stone-400' : 'text-stone-700'
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
                        className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-rose-600 transition-opacity p-0.5"
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
                className="flex gap-1.5 pt-2 border-t border-stone-100"
              >
                <input
                  type="text"
                  placeholder="Add custom section..."
                  value={newCustomSection}
                  onChange={(e) => setNewCustomSection(e.target.value)}
                  className="flex-1 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-[11px] text-stone-800 focus:outline-none focus:border-stone-400"
                />
                <button
                  type="submit"
                  className="p-1 bg-stone-900 hover:bg-stone-800 text-white rounded-lg transition-colors text-xs"
                  title="Add Section"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

            {/* Tags */}
            {paper.tags && paper.tags.length > 0 && (
              <div>
                <label className="text-[11px] font-semibold text-stone-400 uppercase font-mono tracking-wider block mb-2">
                  Tags
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {paper.tags.map((t, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded text-[11px] bg-white text-stone-600 border border-stone-200/80 font-mono shadow-xs"
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
        <div className="flex-1 flex flex-col bg-[#fbfbfa] overflow-hidden">
          {/* Tabs header */}
          <div className="flex border-b border-stone-200 px-6 pt-2 bg-white/40">
            <button
              onClick={() => setActiveSubTab('notes')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                activeSubTab === 'notes'
                  ? 'border-stone-900 text-stone-900 font-semibold'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Notes Scratchpad
            </button>
            <button
              onClick={() => setActiveSubTab('sections')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                activeSubTab === 'sections'
                  ? 'border-stone-900 text-stone-900 font-semibold'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" /> Sections Checklist ({completedSectionsCount}/
              {sections.length})
            </button>
            <button
              onClick={() => setActiveSubTab('flashcards')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                activeSubTab === 'flashcards'
                  ? 'border-stone-900 text-stone-900 font-semibold'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Brain className="w-3.5 h-3.5" /> Active Recall Cards ({paperCards.length})
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeSubTab === 'notes' ? (
              <div className="h-full flex flex-col space-y-2">
                <p className="text-xs text-stone-400 font-mono">
                  Scratchpad / Markdown summary for this paper:
                </p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Write down key takeaways, methodological details, or criticisms..."
                  className="flex-1 w-full bg-white border border-stone-200/90 rounded-xl p-5 text-sm text-stone-800 font-sans placeholder-stone-400 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-200 resize-none leading-relaxed shadow-xs min-h-[300px]"
                />
              </div>
            ) : activeSubTab === 'sections' ? (
              <div className="space-y-6 max-w-3xl">
                <div className="flex items-center justify-between border-b border-stone-200 pb-4">
                  <div>
                    <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                      Academic Section Workflow
                    </h2>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Track reading completion through structured academic sections.
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-stone-100 border border-stone-200 text-stone-700 font-mono text-xs font-medium">
                    {completedSectionsCount} of {sections.length} read • {sectionsProgressPercent}%
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sections.map((sec) => (
                    <div
                      key={sec.id}
                      onClick={() => handleToggleSection(sec.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between shadow-xs ${
                        sec.completed
                          ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                          : 'bg-white border-stone-200 hover:border-stone-300 text-stone-800'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {sec.completed ? (
                          <CheckSquare className="w-5 h-5 text-emerald-600 shrink-0" />
                        ) : (
                          <Square className="w-5 h-5 text-stone-400 shrink-0" />
                        )}
                        <span
                          className={`text-xs font-medium truncate ${
                            sec.completed ? 'line-through text-stone-400' : ''
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
                          className="text-stone-400 hover:text-rose-600 p-1 rounded hover:bg-stone-100 transition-colors shrink-0 ml-2"
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
                    placeholder="Add custom section name (e.g., Ablation Study, Appendix A)..."
                    value={newCustomSection}
                    onChange={(e) => setNewCustomSection(e.target.value)}
                    className="flex-1 bg-white border border-stone-200 rounded-xl px-4 py-2 text-xs text-stone-800 focus:outline-none focus:border-stone-400 shadow-xs"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Section
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-stone-500">
                    Create question and answer pairs to test your understanding.
                  </p>
                  <button
                    onClick={() => setShowAddCard(!showAddCard)}
                    className="flex items-center gap-1.5 text-xs bg-stone-900 hover:bg-stone-800 text-white font-medium px-3.5 py-1.5 rounded-lg transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> {showAddCard ? 'Cancel' : 'New Flashcard'}
                  </button>
                </div>

                {/* Create Flashcard Form */}
                {showAddCard && (
                  <form
                    onSubmit={handleCreateCard}
                    className="bg-white border border-stone-200 rounded-xl p-5 space-y-4 shadow-sm text-xs"
                  >
                    <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider font-mono">
                      New Flashcard
                    </h3>
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Front (Question or Concept)
                      </label>
                      <input
                        type="text"
                        value={newFront}
                        onChange={(e) => setNewFront(e.target.value)}
                        placeholder="e.g., What is Scaled Dot-Product Attention?"
                        className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-xs text-stone-800 focus:outline-none focus:border-stone-400"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Back (Answer or Explanation)
                      </label>
                      <textarea
                        rows={3}
                        value={newBack}
                        onChange={(e) => setNewBack(e.target.value)}
                        placeholder="e.g., An attention mechanism where queries and keys are dot-producted and scaled..."
                        className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-xs text-stone-800 focus:outline-none focus:border-stone-400 resize-none"
                        required
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="submit"
                        className="bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-colors shadow-xs"
                      >
                        Add Card
                      </button>
                    </div>
                  </form>
                )}

                {/* Flashcards List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {paperCards.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-stone-400 text-xs font-mono">
                      No flashcards created for this paper yet.
                    </div>
                  ) : (
                    paperCards.map((card) => (
                      <div
                        key={card.id}
                        className="bg-white border border-stone-200/90 rounded-xl p-4 flex flex-col justify-between space-y-3 relative group shadow-xs hover:shadow-sm"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200/60">
                              {card.masteryLevel || card.mastery || 'New'}
                            </span>
                            <button
                              onClick={() => onDeleteFlashcard(card.id)}
                              className="text-stone-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-xs font-semibold text-stone-900">Q: {card.front}</p>
                          <p className="text-xs text-stone-600 border-t border-stone-100 pt-2">
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
