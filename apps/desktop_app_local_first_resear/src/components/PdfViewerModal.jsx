import React, { useState, useEffect } from 'react';
import { X, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';

function dataURLtoBlob(dataurl) {
  try {
    const arr = dataurl.split(',');
    if (arr.length < 2) return null;
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (e) {
    console.error('Error converting data URL to blob:', e);
    return null;
  }
}

export default function PdfViewerModal({
  isOpen,
  pdfUrl,
  pdfData,
  title,
  initialPage = 1,
  totalPages = 1,
  onPageChange,
  onClose
}) {
  const rawUrl = pdfUrl || pdfData;
  const [objectUrl, setObjectUrl] = useState(null);
  const [currentPage, setCurrentPage] = useState(initialPage || 1);

  useEffect(() => {
    if (isOpen) {
      setCurrentPage(Number(initialPage) || 1);
    }
  }, [isOpen, initialPage]);

  useEffect(() => {
    if (!isOpen || !rawUrl) {
      setObjectUrl(null);
      return;
    }

    let createdUrl = null;
    if (typeof rawUrl === 'string' && rawUrl.startsWith('data:')) {
      const blob = dataURLtoBlob(rawUrl);
      if (blob) {
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      } else {
        setObjectUrl(rawUrl);
      }
    } else {
      setObjectUrl(rawUrl);
    }

    return () => {
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [isOpen, rawUrl]);

  const maxPages = totalPages && Number(totalPages) > 1 ? Number(totalPages) : 9999;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handleSetPage(currentPage - 1);
      } else if (e.key === 'ArrowRight') {
        handleSetPage(currentPage + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, currentPage, maxPages]);

  if (!isOpen || !rawUrl) return null;

  const baseUrl = objectUrl || rawUrl;
  // Append #page=N parameter to force browser/embedded PDF viewer to open at saved page
  const displayUrl = baseUrl ? `${baseUrl.split('#')[0]}#page=${currentPage}` : '';

  const handleSetPage = (newPage) => {
    const validPage = Math.max(1, Math.min(maxPages, newPage));
    setCurrentPage(validPage);
    if (onPageChange) {
      onPageChange(validPage);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col p-6">
      {/* Top Controller Toolbar */}
      <div className="flex items-center justify-between mb-4 text-slate-100 bg-slate-900 px-4 py-3 rounded-xl border border-slate-800 shadow-lg">
        <h3 className="font-semibold text-sm truncate max-w-xs md:max-w-md">
          PDF Preview: {title || 'Document'}
        </h3>

        {/* Page Controller */}
        <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1 rounded-lg border border-slate-700/60 font-mono text-xs">
          <button
            onClick={() => handleSetPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-1 hover:bg-slate-700 rounded text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Previous Page (Left Arrow)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-slate-400">Page</span>
          <input
            type="number"
            min="1"
            max={maxPages}
            value={currentPage}
            onChange={(e) => handleSetPage(Number(e.target.value) || 1)}
            className="w-12 text-center bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-indigo-300 font-bold focus:outline-none focus:border-indigo-500"
          />
          <span className="text-slate-400">
            of {totalPages && Number(totalPages) > 1 ? totalPages : '?'}
          </span>

          <button
            onClick={() => handleSetPage(currentPage + 1)}
            disabled={totalPages && Number(totalPages) > 1 ? currentPage >= totalPages : false}
            className="p-1 hover:bg-slate-700 rounded text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Next Page (Right Arrow)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {displayUrl && (
            <a
              href={displayUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1 font-medium transition-colors hidden sm:flex"
            >
              Open External <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
            title="Close viewer (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* PDF Viewer Frame */}
      <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden relative">
        <object
          key={`pdf-page-${currentPage}`}
          data={displayUrl}
          type="application/pdf"
          className="w-full h-full border-0"
        >
          <iframe
            src={displayUrl}
            title={title || 'Research Paper PDF'}
            className="w-full h-full border-0"
          >
            <div className="p-8 text-center text-slate-400">
              <p className="mb-4">Unable to display PDF directly in browser.</p>
              <a
                href={displayUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg"
              >
                Download / Open PDF <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </iframe>
        </object>
      </div>
    </div>
  );
}
