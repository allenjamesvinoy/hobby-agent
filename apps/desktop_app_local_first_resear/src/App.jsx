import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import PaperList from './components/PaperList';
import PaperDetail from './components/PaperDetail';
import FlashcardReview from './components/FlashcardReview';
import PdfViewerModal from './components/PdfViewerModal';
import {
  Maximize2,
  Settings,
  X,
  ChevronRight,
  ChevronLeft,
  BookMarked
} from 'lucide-react';

// Initial mock data for local-first experience
const INITIAL_PAPERS = [
  {
    id: 'paper_1',
    title: 'Attention Is All You Need',
    authors: 'Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez, Łukasz Kaiser, Illia Polosukhin',
    year: '2017',
    status: 'Reading',
    currentPage: 3,
    totalPages: 15,
    tags: ['Transformer', 'NLP', 'Deep Learning'],
    notes: '# Key Takeaways\n- Introduces the Transformer architecture based solely on attention mechanisms.\n- Replaces recurrent layers with Multi-Head Self-Attention.\n- Achieves state-of-the-art results in machine translation.',
    sections: [
      { id: 'sec_1', name: 'Abstract', startPage: 1, endPage: 1, completed: true, timeSpentSec: 120 },
      { id: 'sec_2', name: 'Introduction', startPage: 1, endPage: 2, completed: true, timeSpentSec: 340 },
      { id: 'sec_3', name: 'Background', startPage: 2, endPage: 3, completed: false, timeSpentSec: 45 },
      { id: 'sec_4', name: 'Model Architecture', startPage: 3, endPage: 7, completed: false, timeSpentSec: 10 }
    ],
    pdfUrl: 'https://arxiv.org/pdf/1706.03762.pdf'
  },
  {
    id: 'paper_2',
    title: 'LoRA: Low-Rank Adaptation of Large Language Models',
    authors: 'Edward J. Hu, Yibin Shen, Phillip Wallis, Zeyuan Allen-Zhu, Yuanzhi Li, Shean Wang, Lu Wang, Weizhu Chen',
    year: '2021',
    status: 'Completed',
    currentPage: 12,
    totalPages: 12,
    tags: ['Fine-Tuning', 'LLM', 'Efficiency'],
    notes: '# LoRA Notes\n- Freezes pre-trained model weights and injects trainable rank decomposition matrices.\n- Drastically reduces the number of trainable parameters for downstream tasks.\n- No additional inference latency.',
    sections: [
      { id: 'sec_lora_1', name: 'Abstract', startPage: 1, endPage: 1, completed: true, timeSpentSec: 90 },
      { id: 'sec_lora_2', name: 'Introduction', startPage: 1, endPage: 2, completed: true, timeSpentSec: 180 }
    ],
    pdfUrl: 'https://arxiv.org/pdf/2106.09685.pdf'
  }
];

const INITIAL_FLASHCARDS = [
  {
    id: 'card_1',
    paperId: 'paper_1',
    front: 'What is the main advantage of the Transformer over RNNs?',
    back: 'Parallelization. Since it does not process tokens sequentially, training can be parallelized across the entire sequence length.',
    mastery: 'New',
    masteryLevel: 'unreviewed',
    sourcePage: 2
  },
  {
    id: 'card_2',
    paperId: 'paper_1',
    front: 'What is the scaling factor used in Scaled Dot-Product Attention?',
    back: '1 / sqrt(d_k), where d_k is the dimension of the keys. This prevents the dot products from growing extremely large in magnitude for large dimensions.',
    mastery: 'Mastered',
    masteryLevel: 'mastered',
    sourcePage: 4
  }
];

