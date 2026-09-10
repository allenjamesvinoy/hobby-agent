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
  Maximize2,
  Brain,
  Plus,
  Check,
  Copy,
  BookOpen,
  ArrowLeft,
  Bookmark
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';

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
  onAddFlashcard,
  flashcards = [],
  settings = { dwellThresholdMinutes: 3, autoMarkDwell: true },
  onOpenSettings
}) {
  const rawUrl = pdfUrl || pdfData;
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(totalPages || 1);
  const [currentPage, setCurrentPage] = useState(initialPage || 1);
  const [sections, setSections] = useState([]);
  const [showSectionsSidebar, setShowSectionsSidebar] = useState(true);
  const [sidebarTab, setSidebarTab] = useState('sections');
  const [isScanningSections, setIsScanningSections] = useState(false);
  const [scanMethod, setScanMethod] = useState('');
  const [renderedPages, setRenderedPages] = useState({});
  const [scale, setScale] = useState(1.25);
  const [pageDimensions, setPageDimensions] = useState({});

  // Navigation History state for link jumps
  const [returnPage, setReturnPage] = useState(null);

  // Text selection & floating toolbar state
  const [selectionToolbar, setSelectionToolbar] = useState({
    visible: false,
    x: 0,
    y: 0,
    text: '',
    sourcePage: 1
  });
  const [copySuccess, setCopySuccess] = useState(false);

  // Flashcard Creation States
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [cardFront, setCardFront] = useState('');
  const [cardBack, setCardBack] = useState('');
  const [cardSourcePage, setCardSourcePage] = useState(initialPage || 1);
  const [cardSavedFeedback, setCardSavedFeedback] = useState(false);
  
  const scrollContainerRef = useRef(null);
  const selectionToolbarRef = useRef(null);
  const canvasRefs = useRef({});
  const textLayerRefs = useRef({});
  const annotationLayerRefs = useRef({});
  const renderTasksRef = useRef({});
  const pageObserverRef = useRef(null);
  const isInitialScrollDone = useRef(false);
  const renderingRef = useRef({});
  const currentPageRef = useRef(currentPage);
  const scaleRef = useRef(scale);

  const paperFlashcards = paper?.id
    ? flashcards.filter((f) => f.paperId === paper.id)
    : [];

  const activeSection = sections.find(
    (s) => currentPage >= (s.startPage || 1) && currentPage <= (s.endPage || numPages)
  );

  const referencesSection = sections.find((s) =>
    /references|bibliography/i.test(s.name)
  );

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    setRenderedPages({});
    renderingRef.current = {};
  }, [scale]);

  const handleZoom = (newScale) => {
    const clamped = Math.max(0.6, Math.min(2.5, Number(newScale.toFixed(2))));
    const container = scrollContainerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const scrollLeft = container.scrollLeft;
      const scrollTop = container.scrollTop;
      const contentX = scrollLeft + centerX;
      const contentY = scrollTop + centerY;

      setScale((prev) => {
        if (clamped !== prev) {
          const ratio = clamped / prev;
          requestAnimationFrame(() => {
            container.scrollLeft = contentX * ratio - centerX;
            container.scrollTop = contentY * ratio - centerY;
          });
        }
        return clamped;
      });
    } else {
      setScale(clamped);
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !isOpen) return;

    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const scrollLeft = container.scrollLeft;
        const scrollTop = container.scrollTop;
        const contentX = scrollLeft + mouseX;
        const contentY = scrollTop + mouseY;
        
        const zoomDelta = -e.deltaY * 0.005;
        const zoomFactor = 1 + Math.max(-0.2, Math.min(0.2, zoomDelta));
        
        setScale((prev) => {
          const nextScale = Math.max(0.6, Math.min(2.5, Number((prev * zoomFactor).toFixed(2))));
          if (nextScale !== prev) {
            const ratio = nextScale / prev;
            requestAnimationFrame(() => {
              container.scrollLeft = contentX * ratio - mouseX;
              container.scrollTop = contentY * ratio - mouseY;
            });
          }
          return nextScale;
        });
      }
    };

    let gestureInitialScale = 1;
    const handleGestureStart = (e) => {
      e.preventDefault();
      gestureInitialScale = scaleRef.current;
    };

    const handleGestureChange = (e) => {
      e.preventDefault();
      if (e.scale) {
        const nextScale = Math.max(0.6, Math.min(2.5, Number((gestureInitialScale * e.scale).toFixed(2))));
        const rect = container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const scrollLeft = container.scrollLeft;
        const scrollTop = container.scrollTop;
        const contentX = scrollLeft + centerX;
        const contentY = scrollTop + centerY;
        
        setScale((prev) => {
          if (nextScale !== prev) {
            const ratio = nextScale / prev;
            requestAnimationFrame(() => {
              container.scrollLeft = contentX * ratio - centerX;
              container.scrollTop = contentY * ratio - centerY;
            });
          }
          return nextScale;
        });
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('gesturestart', handleGestureStart, { passive: false });
    container.addEventListener('gesturechange', handleGestureChange, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('gesturestart', handleGestureStart);
      container.removeEventListener('gesturechange', handleGestureChange);
    };
  }, [isOpen]);

  // Selection tracking for floating Copy / Flashcard popup
  useEffect(() => {
    if (!isOpen) return;
    const handleSelectionCheck = (e) => {
      if (e && e.target && selectionToolbarRef.current && selectionToolbarRef.current.contains(e.target)) {
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setSelectionToolbar((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }

      const text = selection.toString().trim();
      if (!text) {
        setSelectionToolbar((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const container = scrollContainerRef.current;
      if (!container) return;

      let srcPage = currentPage;
      let node = range.commonAncestorContainer;
      if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      const pageEl = node?.closest('[data-page-number]');
      if (pageEl) {
        srcPage = Number(pageEl.getAttribute('data-page-number')) || currentPage;
      }

      const popupX = Math.max(20, Math.min(window.innerWidth - 280, rect.left + rect.width / 2 - 110));
      const popupY = rect.top > 90 ? rect.top - 48 : rect.bottom + 10;

      setSelectionToolbar({
        visible: true,
        x: popupX,
        y: popupY,
        text,
        sourcePage: srcPage
      });
    };

    document.addEventListener('mouseup', handleSelectionCheck);
    return () => document.removeEventListener('mouseup', handleSelectionCheck);
  }, [isOpen, currentPage]);

  const handleCopySelectedText = async () => {
    if (selectionToolbar.text) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(selectionToolbar.text);
        } else {
          const textArea = document.createElement('textarea');
          textArea.value = selectionToolbar.text;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
        console.error('Failed copying text:', err);
      }
    }
  };

  const handleCreateCardFromSelection = () => {
    const text = selectionToolbar.text;
    if (!text) return;
    if (text.length <= 100) {
      setCardFront(text);
      setCardBack('');
    } else {
      setCardFront('');
      setCardBack(text);
    }
    setCardSourcePage(selectionToolbar.sourcePage || currentPage);
    setIsCardModalOpen(true);
    setSelectionToolbar((prev) => ({ ...prev, visible: false }));
  };

  const handleOpenCardModal = () => {
    const selectedText = window.getSelection()?.toString()?.trim() || '';
    if (selectedText) {
      if (selectedText.length <= 100 && !cardFront) {
        setCardFront(selectedText);
      } else if (!cardBack) {
        setCardBack(selectedText);
      }
    }
    setCardSourcePage(currentPage);
    setIsCardModalOpen(true);
  };

  const handleSaveFlashcard = (keepOpen = false) => {
    if (!cardFront.trim() || !cardBack.trim()) return;

    if (onAddFlashcard) {
      onAddFlashcard({
        paperId: paper?.id,
        front: cardFront.trim(),
        back: cardBack.trim(),
        sourcePage: cardSourcePage || currentPage,
        sourceSection: activeSection?.name || '',
        mastery: 'New',
        masteryLevel: 'unreviewed'
      });
    }

    setCardFront('');
    setCardBack('');
    setCardSavedFeedback(true);
    setTimeout(() => setCardSavedFeedback(false), 2500);

    if (!keepOpen) {
      setIsCardModalOpen(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handleOpenCardModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentPage, activeSection]);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

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
        try { task?.cancel(); } catch (e) {}
      });
      renderTasksRef.current = {};
      isInitialScrollDone.current = false;
    };
  }, [isOpen, rawUrl]);

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

  // Navigation helper storing return history
  const jumpToPageWithHistory = (targetPageNum) => {
    if (targetPageNum && targetPageNum !== currentPage) {
      setReturnPage(currentPage);
      scrollToPage(targetPageNum);
    }
  };

  // Render canvas, text layer, and annotation links
  useEffect(() => {
    if (!pdfDoc || !isOpen) return;
    let isCancelled = false;

    const renderCanvasPage = async (pageNum) => {
      if (renderingRef.current[pageNum] || renderedPages[pageNum]) return;
      renderingRef.current[pageNum] = true;

      if (renderTasksRef.current[pageNum]) {
        try { renderTasksRef.current[pageNum].cancel(); } catch (e) {}
      }

      try {
        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled) return;

        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRefs.current[pageNum];
        if (!canvas) return;

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);

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

        // Render Text Layer for Text Selection & Copying
        const textLayerDiv = textLayerRefs.current[pageNum];
        if (textLayerDiv) {
          textLayerDiv.innerHTML = '';
          try {
            const textContent = await page.getTextContent();
            if (isCancelled) return;

            if (typeof pdfjsLib.renderTextLayer === 'function') {
              const textTask = pdfjsLib.renderTextLayer({
                textContentSource: textContent,
                container: textLayerDiv,
                viewport: viewport,
                textDivs: []
              });
              if (textTask && textTask.promise) {
                await textTask.promise;
              }
            } else if (pdfjsLib.TextLayer) {
              const textLayer = new pdfjsLib.TextLayer({
                textContentSource: textContent,
                container: textLayerDiv,
                viewport: viewport
              });
              await textLayer.render();
            } else {
              throw new Error('No native renderTextLayer function');
            }
          } catch (err) {
            // Fallback custom text placement
            try {
              const textContent = await page.getTextContent();
              if (isCancelled) return;
              textLayerDiv.innerHTML = '';
              textContent.items.forEach((item) => {
                if (!item.str) return;
                const transform = item.transform;
                const tx = pdfjsLib.Util ? pdfjsLib.Util.transform(viewport.transform, transform) : transform;
                const fontHeight = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
                const span = document.createElement('span');
                span.textContent = item.str;
                span.style.left = `${tx[4]}px`;
                span.style.top = `${tx[5] - fontHeight}px`;
                span.style.fontSize = `${fontHeight}px`;
                span.style.position = 'absolute';
                span.style.transformOrigin = '0% 0%';
                span.style.whiteSpace = 'pre';
                span.style.color = 'transparent';
                span.style.cursor = 'text';
                textLayerDiv.appendChild(span);
              });
            } catch (e) {
              console.warn(`Text layer rendering failed for page ${pageNum}:`, e);
            }
          }
        }

        // Render Annotation Layer for Reference & Internal PDF links
        const annotLayerDiv = annotationLayerRefs.current[pageNum];
        if (annotLayerDiv) {
          annotLayerDiv.innerHTML = '';
          try {
            const annotations = await page.getAnnotations();
            if (isCancelled) return;
            for (const annot of annotations) {
              if (annot.subtype === 'Link' && annot.rect) {
                const vRect = viewport.convertToViewportRectangle(annot.rect);
                const left = Math.min(vRect[0], vRect[2]);
                const top = Math.min(vRect[1], vRect[3]);
                const width = Math.abs(vRect[0] - vRect[2]);
                const height = Math.abs(vRect[1] - vRect[3]);

                const link = document.createElement('a');
                link.className = 'linkAnnotation';
                link.style.left = `${left}px`;
                link.style.top = `${top}px`;
                link.style.width = `${width}px`;
                link.style.height = `${height}px`;

                if (annot.url) {
                  link.href = annot.url;
                  link.target = '_blank';
                  link.rel = 'noopener noreferrer';
                  link.title = `External Link: ${annot.url}`;
                } else if (annot.dest) {
                  link.href = '#';
                  link.title = 'Jump to reference or section';
                  link.onclick = async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                      let dest = annot.dest;
                      if (typeof dest === 'string') {
                        dest = await pdfDoc.getDestination(dest);
                      }
                      if (Array.isArray(dest) && dest[0]) {
                        const pageIdx = await pdfDoc.getPageIndex(dest[0]);
                        jumpToPageWithHistory(pageIdx + 1);
                      }
                    } catch (err) {
                      console.warn('Failed resolving link destination:', err);
                    }
                  };
                }
                annotLayerDiv.appendChild(link);
              }
            }
          } catch (err) {
            console.warn(`Error rendering annotations on page ${pageNum}:`, err);
          }
        }

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
        try { task?.cancel(); } catch (e) {}
      });
      renderTasksRef.current = {};
    };
  }, [pdfDoc, isOpen, numPages, scale]);

  useEffect(() => {
    if (isOpen && pdfDoc && !isInitialScrollDone.current) {
      const targetPage = initialPage || (paper && paper.currentPage) || 1;
      setTimeout(() => {
        scrollToPage(targetPage);
        isInitialScrollDone.current = true;
      }, 300);
    }
  }, [isOpen, pdfDoc, initialPage]);

  const runSectionScanner = async () => {
    if (!pdfDoc) return;
    setIsScanningSections(true);
    setScanMethod('Scanning Outline...');

    let detected = [];

    try {
      const outline = await pdfDoc.getOutline();
      if (outline && outline.length > 0) {
        setScanMethod('Tier 1: Embedded Outline');
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

      if (detected.length === 0) {
        setScanMethod('Tier 2: Text Extraction');
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

        if (detected.length === 0 && totalTextItems < 10) {
          setScanMethod('Tier 3: OCR Detection');
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

  useEffect(() => {
    if (pdfDoc && paper) {
      if (paper.sections && paper.sections.length > 0 && paper.sections[0].startPage) {
        setSections(paper.sections);
      } else {
        runSectionScanner();
      }
    }
  }, [pdfDoc, paper?.id]);

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
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex flex-col p-4 select-none">
      {/* Top Navigation & Status Bar */}
      <div className="flex items-center justify-between mb-3 text-stone-800 bg-white px-4 py-2.5 rounded-xl border border-stone-200/90 shadow-md shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowSectionsSidebar(!showSectionsSidebar)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showSectionsSidebar ? 'bg-stone-100 text-stone-900 border border-stone-200' : 'bg-white text-stone-500 hover:text-stone-800'
            }`}
            title="Toggle Outline / Flashcards Sidebar"
          >
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">Sidebar</span>
          </button>

          {/* Jump to References section button */}
          {referencesSection && (
            <button
              onClick={() => jumpToPageWithHistory(referencesSection.startPage)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-medium transition-colors border border-stone-200"
              title={`Jump directly to References section (Page ${referencesSection.startPage})`}
            >
              <BookOpen className="w-3.5 h-3.5 text-stone-600" />
              <span className="hidden sm:inline">References (p. {referencesSection.startPage})</span>
            </button>
          )}

          {/* Quick Create Flashcard Button */}
          <button
            onClick={handleOpenCardModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium shadow-xs transition-all hover:scale-105 active:scale-95"
            title="Create Flashcard from current reading spot (⌘+K / Ctrl+K)"
          >
            <Brain className="w-3.5 h-3.5" />
            <span>+ Flashcard</span>
            {paperFlashcards.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 bg-stone-700 text-white rounded-full text-[10px] font-mono">
                {paperFlashcards.length}
              </span>
            )}
          </button>

          {cardSavedFeedback && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-mono animate-in fade-in">
              <Check className="w-3.5 h-3.5" /> Saved!
            </span>
          )}

          <h3 className="font-semibold text-xs truncate max-w-xs md:max-w-sm text-stone-800 hidden md:block" title={title || 'PDF Document'}>
            {title || 'PDF Document'}
          </h3>
        </div>

        {/* Center: Page Navigation & Zoom Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-stone-50 px-3 py-1 rounded-lg border border-stone-200/80 font-mono text-xs">
            <button
              onClick={() => scrollToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-1 hover:bg-stone-200/60 rounded text-stone-600 disabled:opacity-30 transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-stone-400">Page</span>
            <input
              type="number"
              min="1"
              max={numPages}
              value={currentPage}
              onChange={(e) => scrollToPage(Number(e.target.value) || 1)}
              className="w-12 text-center bg-white border border-stone-200 rounded px-1 py-0.5 text-xs text-stone-900 font-bold focus:outline-none focus:border-stone-400"
            />
            <span className="text-stone-400">of {numPages}</span>
            <button
              onClick={() => scrollToPage(currentPage + 1)}
              disabled={currentPage >= numPages}
              className="p-1 hover:bg-stone-200/60 rounded text-stone-600 disabled:opacity-30 transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-stone-50 px-2 py-1 rounded-lg border border-stone-200/80 font-mono text-xs">
            <button
              onClick={() => handleZoom(scale - 0.2)}
              disabled={scale <= 0.6}
              className="p-1 hover:bg-stone-200/60 rounded text-stone-600 disabled:opacity-30 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleZoom(1.25)}
              className="px-1.5 py-0.5 hover:bg-stone-200/60 rounded text-stone-700 text-xs font-semibold"
              title="Reset Zoom (125%)"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              onClick={() => handleZoom(scale + 0.2)}
              disabled={scale >= 2.5}
              className="p-1 hover:bg-stone-200/60 rounded text-stone-600 disabled:opacity-30 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleZoom(scale === 1.0 ? 1.4 : 1.0)}
              className="p-1 hover:bg-stone-200/60 rounded text-stone-600 transition-colors ml-0.5"
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
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium transition-colors border border-stone-200"
              title="Reading Settings"
            >
              <Settings className="w-3.5 h-3.5 text-stone-600" />
              <span className="hidden sm:inline">{settings.dwellThresholdMinutes}m Threshold</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
            title="Close Reader"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Viewport Workspace */}
      <div className="flex-1 flex overflow-hidden gap-4">
        {/* Collapsible Sections & Flashcards Sidebar */}
        {showSectionsSidebar && (
          <div className="w-72 bg-[#f7f6f3] border border-stone-200/90 rounded-xl p-3 flex flex-col justify-between shrink-0 overflow-y-auto space-y-3 shadow-md">
            <div className="space-y-3">
              {/* Sidebar Tabs */}
              <div className="grid grid-cols-2 p-1 bg-stone-200/60 rounded-lg border border-stone-200/80 text-xs font-semibold">
                <button
                  onClick={() => setSidebarTab('sections')}
                  className={`py-1.5 rounded-md text-center transition-all flex items-center justify-center gap-1.5 ${
                    sidebarTab === 'sections'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" /> Outline
                </button>
                <button
                  onClick={() => setSidebarTab('flashcards')}
                  className={`py-1.5 rounded-md text-center transition-all flex items-center justify-center gap-1.5 ${
                    sidebarTab === 'flashcards'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <Brain className="w-3.5 h-3.5" /> Cards ({paperFlashcards.length})
                </button>
              </div>

              {sidebarTab === 'sections' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-stone-200/80 pb-2">
                    <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-stone-500" /> Outline Sections
                    </span>
                    <button
                      onClick={runSectionScanner}
                      disabled={isScanningSections}
                      className="text-[10px] text-stone-600 hover:text-stone-900 font-mono underline disabled:opacity-50"
                    >
                      Re-Scan
                    </button>
                  </div>

                  {isScanningSections ? (
                    <div className="py-8 text-center space-y-2 text-stone-500 text-xs">
                      <Loader2 className="w-5 h-5 text-stone-700 animate-spin mx-auto" />
                      <p className="font-mono text-[10px]">{scanMethod}</p>
                    </div>
                  ) : sections.length === 0 ? (
                    <div className="py-8 text-center text-stone-400 text-xs space-y-2 font-mono">
                      <p>No outline sections detected.</p>
                      <button
                        onClick={runSectionScanner}
                        className="px-3 py-1 bg-white text-stone-700 rounded border border-stone-200 text-xs font-sans shadow-xs"
                      >
                        Scan PDF Outline
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1 custom-scrollbar">
                      {sections.map((sec) => {
                        const isActive = currentPage >= (sec.startPage || 1) && currentPage <= (sec.endPage || numPages);
                        return (
                          <div
                            key={sec.id}
                            onClick={() => jumpToPageWithHistory(sec.startPage || 1)}
                            className={`p-2.5 rounded-lg text-xs cursor-pointer transition-all border flex items-center justify-between ${
                              isActive
                                ? 'bg-white border-stone-300 text-stone-900 font-medium shadow-xs'
                                : 'bg-stone-50/50 border-stone-200/60 hover:bg-white text-stone-700'
                            }`}
                          >
                            <div className="min-w-0 pr-2 space-y-0.5">
                              <p className="truncate font-medium">{sec.name}</p>
                              <p className="text-[10px] text-stone-400 font-mono">
                                Page {sec.startPage} {sec.endPage ? `- ${sec.endPage}` : ''}
                              </p>
                            </div>
                            {sec.completed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                              <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* Flashcards Tab Content */
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-stone-200/80 pb-2">
                    <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <Brain className="w-3.5 h-3.5 text-stone-500" /> Active Recall
                    </span>
                    <button
                      onClick={handleOpenCardModal}
                      className="text-[11px] font-semibold text-stone-800 hover:text-stone-900 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>

                  {paperFlashcards.length === 0 ? (
                    <div className="py-8 text-center text-stone-400 text-xs space-y-3">
                      <Brain className="w-8 h-8 mx-auto text-stone-300" />
                      <p className="text-[11px]">No flashcards created yet for this paper.</p>
                      <button
                        onClick={handleOpenCardModal}
                        className="px-3 py-1.5 bg-white hover:bg-stone-50 text-stone-800 rounded-lg text-xs font-medium border border-stone-200 shadow-xs transition-colors"
                      >
                        + Create First Card (p. {currentPage})
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1 custom-scrollbar">
                      {paperFlashcards.map((card) => (
                        <div
                          key={card.id}
                          className="p-2.5 rounded-lg bg-white border border-stone-200/80 hover:border-stone-300 transition-all text-xs space-y-1.5 group shadow-xs"
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <p className="font-semibold text-stone-800 leading-snug line-clamp-2">
                              {card.front}
                            </p>
                            {card.sourcePage && (
                              <button
                                onClick={() => jumpToPageWithHistory(card.sourcePage)}
                                className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200 text-[10px] font-mono hover:bg-stone-200 shrink-0"
                                title={`Jump directly to Page ${card.sourcePage} in PDF`}
                              >
                                p. {card.sourcePage}
                              </button>
                            )}
                          </div>
                          <p className="text-stone-600 text-[11px] line-clamp-2 bg-stone-50 p-1.5 rounded border border-stone-100 font-sans">
                            {card.back}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Silent Dwell / Stats Info Footer */}
            <div className="pt-3 border-t border-stone-200/80 text-[10px] text-stone-500 font-mono space-y-1">
              <p className="flex items-center justify-between text-stone-500">
                <span>Auto-Mark:</span>
                <span className="text-emerald-600 font-semibold">{settings.autoMarkDwell ? 'ACTIVE' : 'OFF'}</span>
              </p>
              <p className="text-stone-400">Dwell: {settings.dwellThresholdMinutes}m/section • {paperFlashcards.length} Cards</p>
            </div>
          </div>
        )}

        {/* Continuous Canvas Scroll Viewer */}
        <div
          ref={scrollContainerRef}
          className="flex-1 bg-stone-200/60 rounded-xl border border-stone-200/80 overflow-auto p-6 space-y-6 custom-scrollbar shadow-inner relative"
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
              className="relative bg-white shadow-md mx-auto my-6 rounded-sm border border-stone-300 shrink-0 select-text overflow-hidden"
            >
              <canvas
                ref={(el) => (canvasRefs.current[pNum] = el)}
                className="block"
              />
              <div
                ref={(el) => (textLayerRefs.current[pNum] = el)}
                className="textLayer"
              />
              <div
                ref={(el) => (annotationLayerRefs.current[pNum] = el)}
                className="annotationLayer"
              />
              {!renderedPages[pNum] && (
                <div className="absolute inset-0 bg-stone-50 flex items-center justify-center text-stone-500 text-xs font-mono space-x-2">
                  <Loader2 className="w-5 h-5 animate-spin text-stone-600" />
                  <span>Loading Page {pNum}...</span>
                </div>
              )}
              <div className="absolute bottom-3 right-3 bg-stone-900/80 text-white font-mono text-[10px] px-2 py-0.5 rounded shadow pointer-events-none backdrop-blur-xs">
                Page {pNum} / {numPages}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating Selection Toolbar for Copying Text & Converting to Flashcard */}
      {selectionToolbar.visible && (
        <div
          ref={selectionToolbarRef}
          style={{
            position: 'fixed',
            left: `${selectionToolbar.x}px`,
            top: `${selectionToolbar.y}px`,
            zIndex: 70
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="bg-stone-900 text-white rounded-xl shadow-2xl p-1.5 flex items-center gap-1 border border-stone-700 animate-in fade-in zoom-in-95 duration-150 select-none"
        >
          <button
            onClick={handleCopySelectedText}
            className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-stone-800 rounded-lg text-xs font-medium text-stone-200 transition-colors"
            title="Copy selected text to clipboard"
          >
            {copySuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            )
            : (
              <>
                <Copy className="w-3.5 h-3.5 text-stone-400" />
                <span>Copy</span>
              </>
            )}
          </button>
          <div className="w-px h-4 bg-stone-700" />
          <button
            onClick={handleCreateCardFromSelection}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white shadow-xs transition-colors"
            title="Convert selected text directly into a flashcard"
          >
            <Brain className="w-3.5 h-3.5" />
            <span>+ Flashcard</span>
          </button>
        </div>
      )}

      {/* Return to Page banner when jumping via link */}
      {returnPage && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white px-4 py-2 rounded-xl shadow-2xl flex items-center gap-3 border border-stone-700 animate-in fade-in slide-in-from-bottom-3 text-xs font-medium">
          <Bookmark className="w-4 h-4 text-amber-400" />
          <span>Jumped to Page {currentPage}</span>
          <button
            onClick={() => {
              scrollToPage(returnPage);
              setReturnPage(null);
            }}
            className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors border border-stone-600"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Return to Page {returnPage}
          </button>
          <button
            onClick={() => setReturnPage(null)}
            className="p-1 hover:bg-stone-800 rounded text-stone-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Quick-Create Flashcard Modal */}
      {isCardModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-xs flex items-center justify-center p-4 select-text">
          <div
            className="w-full max-w-lg bg-white border border-stone-200 rounded-2xl p-5 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                handleSaveFlashcard(false);
              }
            }}
          >
            <div className="flex items-start justify-between border-b border-stone-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-stone-800 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-stone-700" /> Create Flashcard
                </h4>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-stone-500 font-mono">
                  <span className="truncate max-w-[180px] text-stone-700">{title}</span>
                  <span>•</span>
                  <span className="px-1.5 py-0.5 rounded bg-stone-100 border border-stone-200 text-stone-800">
                    Page {cardSourcePage}
                  </span>
                  {activeSection && (
                    <span className="truncate max-w-[140px] text-stone-500">
                      ({activeSection.name})
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setIsCardModalOpen(false)}
                className="p-1 hover:bg-stone-100 rounded text-stone-400 hover:text-stone-700 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Front (Question / Concept / Term)
                </label>
                <textarea
                  autoFocus
                  rows={3}
                  value={cardFront}
                  onChange={(e) => setCardFront(e.target.value)}
                  placeholder="e.g., What does Scaled Dot-Product Attention compute?"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-400 focus:bg-white resize-none font-sans shadow-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Back (Answer / Explanation / Takeaway)
                </label>
                <textarea
                  rows={4}
                  value={cardBack}
                  onChange={(e) => setCardBack(e.target.value)}
                  placeholder="e.g., Computes dot products of queries with all keys, divides by sqrt(d_k), applies softmax..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-400 focus:bg-white resize-none font-sans shadow-xs"
                />
              </div>

              <div className="flex items-center justify-between pt-1 text-xs">
                <span className="text-stone-500 font-mono text-[11px]">
                  Referenced Page in PDF:
                </span>
                <div className="flex items-center gap-1 font-mono">
                  <span className="text-stone-400">Page</span>
                  <input
                    type="number"
                    min="1"
                    max={numPages}
                    value={cardSourcePage}
                    onChange={(e) => setCardSourcePage(Number(e.target.value) || currentPage)}
                    className="w-14 text-center bg-stone-50 border border-stone-200 rounded px-1.5 py-0.5 text-xs text-stone-800 font-bold focus:outline-none focus:border-stone-400"
                  />
                  <span className="text-stone-400">of {numPages}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-stone-100">
              <span className="text-[10px] text-stone-400 font-mono hidden sm:inline">
                Press ⌘+Enter to save
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setIsCardModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveFlashcard(true)}
                  disabled={!cardFront.trim() || !cardBack.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 disabled:opacity-40 transition-colors shadow-xs"
                  title="Save card and keep dialog open to add another"
                >
                  Save & Add Another
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveFlashcard(false)}
                  disabled={!cardFront.trim() || !cardBack.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-white shadow-xs disabled:opacity-40 transition-colors"
                >
                  Save Flashcard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
