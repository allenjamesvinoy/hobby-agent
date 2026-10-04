import React, { useState, useEffect } from 'react';
import { BookOpen, X, Save, FileText, FileUp, Loader2 } from 'lucide-react';

const ROLE_LABELS = {
  architecture: 'Architecture',
  product: 'Product / Spec',
  contributing: 'Contributing',
  readme: 'README'
};

export default function ArchitectureModal({ 
  isOpen, 
  onClose, 
  architectureText, 
  repoDocs = [],
  onSave,
  onAddXp,
  onUploadArchitecture,
  isAnalyzingArchitecture = false
}) {
  const tabs = repoDocs.length > 0
    ? repoDocs.map((d) => ({
        id: d.role,
        label: ROLE_LABELS[d.role] || d.role,
        path: d.path,
        content: d.content || '',
        changedInPr: Boolean(d.changedInPr)
      }))
    : [{
        id: 'architecture',
        label: 'Architecture',
        path: 'ARCHITECTURE.md',
        content: architectureText || '',
        changedInPr: false
      }];

  const [activeTab, setActiveTab] = useState(tabs[0]?.id || 'architecture');
  const [drafts, setDrafts] = useState(() => Object.fromEntries(tabs.map((t) => [t.id, t.content])));

  useEffect(() => {
    if (!isOpen) return;
    const nextTabs = repoDocs.length > 0
      ? repoDocs.map((d) => ({
          id: d.role,
          label: ROLE_LABELS[d.role] || d.role,
          path: d.path,
          content: d.content || '',
          changedInPr: Boolean(d.changedInPr)
        }))
      : [{
          id: 'architecture',
          label: 'Architecture',
          path: 'ARCHITECTURE.md',
          content: architectureText || '',
          changedInPr: false
        }];
    setDrafts(Object.fromEntries(nextTabs.map((t) => [t.id, t.content])));
    setActiveTab((prev) => (nextTabs.some((t) => t.id === prev) ? prev : nextTabs[0].id));
  }, [isOpen, architectureText, repoDocs]);

  if (!isOpen) return null;

  const active = tabs.find((t) => t.id === activeTab) || tabs[0];

  const handleSave = () => {
    const nextDocs = repoDocs.length > 0
      ? repoDocs.map((d) => ({
          ...d,
          content: drafts[d.role] ?? d.content
        }))
      : undefined;

    const archDraft =
      drafts.architecture ??
      nextDocs?.find((d) => d.role === 'architecture')?.content ??
      architectureText;

    onSave(archDraft, nextDocs);
    if (onAddXp) {
      onAddXp(30, "Updated System Architecture Map", "architecture-map-saved");
    }
    onClose();
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-[#E6E0D5] rounded-xl max-w-3xl w-full shadow-2xl flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1ECE4]">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#C35832]" />
            <div>
              <h2 className="text-base font-bold text-[#242220]">Repository Docs (PR Head)</h2>
              <p className="text-[11px] text-[#6B635A]">
                Context from the currently viewed pull request branch
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onUploadArchitecture && (
              <label className="px-2.5 py-1 text-xs border border-dashed border-[#C35832]/60 hover:bg-[#FBEFEF] text-[#C35832] font-semibold rounded-lg cursor-pointer flex items-center gap-1.5 transition-colors">
                <input
                  type="file"
                  accept=".md,.markdown,text/markdown,text/plain"
                  className="hidden"
                  disabled={isAnalyzingArchitecture}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file || !onUploadArchitecture) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const content = ev.target?.result;
                      if (typeof content === 'string') {
                        onUploadArchitecture(content, file.name);
                      }
                    };
                    reader.readAsText(file);
                  }}
                />
                {isAnalyzingArchitecture ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <FileUp className="w-3.5 h-3.5" />
                    <span>Upload architecture.md</span>
                  </>
                )}
              </label>
            )}
            <button 
              onClick={onClose}
              className="text-[#6B635A] hover:text-[#242220] p-1 rounded-lg hover:bg-[#F9F6F0] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        {tabs.length > 1 && (
          <div className="px-5 pt-3 flex flex-wrap gap-1.5 border-b border-[#E6E0D5]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'border-[#C35832] text-[#C35832]'
                    : 'border-transparent text-[#6B635A] hover:text-[#242220]'
                }`}
              >
                {tab.label}
                {tab.changedInPr && (
                  <span className="ml-1.5 text-[9px] bg-[#FFFDF9] text-[#D08A29] border border-[#D08A29]/30 px-1 py-0.2 rounded font-bold">
                    edited in PR
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-[#6B635A] leading-relaxed">
              Review against{' '}
              <code className="bg-[#F1ECE4] px-1 py-0.5 rounded font-mono">{active?.path || 'ARCHITECTURE.md'}</code>
              {active?.changedInPr ? ' (modified in this PR).' : ' from PR head.'}
            </p>
            {repoDocs.length === 0 && (
              <span className="text-[10px] text-[#6B635A] bg-[#F1ECE4] px-2 py-0.5 rounded font-semibold">
                No repo docs found — editable fallback
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-[#6B635A] mb-1.5">
              Markdown Content
            </label>
            <textarea
              rows="14"
              value={drafts[activeTab] ?? ''}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [activeTab]: e.target.value }))}
              className="w-full bg-[#F9F6F0] border border-[#E6E0D5] rounded-lg p-3 font-mono text-xs focus:outline-none focus:border-[#C35832] leading-relaxed"
              placeholder="# System Architecture..."
            />
          </div>

          <div className="bg-[#FFFDF9] border border-[#D08A29]/20 rounded-lg p-3 flex items-start gap-2.5">
            <FileText className="w-4 h-4 text-[#D08A29] mt-0.5 flex-shrink-0" />
            <div className="text-[11px] text-[#6B635A] leading-relaxed">
              <span className="font-bold text-[#242220]">Context:</span> Acceptance criteria and architectural standards are seeded from these docs when a GitHub PR is loaded.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[#F1ECE4] flex justify-end gap-2 bg-[#F9F6F0]/50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-[#E6E0D5] text-xs font-medium rounded-lg hover:bg-[#F9F6F0] cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-[#C35832] hover:bg-[#A84725] text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4" /> Save Docs
          </button>
        </div>
      </div>
    </div>
  );
}