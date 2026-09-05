import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import PaperList from './components/PaperList';
import PaperDetail from './components/PaperDetail';
import FlashcardReview from './components/FlashcardReview';
import PaperFormModal from './components/PaperFormModal';
import PdfViewerModal from './components/PdfViewerModal';

const STORAGE_KEY_PAPERS = 'paper_companion_papers_v1';
const STORAGE_KEY_FLASHCARDS = 'paper_companion_flashcards_v1';

export default function App() {
  const [papers, setPapers] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PAPERS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [flashcards, setFlashcards] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FLASHCARDS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeTab, setActiveTab] = useState('library');
  const [filterStatus, setFilterStatus] = useState('All');
  const [selectedPaperId, setSelectedPaperId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pdfViewing, setPdfViewing] = useState({ isOpen: false, pdfData: null, title: '' });

  // Sync state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PAPERS, JSON.stringify(papers));
    } catch (e) {
      console.warn('Storage quota exceeded or error saving papers:', e);
    }
  }, [papers]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_FLASHCARDS, JSON.stringify(flashcards));
    } catch (e) {
      console.warn('Storage quota exceeded or error saving flashcards:', e);
    }
  }, [flashcards]);

  const handleSavePaper = (paperData) => {
    const newPaper = {
      id: 'paper_' + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'Not Started',
      currentPage: 0,
      notes: '',
      ...paperData
    };
    setPapers((prev) => [newPaper, ...prev]);
    setIsFormOpen(false);
  };

  const handleUpdatePaper = (paperId, updates) => {
    setPapers((prev) =>
      prev.map((p) =>
        p.id === paperId
          ? { ...p, ...updates, updatedAt: new Date().toISOString() }
          : p
      )
    );
  };

  const handleDeletePaper = (paperId) => {
    if (confirm('Are you sure you want to delete this paper and all associated flashcards?')) {
      setPapers((prev) => prev.filter((p) => p.id !== paperId));
      setFlashcards((prev) => prev.filter((f) => f.paperId !== paperId));
      if (selectedPaperId === paperId) {
        setSelectedPaperId(null);
      }
    }
  };

  const handleAddFlashcard = (cardData) => {
    const newCard = {
      id: 'card_' + Date.now(),
      createdAt: new Date().toISOString(),
      masteryLevel: 'unreviewed',
      ...cardData
    };
    setFlashcards((prev) => [newCard, ...prev]);
  };

  const handleDeleteFlashcard = (cardId) => {
    setFlashcards((prev) => prev.filter((c) => c.id !== cardId));
  };

  const handleUpdateMastery = (cardId, masteryLevel) => {
    setFlashcards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, masteryLevel } : c))
    );
  };

  const handleOpenPdf = (paper) => {
    if (paper.pdfFile) {
      setPdfViewing({ isOpen: true, pdfData: paper.pdfFile, title: paper.title });
    } else {
      alert('No PDF file attached to this paper entry.');
    }
  };

  const selectedPaper = papers.find((p) => p.id === selectedPaperId);
  const relevantFlashcards = selectedPaperId
    ? flashcards.filter((f) => f.paperId === selectedPaperId)
    : flashcards;

  return (
    <div className="flex h-screen w-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSelectedPaperId(null);
        }}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        papers={papers}
        flashcards={flashcards}
        onNewPaper={() => setIsFormOpen(true)}
      />

      <main className="flex-1 flex flex-col min-w-0 bg-slate-900 overflow-hidden">
        {activeTab === 'library' ? (
          selectedPaper ? (
            <PaperDetail
              paper={selectedPaper}
              flashcards={relevantFlashcards}
              onBack={() => setSelectedPaperId(null)}
              onUpdatePaper={(updates) => handleUpdatePaper(selectedPaper.id, updates)}
              onAddFlashcard={(card) => handleAddFlashcard({ ...card, paperId: selectedPaper.id })}
              onDeleteFlashcard={handleDeleteFlashcard}
              onOpenPdf={() => handleOpenPdf(selectedPaper)}
            />
          ) : (
            <PaperList
              papers={papers}
              flashcards={flashcards}
              onSelectPaper={(p) => setSelectedPaperId(p.id)}
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

      <PaperFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSavePaper}
      />

      <PdfViewerModal
        isOpen={pdfViewing.isOpen}
        pdfData={pdfViewing.pdfData}
        title={pdfViewing.title}
        onClose={() => setPdfViewing({ isOpen: false, pdfData: null, title: '' })}
      />
    </div>
  );
}
