import React from 'react';
import { X, ExternalLink } from 'lucide-react';

export default function PdfViewerModal({ pdfUrl, title, onClose }) {
  if (!pdfUrl) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col p-6">
      <div className="flex items-center justify-between mb-4 text-slate-100 bg-slate-900 px-4 py-3 rounded-xl border border-slate-800">
        <h3 className="font-semibold text-sm truncate max-w-xl">PDF Preview: {title}</h3>
        <div className="flex items-center gap-3">
          {pdfUrl.startsWith('data:') ? null : (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-indigo-400 hover:underline flex items-center gap-1"
            >
              Open External <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
        <iframe
          src={pdfUrl}
          title="Research Paper PDF"
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
}