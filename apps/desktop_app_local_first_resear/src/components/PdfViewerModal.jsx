import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  List,
  Sparkles,
  CheckCircle2,
  Clock,
  Settings,
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';

// Configure PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

function dataUrlToUint8Array(dataUrl) {
  if (typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return dataUrl;
}

const ACADEMIC_HEADER_PATTERNS = [
  { name: 'Abstract', regex: /^\s*(?:abstract)/i },
  { name: 'Introduction', regex: /^\s*(?:1[\.\s]+)?(?:introduction)/i },
  { name: 'Background / Related Work', regex: /^\s*(?:2[\.\s]+)?(?:background|related\s+work)/i },
  { name: 'Methodology / Architecture', regex: /^\s*(?:3[\.\s]+)?(?:methodology|method|methods|proposed\s+method|architecture)/i },
  { name: 'Experiments / Results', regex: /^\s*(?:4[\.\s]+)?(?:experiments|results|evaluations|experimental\s+setup)/i },
  { name: 'Discussion', regex: /^\s*(?:5[\.\s]+)?(?:discussion|analysis)/i },
  { name: 'Conclusion', regex: /^\s*(?:6[\.\s]+)?(?:conclusion|conclusions)/i },
  { name: 'References', regex: /^\s*(?:references|bibliography)/i }
];

export default function PdfViewerModal({
  isOpen,
  pdfUrl,
  pdfData,
  title,
  initialPage = 1,
  totalPages = 1,
  onPageChange,
  onClose,
  paper,
  onUpdatePaper,
  settings = { dwellThresholdMinutes: 3, autoMarkDwell: true },
  onOpenSettings
}) {
  const rawUrl = pdfUrl || pdfData;
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(totalPages || 1);
  const [currentPage, setCurrentPage] = useState(initialPage || 1);
  const [sections, setSections] = useState([]);
  const [showSectionsSidebar, setShowSectionsSidebar] = useState(true);
  const [isScanningSections, setIsScanningSections] = useState(false);
  const [scanMethod, setScanMethod] = useState('');
  const [renderedPages, setRenderedPages] = useState({});
  const [scale, setScale] = useState(1.25);
  const [pageDimensions, setPageDimensions] = useState({});
  
  const scrollContainerRef = useRef(null);
  const canvasRefs = useRef({});
  const renderTasksRef = useRef({});
  const pageObserverRef = useRef(null);
  const isInitialScrollDone = useRef(false);
  const renderingRef = useRef({});
  const currentPageRef = useRef(currentPage);

  const handleZoom = (newScale) => {
    const clamped = Math.max(0.6, Math.min(2.5, Number(newScale.toFixed(2))));
    setScale(clamped);
    setRenderedPages({});
    renderingRef.current = {};
  };

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  // Load PDF Document via PDF.js
  useEffect(() => {
    if (!isOpen || !rawUrl) return;

    let isCancelled = false;
    const loadDoc = async () => {
      try {
        const data = dataUrlToUint8Array(rawUrl);
        const loadingTask = pdfjsLib.getDocument({ data });
        const doc = await loadingTask.promise;
        if (!isCancelled) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);
          if (paper && (!paper.totalPages || paper.totalPages !== doc.numPages)) {
            onUpdatePaper && onUpdatePaper({ totalPages: doc.numPages });
          }
        }
      } catch (err) {
        console.error('Failed to parse PDF document:', err);
      }
    };

    loadDoc();
    return () => {
      isCancelled = true;
      setPdfDoc(null);
      setRenderedPages({});
      renderingRef.current = {};
      Object.values(renderTasksRef.current).forEach((task) => {
        try {
          task?.cancel();
        } catch (e) {}
      });
      renderTasksRef.current = {};
      isInitialScrollDone.current = false;
    };
  }, [isOpen, rawUrl]);

  // Dynamic IntersectionObserver for Scroll-based Page Detection
  useEffect(() => {
    if (!isOpen || !pdfDoc) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let maxRatio = 0;
        let activePageNum = currentPageRef.current;
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            const pNum = Number(entry.target.getAttribute('data-page-number'));
            if (pNum) activePageNum = pNum;
          }
        });

        if (activePageNum && activePageNum !== currentPageRef.current) {
          setCurrentPage(activePageNum);
          if (onPageChange) onPageChange(activePageNum);
        }
      },
      {
        root: container,
        threshold: [0.2, 0.5, 0.8]
      }
    );

    pageObserverRef.current = observer;

    const pageEls = container.querySelectorAll('[data-page-number]');
    pageEls.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
      pageObserverRef.current = null;
    };
  }, [isOpen, pdfDoc, numPages]);

  // Render page canvas continuously with HiDPI / Retina resolution
  useEffect(() => {
    if (!pdfDoc || !isOpen) return;
    let isCancelled = false;

    const renderCanvasPage = async (pageNum) => {
      if (renderingRef.current[pageNum] || renderedPages[pageNum]) return;
      renderingRef.current[pageNum] = true;

      // Cancel any ongoing render task on this canvas
      if (renderTasksRef.current[pageNum]) {
        try {
          renderTasksRef.current[pageNum].cancel();
        } catch (e) {}
      }

      try {
        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled) return;

        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRefs.current[pageNum];
        if (!canvas) return;

        // Actual bitmap resolution scaled for HiDPI/Retina screens
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);

        // Display size in CSS pixels (ensures sharp, proportional 1:1 aspect ratio)
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        setPageDimensions((prev) => ({
          ...prev,
          [pageNum]: {
            width: Math.floor(viewport.width),
            height: Math.floor(viewport.height)
          }
        }));

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        const renderTask = page.render({ canvasContext: ctx, viewport });
        renderTasksRef.current[pageNum] = renderTask;
        await renderTask.promise;
        if (isCancelled) return;

        setRenderedPages((prev) => ({ ...prev, [pageNum]: true }));

        const pageWrapper = canvas.parentElement;
        if (pageWrapper && pageObserverRef.current) {
          pageObserverRef.current.observe(pageWrapper);
        }
      } catch (e) {
        if (e?.name !== 'RenderingCancelledException') {
          console.warn(`Error rendering canvas page ${pageNum}:`, e);
        }
      } finally {
        renderingRef.current[pageNum] = false;
      }
    };

    for (let i = 1; i <= numPages; i++) {
      renderCanvasPage(i);
    }

    return () => {
      isCancelled = true;
      Object.values(renderTasksRef.current).forEach((task) => {
        try {
          task?.cancel();
        } catch (e) {}
      });
      renderTasksRef.current = {};
    };
  }, [pdfDoc, isOpen, numPages, scale]);

  // Scroll to initial saved page on load
  useEffect(() => {
    if (isOpen && pdfDoc && !isInitialScrollDone.current) {
      const targetPage = initialPage || (paper && paper.currentPage) || 1;
      setTimeout(() => {
        scrollToPage(targetPage);
        isInitialScrollDone.current = true;
      }, 300);
    }
  }, [isOpen, pdfDoc, initialPage]);

  // 3-Tier Section Scanner Implementation
  const runSectionScanner = async () => {
    if (!pdfDoc) return;
    setIsScanningSections(true);
    setScanMethod('Scanning Outline...');

    let detected = [];

    try {
      // Tier 1: Embedded PDF Outline
      const outline = await pdfDoc.getOutline();
      if (outline && outline.length > 0) {
        setScanMethod('Tier 1: Embedded Bookmark Outline');
        for (const item of outline) {
          let pageNum = 1;
          if (item.dest) {
            let dest = item.dest;
            if (typeof dest === 'string') {
              dest = await pdfDoc.getDestination(dest);
            }
            if (Array.isArray(dest)) {
              const pageRef = dest[0];
              pageNum = (await pdfDoc.getPageIndex(pageRef)) + 1;
            }
          }
          detected.push({
            id: 'sec_out_' + Math.random().toString(36).substring(2, 9),
            name: item.title,
            startPage: pageNum,
            completed: false,
            timeSpentSec: 0
          });
        }
      }

      // Tier 2: Digital Text Parsing regex fallback
      if (detected.length === 0) {
        setScanMethod('Tier 2: Extracting Digital Text Headers');
        let totalTextItems = 0;
        for (let i = 1; i <= numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const textContent = await page.getTextContent();
          totalTextItems += textContent.items.length;
          const pageText = textContent.items.map((it) => it.str).join(' ');

          for (const pattern of ACADEMIC_HEADER_PATTERNS) {
            if (pattern.regex.test(pageText) && !detected.some((d) => d.name === pattern.name)) {
              detected.push({
                id: 'sec_txt_' + Math.random().toString(36).substring(2, 9),
                name: pattern.name,
                startPage: i,
                completed: false,
                timeSpentSec: 0
              });
            }
          }
        }

        // Tier 3: Local OCR via Tesseract.js if text content is 0 (scanned PDF)
        if (detected.length === 0 && totalTextItems < 10) {
          setScanMethod('Tier 3: Local WebAssembly OCR (Scanned Paper)');
          for (let i = 1; i <= Math.min(numPages, 10); i++) {
            const canvas = canvasRefs.current[i];
            if (canvas) {
              const { data } = await Tesseract.recognize(canvas, 'eng');
              const scannedText = data.text || '';
              for (const pattern of ACADEMIC_HEADER_PATTERNS) {
                if (pattern.regex.test(scannedText) && !detected.some((d) => d.name === pattern.name)) {
                  detected.push({
                    id: 'sec_ocr_' + Math.random().toString(36).substring(2, 9),
                    name: pattern.name,
                    startPage: i,
                    completed: false,
                    timeSpentSec: 0
                  });
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Error running section scanner:', e);
    } finally {
      setIsScanningSections(false);
      if (detected.length > 0) {
        detected.sort((a, b) => a.startPage - b.startPage);
        for (let idx = 0; idx < detected.length; idx++) {
          const nextSec = detected[idx + 1];
          detected[idx].endPage = nextSec ? Math.max(detected[idx].startPage, nextSec.startPage - 1) : numPages;
        }
        setSections(detected);
        if (paper && onUpdatePaper) {
          onUpdatePaper({ sections: detected });
        }
      }
    }
  };

  // Trigger section scanner on doc load if paper has no custom sections
  useEffect(() => {
    if (pdfDoc && paper) {
      if (paper.sections && paper.sections.length > 0 && paper.sections[0].startPage) {
        setSections(paper.sections);
      } else {
        runSectionScanner();
      }
    }
  }, [pdfDoc, paper?.id]);

  // Silent Dwell-Time Auto-Marking Engine
  useEffect(() => {
    if (!isOpen || !sections.length) return;

    const interval = setInterval(() => {
      if (!document.hasFocus()) return;

      const currentSectionIndex = sections.findIndex(
        (s) => currentPage >= (s.startPage || 1) && currentPage <= (s.endPage || numPages)
      );

      if (currentSectionIndex !== -1) {
        setSections((prevSections) => {
          if (!prevSections || prevSections.length === 0) return prevSections;
          const targetSec = prevSections[currentSectionIndex];
          if (!targetSec) return prevSections;

          const updatedSecs = [...prevSections];
          const newTimeSpent = (targetSec.timeSpentSec || 0) + 1;
          const thresholdSec = (settings.dwellThresholdMinutes || 3) * 60;
          let newlyCompleted = targetSec.completed;

          if (settings.autoMarkDwell && !targetSec.completed && newTimeSpent >= thresholdSec) {
            newlyCompleted = true;
          }

          if (targetSec.timeSpentSec === newTimeSpent && targetSec.completed === newlyCompleted) {
            return prevSections;
          }

          updatedSecs[currentSectionIndex] = {
            ...targetSec,
            timeSpentSec: newTimeSpent,
            completed: newlyCompleted
          };

          if (newlyCompleted !== targetSec.completed || newTimeSpent % 5 === 0) {
            onUpdatePaper && onUpdatePaper({ sections: updatedSecs });
          }

          return updatedSecs;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, sections.length, currentPage, settings, numPages, onUpdatePaper]);

  const scrollToPage = (pNum) => {
    const valid = Math.max(1, Math.min(numPages, pNum));
    setCurrentPage(valid);
    const targetEl = document.getElementById(`pdf-page-${valid}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (!isOpen || !rawUrl) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col p-4 select-none">
      {/* Top Navigation & Status Bar */}
      <div className="flex items-center justify-between mb-3 text-slate-100 bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-800 shadow-xl shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSectionsSidebar(!showSectionsSidebar)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${' '}{
              showSectionsSidebar ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <List className="w-4 h-4" /> Sections
          </button>
          <h3 className="font-bold text-xs truncate max-w-xs md:max-w-md text-slate-200">
            {title || 'PDF Document'}
          </h3>
        </div>

        {/* Center: Page Navigation & Zoom Controls */}
        <div className="flex items-center gap-2">
          {/* Scroll Page Indicator & Controller */}
          <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1 rounded-lg border border-slate-700/60 font-mono text-xs">
            <button
              onClick={() => scrollToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-1 hover:bg-slate-700 rounded text-slate-300 disabled:opacity-30 transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-slate-400">Page</span>
            <input
              type="number"
              min="1"
              max={numPages}
              value={currentPage}
              onChange={(e) => scrollToPage(Number(e.target.value) || 1)}
              className="w-12 text-center bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-indigo-300 font-bold focus:outline-none focus:border-indigo-500"
            />
            <span className="text-slate-400">of {numPages}</span>
            <button
              onClick={() => scrollToPage(currentPage + 1)}
              disabled={currentPage >= numPages}
              className="p-1 hover:bg-slate-700 rounded text-slate-300 disabled:opacity-30 transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700/60 font-mono text-xs">
            <button
              onClick={() => handleZoom(scale - 0.2)}
              disabled={scale <= 0.6}
              className="p-1 hover:bg-slate-700 rounded text-slate-300 disabled:opacity-30 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleZoom(1.25)}
              className="px-1.5 py-0.5 hover:bg-slate-700 rounded text-slate-200 text-xs font-semibold"
              title="Reset Zoom (125%)"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              onClick={() => handleZoom(scale + 0.2)}
              disabled={scale >= 2.5}
              className="p-1 hover:bg-slate-700 rounded text-slate-300 disabled:opacity-30 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleZoom(scale === 1.0 ? 1.4 : 1.0)}
              className="p-1 hover:bg-slate-700 rounded text-slate-300 transition-colors ml-0.5"
              title={scale === 1.0 ? "Enlarge View (140%)" : "Fit 100%"}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors border border-slate-700/60"
              title="Reading Dwell Settings"
            >
              <Settings className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">{settings.dwellThresholdMinutes}m Auto-Mark</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
            title="Close PDF"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Viewport Workspace */}
      <div className="flex-1 flex overflow-hidden gap-4">
        {/* Collapsible Sections Sidebar */}
        {showSectionsSidebar && (
          <div className="w-72 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shrink-0 overflow-y-auto space-y-4 shadow-xl">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Detected Sections
                </span>
                <button
                  onClick={runSectionScanner}
                  disabled={isScanningSections}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-mono underline disabled:opacity-50"
                >
                  Re-Scan
                </button>
              </div>

              {isScanningSections ? (
                <div className="py-8 text-center space-y-2 text-slate-400 text-xs">
                  <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mx-auto" />
                  <p className="font-mono text-[11px]">{scanMethod}</p>
                </div>
              ) : sections.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs space-y-2 font-mono">
                  <p>No outline sections detected.</p>
                  <button
                    onClick={runSectionScanner}
                    className="px-3 py-1 bg-indigo-600/30 text-indigo-300 rounded border border-indigo-500/30 text-xs"
                  >
                    Run Section Intelligence
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {sections.map((sec) => {
                    const isActive = currentPage >= (sec.startPage || 1) && currentPage <= (sec.endPage || numPages);
                    return (
                      <div
                        key={sec.id}
                        onClick={() => scrollToPage(sec.startPage || 1)}
                        className={`p-2.5 rounded-lg text-xs cursor-pointer transition-all border flex items-center justify-between ${' '}{
                          isActive
                            ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-200 font-medium'
                            : 'bg-slate-800/40 border-slate-700/40 hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="min-w-0 pr-2 space-y-0.5">
                          <p className="truncate font-medium">{sec.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            Page {sec.startPage} {sec.endPage ? `- ${sec.endPage}` : ''}
                          </p>
                        </div>
                        {sec.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Silent Dwell Info Footer */}
            <div className="pt-3 border-t border-slate-800/80 text-[10px] text-slate-500 font-mono space-y-1">
              <p className="flex items-center justify-between text-slate-400">
                <span>Silent Auto-Mark:</span>
                <span className="text-emerald-400">{settings.autoMarkDwell ? 'ACTIVE' : 'OFF'}</span>
              </p>
              <p className="text-slate-500">Dwell Threshold: {settings.dwellThresholdMinutes} min/section</p>
            </div>
          </div>
        )}

        {/* Continuous Canvas Scroll Viewer */}
        <div
          ref={scrollContainerRef}
          className="flex-1 bg-slate-950 rounded-xl border border-slate-800 overflow-auto p-6 space-y-6 custom-scrollbar shadow-inner"
        >
          {Array.from({ length: numPages }, (_, idx) => idx + 1).map((pNum) => (
            <div
              key={`page-container-${pNum}`}
              id={`pdf-page-${pNum}`}
              data-page-number={pNum}
              style={{
                width: pageDimensions[pNum] ? `${pageDimensions[pNum].width}px` : undefined,
                height: pageDimensions[pNum] ? `${pageDimensions[pNum].height}px` : undefined,
                minHeight: pageDimensions[pNum] ? `${pageDimensions[pNum].height}px` : '700px'
              }}
              className="relative bg-white shadow-2xl mx-auto my-6 rounded-sm border border-slate-300 shrink-0 select-text overflow-hidden"
            >
              <canvas
                ref={(el) => (canvasRefs.current[pNum] = el)}
                className="block"
              />
              {!renderedPages[pNum] && (
                <div className="absolute inset-0 bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-mono space-x-2">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                  <span>Loading Page {pNum}...</span>
                </div>
              )}
              <div className="absolute bottom-3 right-3 bg-slate-900/80 text-white font-mono text-[10px] px-2 py-0.5 rounded shadow pointer-events-none backdrop-blur-sm">
                Page {pNum} / {numPages}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