export default function App() {
  const [papers, setPapers] = useState(() => {
    const saved = localStorage.getItem('paper_companion_papers');
    return saved ? JSON.parse(saved) : INITIAL_PAPERS;
  });

  const [flashcards, setFlashcards] = useState(() => {
    const saved = localStorage.getItem('paper_companion_flashcards');
    return saved ? JSON.parse(saved) : INITIAL_FLASHCARDS;
  });

  const [activeTab, setActiveTab] = useState('papers');
  const [filterStatus, setFilterStatus] = useState('All');
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [isPdfOpen, setIsPdfOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMinimizeMode, setIsMinimizeMode] = useState(() => {
    const saved = localStorage.getItem('paper_companion_minimize');
    return saved === 'true';
  });

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('paper_companion_settings');
    return saved ? JSON.parse(saved) : { dwellThresholdMinutes: 3, autoMarkDwell: true };
  });

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('paper_companion_papers', JSON.stringify(papers));
  }, [papers]);

  useEffect(() => {
    localStorage.setItem('paper_companion_flashcards', JSON.stringify(flashcards));
  }, [flashcards]);

  useEffect(() => {
    localStorage.setItem('paper_companion_minimize', String(isMinimizeMode));
  }, [isMinimizeMode]);

  useEffect(() => {
    localStorage.setItem('paper_companion_settings', JSON.stringify(settings));
  }, [settings]);

  // Paper Handlers
  const handleNewPaper = () => {
    const title = prompt('Enter Paper Title:');
    if (!title) return;
    const authors = prompt('Enter Authors:') || 'Unknown';
    const year = prompt('Enter Year:') || new Date().getFullYear().toString();
    const tagsInput = prompt('Enter Tags (comma separated):') || '';
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    const pdfUrl = prompt('Enter PDF URL (optional):') || '';

    const newPaper = {
      id: 'paper_' + Date.now(),
      title,
      authors,
      year,
      status: 'Not Started',
      currentPage: 1,
      totalPages: 10,
      tags,
      notes: '',
      sections: [],
      pdfUrl
    };

    setPapers([newPaper, ...papers]);
    setSelectedPaper(newPaper);
  };

  const handleUpdatePaper = (updatedFields) => {
    if (!selectedPaper) return;
    const updatedPapers = papers.map((p) => {
      if (p.id === selectedPaper.id) {
        const updated = { ...p, ...updatedFields };
        setSelectedPaper(updated);
        return updated;
      }
      return p;
    });
    setPapers(updatedPapers);
  };

  const handleDeletePaper = (id) => {
    setPapers(papers.filter((p) => p.id !== id));
    setFlashcards(flashcards.filter((c) => c.paperId !== id));
    if (selectedPaper && selectedPaper.id === id) {
      setSelectedPaper(null);
    }
  };

  // Flashcard Handlers
  const handleAddFlashcard = (newCard) => {
    const card = {
      id: 'card_' + Date.now(),
      ...newCard
    };
    setFlashcards([card, ...flashcards]);
  };

  const handleDeleteFlashcard = (id) => {
    setFlashcards(flashcards.filter((c) => c.id !== id));
  };

  const handleUpdateMastery = (cardId, level) => {
    setFlashcards(
      flashcards.map((c) =>
        c.id === cardId ? { ...c, mastery: level, masteryLevel: level.toLowerCase() } : c
      )
    );
  };

  // Minimize Mode Mini-State
  const [miniTab, setMiniTab] = useState('progress');
  const activePaperInMini = selectedPaper || papers[0];

  return (
    <div className="h-screen w-screen flex bg-stone-100 text-stone-800 overflow-hidden font-sans antialiased">
      {isMinimizeMode ? (
        /* MINIMIZE MODE (COMPACT WIDGET) */
        /* The entire outer container has a drag-region header to make it fully movable on Mac */
        <div className="w-80 h-[420px] m-auto bg-white rounded-2xl border border-stone-200 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Drag Region Header */}
          <div className="drag-region h-11 bg-stone-900 text-white flex items-center justify-between px-4 shrink-0 select-none">
            <div className="flex items-center gap-2">
              <BookMarked className="w-4 h-4 text-stone-300" />
              <span className="text-xs font-bold tracking-tight font-serif">Paper Companion (Mini)</span>
            </div>
            <div className="flex items-center gap-1.5 no-drag">
              <button
                onClick={() => setIsMinimizeMode(false)}
                className="p-1 hover:bg-stone-800 rounded text-stone-300 hover:text-white transition-colors"
                title="Exit Minimize Mode"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Mini Tab Switcher */}
          <div className="flex border-b border-stone-100 bg-stone-50/80 text-xs font-medium">
            <button
              onClick={() => setMiniTab('progress')}
              className={`flex-1 py-2 text-center border-b-2 transition-colors ${
                miniTab === 'progress'
                  ? 'border-stone-900 text-stone-900 font-semibold'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              Reading Tracker
            </button>
            <button
              onClick={() => setMiniTab('flashcards')}
              className={`flex-1 py-2 text-center border-b-2 transition-colors ${
                miniTab === 'flashcards'
                  ? 'border-stone-900 text-stone-900 font-semibold'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              Quick Recall ({flashcards.length})
            </button>
          </div>

          {/* Mini Content */}
          <div className="flex-1 overflow-y-auto p-4 bg-[#fbfbfa]">
            {miniTab === 'progress' ? (
              activePaperInMini ? (
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                      {activePaperInMini.status}
                    </span>
                    <h3 className="font-bold text-stone-800 text-sm mt-1.5 line-clamp-2">
                      {activePaperInMini.title}
                    </h3>
                    <p className="text-[11px] text-stone-500 truncate mt-0.5">
                      {activePaperInMini.authors}
                    </p>
                  </div>

                  {/* Page Tracker */}
                  <div className="bg-white p-3 rounded-xl border border-stone-200/80 shadow-xs space-y-2">
                    <div className="flex justify-between items-center text-xs text-stone-700 font-medium">
                      <span>Reading Progress</span>
                      <span className="font-mono text-stone-900 font-bold">
                        {Math.round((activePaperInMini.currentPage / (activePaperInMini.totalPages || 1)) * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => {
                          const prev = Math.max(1, activePaperInMini.currentPage - 1);
                          const updatedPapers = papers.map(p => p.id === activePaperInMini.id ? { ...p, currentPage: prev } : p);
                          setPapers(updatedPapers);
                          if (selectedPaper?.id === activePaperInMini.id) setSelectedPaper({ ...selectedPaper, currentPage: prev });
                        }}
                        className="p-1 bg-stone-100 hover:bg-stone-200 rounded text-stone-700 transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-mono text-stone-800 font-semibold">
                        Page {activePaperInMini.currentPage} / {activePaperInMini.totalPages || 1}
                      </span>
                      <button
                        onClick={() => {
                          const next = Math.min(activePaperInMini.totalPages || 999, activePaperInMini.currentPage + 1);
                          const updatedPapers = papers.map(p => p.id === activePaperInMini.id ? { ...p, currentPage: next } : p);
                          setPapers(updatedPapers);
                          if (selectedPaper?.id === activePaperInMini.id) setSelectedPaper({ ...selectedPaper, currentPage: next });
                        }}
                        className="p-1 bg-stone-100 hover:bg-stone-200 rounded text-stone-700 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Quick Status Selector */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-stone-400 uppercase font-mono tracking-wider">
                      Update Status
                    </label>
                    <select
                      value={activePaperInMini.status}
                      onChange={(e) => {
                        const status = e.target.value;
                        const updatedPapers = papers.map(p => p.id === activePaperInMini.id ? { ...p, status } : p);
                        setPapers(updatedPapers);
                        if (selectedPaper?.id === activePaperInMini.id) setSelectedPaper({ ...selectedPaper, status });
                      }}
                      className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-stone-400 shadow-xs"
                    >
                      <option value="Not Started">Not Started</option>
                      <option value="Reading">Reading</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>

                  {/* Quick Paper Switcher */}
                  {papers.length > 1 && (
                    <div className="pt-2 border-t border-stone-100">
                      <label className="text-[10px] font-semibold text-stone-400 uppercase font-mono tracking-wider block mb-1">
                        Switch Paper
                      </label>
                      <select
                        value={activePaperInMini.id}
                        onChange={(e) => {
                          const paper = papers.find(p => p.id === e.target.value);
                          if (paper) setSelectedPaper(paper);
                        }}
                        className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-xs text-stone-700 focus:outline-none"
                      >
                        {papers.map(p => (
                          <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-stone-400 text-xs font-mono">
                  No papers in library.
                </div>
              )
            ) : (
              /* Mini Flashcards Review */
              <div className="h-full flex flex-col justify-between">
                {flashcards.length > 0 ? (
                  <div className="space-y-3">
                    <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs min-h-[140px] flex flex-col justify-between">
                      <p className="text-[10px] font-mono text-stone-400 uppercase tracking-wider">
                        Active Recall Card
                      </p>
                      <p className="text-xs font-medium text-stone-800 text-center my-4">
                        {flashcards[0].front}
                      </p>
                      <p className="text-[10px] text-stone-400 text-center italic">
                        Answer: {flashcards[0].back}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateMastery(flashcards[0].id, 'Review')}
                        className="flex-1 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-semibold transition-colors"
                      >
                        Hard
                      </button>
                      <button
                        onClick={() => handleUpdateMastery(flashcards[0].id, 'Mastered')}
                        className="flex-1 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-semibold transition-colors"
                      >
                        Easy
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-stone-400 text-xs font-mono">
                    No flashcards created yet.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* FULL APPLICATION MODE */
        <>
          {/* Sidebar */}
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            papers={papers}
            flashcards={flashcards}
            onNewPaper={handleNewPaper}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onMinimize={() => setIsMinimizeMode(true)}
          />

          {/* Main Content Area */}
          <main className="flex-1 flex flex-col overflow-hidden bg-white">
            {activeTab === 'papers' ? (
              selectedPaper ? (
                <PaperDetail
                  paper={selectedPaper}
                  flashcards={flashcards}
                  onBack={() => setSelectedPaper(null)}
                  onUpdatePaper={handleUpdatePaper}
                  onAddFlashcard={handleAddFlashcard}
                  onDeleteFlashcard={handleDeleteFlashcard}
                  onOpenPdf={() => setIsPdfOpen(true)}
                />
              ) : (
                <PaperList
                  papers={papers}
                  flashcards={flashcards}
                  onSelectPaper={setSelectedPaper}
                  onDeletePaper={handleDeletePaper}
                  filterStatus={filterStatus}
                />
              )
            ) : (
              <FlashcardReview
                flashcards={flashcards}
                papers={papers}
                onUpdateMastery={handleUpdateMastery}
              />
            )}
          </main>

          {/* PDF Viewer Modal */}
          {isPdfOpen && selectedPaper && (
            <PdfViewerModal
              isOpen={isPdfOpen}
              pdfUrl={selectedPaper.pdfUrl}
              title={selectedPaper.title}
              initialPage={selectedPaper.currentPage}
              totalPages={selectedPaper.totalPages}
              onPageChange={(page) => handleUpdatePaper({ currentPage: page })}
              onClose={() => setIsPdfOpen(false)}
              paper={selectedPaper}
              onUpdatePaper={handleUpdatePaper}
              onAddFlashcard={handleAddFlashcard}
              flashcards={flashcards}
              settings={settings}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          )}

          {/* Settings Modal */}
          {isSettingsOpen && (
            <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-white border border-stone-200 rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <h3 className="text-sm font-bold text-stone-800 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-stone-600" /> Reading Settings
                  </h3>
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    className="p-1 hover:bg-stone-100 rounded text-stone-400 hover:text-stone-700 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-stone-700 block">
                      Dwell Time Threshold (Minutes)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={settings.dwellThresholdMinutes}
                      onChange={(e) => setSettings({ ...settings, dwellThresholdMinutes: Number(e.target.value) || 3 })}
                      className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-xs text-stone-800 focus:outline-none focus:border-stone-400"
                    />
                    <p className="text-[10px] text-stone-400">
                      Time spent on a section before it is automatically marked as completed.
                    </p>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div>
                      <label className="font-semibold text-stone-700 block">
                        Auto-Mark Completed
                      </label>
                      <p className="text-[10px] text-stone-400">
                        Automatically mark sections as read after the dwell threshold.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoMarkDwell}
                      onChange={(e) => setSettings({ ...settings, autoMarkDwell: e.target.checked })}
                      className="w-4 h-4 text-stone-900 border-stone-300 rounded focus:ring-stone-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t border-stone-100">
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
                  >
                    Save & Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </>)
      }
    </div>
  );
}