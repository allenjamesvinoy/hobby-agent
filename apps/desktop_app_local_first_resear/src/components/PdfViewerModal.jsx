import React, { useState, useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';

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

export default function PdfViewerModal({ isOpen, pdfUrl, pdfData, title, onClose }) {
  const rawUrl = pdfUrl || pdfData;
  const [objectUrl, setObjectUrl] = useState(null);

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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !rawUrl) return null;

  const displayUrl = objectUrl || rawUrl;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col p-6">
      <div className="flex items-center justify-between mb-4 text-slate-100 bg-slate-900 px-4 py-3 rounded-xl border border-slate-800 shadow-lg">
        <h3 className="font-semibold text-sm truncate max-w-xl">
          PDF Preview: {title || 'Document'}
        </h3>
        <div className="flex items-center gap-3">
          {displayUrl && (
            <a
              href={displayUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1 font-medium transition-colors"
            >
              Open External <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
            title="Close viewer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden relative">
        <object
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
