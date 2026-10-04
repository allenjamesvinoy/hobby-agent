import React, { useState, useEffect } from 'react';
import {
  X,
  Quote,
  Copy,
  Check,
  Search,
  Loader2,
  HardDrive,
  Globe,
  FileCode,
  Bookmark,
  AlertTriangle
} from 'lucide-react';
import CitationEngine from '../services/CitationEngine';

export default function CitationModal({
  isOpen,
  onClose,
  initialDoi = '',
  initialBibTeX = '',
  onSaveCitation
}) {
  const [doiInput, setDoiInput] = useState(initialDoi);
  const [bibtexInput, setBibtexInput] = useState(initialBibTeX);
  const [activeInputMode, setActiveInputMode] = useState('doi');
  const [loading, setLoading] = useState(false);
  const [citation, setCitation] = useState(null);
  const [error, setError] = useState(null);
  const [copiedBibtex, setCopiedBibtex] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setCopiedBibtex(false);
      setCopiedKey(false);
      setSavedFeedback(false);

      if (initialDoi) {
        setDoiInput(initialDoi);
        setActiveInputMode('doi');
        handleResolveDoi(initialDoi);
      } else if (initialBibTeX) {
        setBibtexInput(initialBibTeX);
        setActiveInputMode('bibtex');
        handleParseBibTeX(initialBibTeX);
      } else {
        setDoiInput('');
        setBibtexInput('');
        setCitation(null);
      }
    }
  }, [isOpen, initialDoi, initialBibTeX]);

  if (!isOpen) return null;

  const handleResolveDoi = async (doiToResolve) => {
    const targetDoi = doiToResolve || doiInput;
    if (!targetDoi.trim()) {
      setError('Please enter a valid DOI string.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await CitationEngine.fetchByDoi(targetDoi);
      setCitation(res);
      if (res.raw) {
        setBibtexInput(res.raw);
      }
    } catch (err) {
      setError(err.message || 'Failed to resolve DOI citation metadata.');
    } finally {
      setLoading(false);
    }
  };

  const handleParseBibTeX = (rawBibText) => {
    const textToParse = rawBibText !== undefined ? rawBibText : bibtexInput;
    if (!textToParse.trim()) {
      setError('Please paste a raw BibTeX string.');
      return;
    }
    setError(null);
    try {
      const parsed = CitationEngine.parseBibTeX(textToParse);
      if (!parsed.title && !parsed.authors) {
        setError('Could not extract valid citation fields from raw BibTeX.');
      }
      setCitation(parsed);
      if (parsed.doi) {
        setDoiInput(parsed.doi);
      }
    } catch (err) {
      setError('Failed to parse BibTeX string.');
    }
  };

  const handleCopyBibtex = async () => {
    if (!citation) return;
    const bibText = citation.raw || CitationEngine.formatBibTeX(citation);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(bibText);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = bibText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedBibtex(true);
      setTimeout(() => setCopiedBibtex(false), 2000);
    } catch (e) {
      console.error('Failed to copy BibTeX:', e);
    }
  };

  const handleCopyCiteKey = async () => {
    if (!citation?.citeKey) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(citation.citeKey);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = citation.citeKey;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch (e) {
      console.error('Failed to copy citeKey:', e);
    }
  };

  const handleSaveCitationToCache = () => {
    if (!citation) return;
    const doiKey = citation.doi || citation.citeKey || 'cit_' + Date.now();
    CitationEngine.saveToCache(doiKey, citation);
    if (onSaveCitation) {
      onSaveCitation(citation);
    }
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-[#fbfbfa] border border-stone-200/90 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 px-6 border-b border-stone-200 flex items-center justify-between bg-white/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-stone-900 text-white flex items-center justify-center shadow-xs">
              <Quote className="w-4 h-4 text-stone-100" />
            </div>
            <div>
              <h2 className="font-bold text-stone-900 text-sm tracking-tight">Citation & DOI Resolver</h2>
              <p className="text-[10px] text-stone-500 font-mono">Local-First BibTeX Citation Engine</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Input Switcher Tab */}
        <div className="p-6 pb-4 space-y-4 overflow-y-auto flex-1">
          <div className="flex gap-2 border-b border-stone-200 pb-3 text-xs font-medium">
            <button
              onClick={() => setActiveInputMode('doi')}
              className={`px-3 py-1.5 rounded-lg font-mono transition-colors ${
                activeInputMode === 'doi'
                  ? 'bg-stone-900 text-white font-semibold'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              DOI Auto-Resolve
            </button>
            <button
              onClick={() => setActiveInputMode('bibtex')}
              className={`px-3 py-1.5 rounded-lg font-mono transition-colors ${
                activeInputMode === 'bibtex'
                  ? 'bg-stone-900 text-white font-semibold'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              Raw BibTeX Parser
            </button>
          </div>

          {activeInputMode === 'doi' ? (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-stone-700">Digital Object Identifier (DOI)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={doiInput}
                  onChange={(e) => setDoiInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleResolveDoi()}
                  placeholder="e.g. 10.1145/3290605.3300508 or https://doi.org/..."
                  className="flex-1 bg-white border border-stone-200 rounded-xl px-3.5 py-2 text-xs text-stone-800 font-mono placeholder-stone-400 focus:outline-none focus:border-stone-400 shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => handleResolveDoi()}
                  disabled={loading || !doiInput.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs shrink-0"
                >
                  {loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  <span>Resolve Citation</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-stone-700">Raw BibTeX String</label>
              <textarea
                rows={4}
                value={bibtexInput}
                onChange={(e) => setBibtexInput(e.target.value)}
                placeholder="@article{vaswani2017attention, title={Attention is all you need}, author={Vaswani, Ashish...}, year={2017}}"
                className="w-full bg-white border border-stone-200 rounded-xl p-3 text-xs text-stone-800 font-mono placeholder-stone-400 focus:outline-none focus:border-stone-400 resize-none shadow-xs"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleParseBibTeX()}
                  disabled={!bibtexInput.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Parse BibTeX</span>
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Formatted Citation Card */}
          {citation && (
            <div className="space-y-4 pt-2">
              <div className="bg-white border border-stone-200/90 rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="flex items-center gap-1.5 font-semibold text-stone-600">
                    {citation.isCached ? (
                      <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <HardDrive className="w-3 h-3 text-emerald-600" /> Local Cache
                      </span>
                    ) : citation.isOfflineFallback ? (
                      <span className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        <AlertTriangle className="w-3 h-3 text-amber-600" /> Offline Fallback
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                        <Globe className="w-3 h-3 text-sky-600" /> CrossRef Live API
                      </span>
                    )}
                  </span>
                  {citation.citeKey && (
                    <button
                      type="button"
                      onClick={handleCopyCiteKey}
                      className="px-2 py-0.5 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 flex items-center gap-1 transition-colors"
                      title="Copy Citation Key"
                    >
                      {copiedKey ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span className="font-bold">@{citation.citeKey}</span>
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-stone-900 leading-snug">
                    {citation.title || 'Untitled Publication'}
                  </h3>
                  <p className="text-xs text-stone-600 font-sans">
                    {citation.authors || 'Unknown Authors'}
                  </p>
                  <p className="text-[11px] text-stone-400 font-mono pt-1">
                    {citation.journal ? `${citation.journal} ` : ''}
                    {citation.year ? `(${citation.year})` : ''}
                    {citation.doi ? ` â¢ DOI: ${citation.doi}` : ''}
                  </p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-stone-100">
                  <div className="flex items-center justify-between text-[10px] font-mono text-stone-400 font-semibold uppercase tracking-wider">
                    <span>Formatted BibTeX Entry</span>
                    <button
                      type="button"
                      onClick={handleCopyBibtex}
                      className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 normal-case font-bold"
                    >
                      {copiedBibtex ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedBibtex ? 'Copied BibTeX!' : 'Copy BibTeX'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-stone-900 text-stone-200 rounded-xl text-[11px] font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner selection:bg-indigo-500 selection:text-white">
                    {citation.raw || CitationEngine.formatBibTeX(citation)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 border-t border-stone-200 bg-white/80 flex items-center justify-between shrink-0">
          <span className="text-[10px] text-stone-400 font-mono">
            {savedFeedback ? 'Saved citation locally!' : 'Local-First Citation Cache Active'}
          </span>
          <div className="flex items-center gap-2">
            {citation && (
              <button
                type="button"
                onClick={handleSaveCitationToCache}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 rounded-xl text-xs font-semibold transition-colors shadow-xs"
              >
                <Bookmark className="w-3.5 h-3.5 text-stone-600" />
                <span>Save to Workspace</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleCopyBibtex}
              disabled={!citation}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
            >
              {copiedBibtex ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy BibTeX</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
