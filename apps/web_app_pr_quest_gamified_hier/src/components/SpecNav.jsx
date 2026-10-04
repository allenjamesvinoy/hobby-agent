import React, { useState } from 'react';
import { CheckSquare, Square, Plus, Link2, Loader2, GitPullRequest, ExternalLink } from 'lucide-react';

export default function SpecNav({ 
  jiraTicket, 
  setJiraTicket, 
  selectedSpec, 
  setSelectedSpec, 
  onAddXp,
  isLevelComplete = false,
  onProceedNextLevel,
  onLinkGithubIssue,
  isLinkingIssue = false
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAcText, setNewAcText] = useState('');
  const [customTicketTitle, setCustomTicketTitle] = useState('');
  const [customTicketDesc, setCustomTicketDesc] = useState('');
  const [showIssueInput, setShowIssueInput] = useState(false);
  const [issueInput, setIssueInput] = useState('');
  const [linkError, setLinkError] = useState('');

  const toggleAc = (id) => {
    const updatedCriteria = jiraTicket.criteria.map(ac => {
      if (ac.id === id) {
        const nextState = !ac.completed;
        if (nextState) {
          onAddXp(25, `Completed Spec Check: ${ac.id}`, `verify-ac-${ac.id}`);
        }
        return { ...ac, completed: nextState };
      }
      return ac;
    });
    setJiraTicket({ ...jiraTicket, criteria: updatedCriteria });
  };

  const handleAddAc = (e) => {
    e.preventDefault();
    if (!newAcText.trim()) return;
    const nextId = `AC-${jiraTicket.criteria.length + 1}`;
    const updatedCriteria = [
      ...jiraTicket.criteria,
      { id: nextId, text: newAcText.trim(), completed: false }
    ];
    setJiraTicket({ ...jiraTicket, criteria: updatedCriteria });
    setNewAcText('');
    onAddXp(10, `Added Custom Acceptance Criterion ${nextId}`, `add-custom-ac-${nextId}`);
  };

  const handleLinkSubmit = async (e) => {
    e.preventDefault();
    if (!issueInput.trim() || !onLinkGithubIssue) return;
    setLinkError('');
    const res = await onLinkGithubIssue(issueInput.trim());
    if (res?.success) {
      setShowIssueInput(false);
      setIssueInput('');
    } else {
      setLinkError(res?.error || 'Failed to link GitHub issue');
    }
  };

  const handleImportTicket = (e) => {
    e.preventDefault();
    if (!customTicketTitle.trim()) return;
    setJiraTicket({
      id: `PROJ-${Math.floor(100 + Math.random() * 900)}`,
      title: customTicketTitle,
      description: customTicketDesc || "Custom imported user story description.",
      criteria: [
        { id: "AC-1", text: "Verify core business logic changes", completed: false },
        { id: "AC-2", text: "Verify consumer integration and state updates", completed: false },
        { id: "AC-3", text: "Verify test coverage and edge cases", completed: false }
      ]
    });
    setCustomTicketTitle('');
    setCustomTicketDesc('');
    setShowAddModal(false);
    onAddXp(50, "Imported Custom JIRA Story");
  };

  const linkedIssue = jiraTicket?.linkedIssue;

  return (
    <div className="bg-white border border-[#E6E0D5] rounded-xl p-4 shadow-sm flex flex-col">
      {/* JIRA Ticket Header */}
      <div className="border-b border-[#F1ECE4] pb-3 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#C35832] bg-[#FBEFEF] px-2 py-0.5 rounded border border-[#C35832]/20 font-mono">
            {jiraTicket.id}
          </span>
          <div className="flex items-center gap-2">
            {onLinkGithubIssue && (
              <button 
                type="button"
                onClick={() => { setShowIssueInput(!showIssueInput); setLinkError(''); }}
                className="text-xs text-[#4F6D56] hover:text-[#3D5442] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                title="Pull Acceptance Criteria directly from a GitHub Issue"
              >
                <GitPullRequest className="w-3.5 h-3.5" />
                <span>{linkedIssue ? 'Change Issue' : 'Link Issue'}</span>
              </button>
            )}
            <button 
              onClick={() => setShowAddModal(true)}
              className="text-xs text-[#C35832] hover:text-[#A84725] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Import Story
            </button>
          </div>
        </div>

        {/* Linked GitHub Issue Badge */}
        {linkedIssue && !showIssueInput && (
          <div className="mt-2 flex items-center justify-between px-2.5 py-1.5 bg-[#F4F8F5] border border-[#4F6D56]/30 rounded-lg text-xs">
            <div className="flex items-center gap-1.5 overflow-hidden">
              <GitPullRequest className="w-3.5 h-3.5 text-[#4F6D56] shrink-0" />
              <span className="font-bold text-[#4F6D56]">Linked Issue #{linkedIssue.number}</span>
              <span className="text-[#6B635A] truncate">{linkedIssue.title}</span>
            </div>
            {linkedIssue.htmlUrl && (
              <a 
                href={linkedIssue.htmlUrl} 
                target="_blank" 
                rel="noreferrer"
                className="text-[#4F6D56] hover:text-[#3D5442] ml-1 shrink-0"
                title="View issue on GitHub"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {/* Link Issue Input Form */}
        {showIssueInput && (
          <form onSubmit={handleLinkSubmit} className="mt-2.5 space-y-1">
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="Issue # (e.g. 42 or URL)..."
                value={issueInput}
                onChange={(e) => setIssueInput(e.target.value)}
                disabled={isLinkingIssue}
                className="flex-1 bg-[#F9F6F0] border border-[#E6E0D5] rounded px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-[#C35832]"
              />
              <button
                type="submit"
                disabled={isLinkingIssue || !issueInput.trim()}
                className="bg-[#C35832] hover:bg-[#A84725] text-white px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
              >
                {isLinkingIssue ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Fetch ACs'}
              </button>
              <button
                type="button"
                onClick={() => { setShowIssueInput(false); setLinkError(''); }}
                className="px-2 py-1 text-xs border border-[#E6E0D5] rounded text-[#6B635A] hover:bg-[#F9F6F0]"
              >
                ✕
              </button>
            </div>
            {linkError && (
              <p className="text-[11px] text-[#C35832] font-medium">{linkError}</p>
            )}
          </form>
        )}

        <h2 className="text-sm font-bold text-[#242220] mt-2 leading-snug">
          {jiraTicket.title}
        </h2>
        <p className="text-xs text-[#6B635A] mt-1 line-clamp-2">
          {jiraTicket.description}
        </p>
      </div>

      {/* Spec Filter Pills */}
      <div className="mb-3.5">
        <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B635A] mb-1.5">
          🎯 Sliced Diff Filter
        </label>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedSpec('ALL')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              selectedSpec === 'ALL'
                ? 'bg-[#C35832] text-white shadow-2xs'
                : 'bg-[#F9F6F0] text-[#6B635A] hover:bg-[#E6E0D5]'
            }`}
          >
            All Diffs
          </button>
          {jiraTicket.criteria.map((ac) => (
            <button
              key={ac.id}
              onClick={() => setSelectedSpec(ac.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                selectedSpec === ac.id
                  ? 'bg-[#C35832] text-white shadow-2xs'
                  : 'bg-[#F9F6F0] text-[#6B635A] hover:bg-[#E6E0D5]'
            }`}
            >
              {ac.id}
            </button>
          ))}
        </div>
      </div>

      {/* Acceptance Criteria Checklist - Dedicated Independent Scroll */}
      <div className="flex-1 flex flex-col min-h-0 border-t border-[#F1ECE4] pt-3">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B635A] flex items-center gap-1">
            <span>✅</span> Acceptance Criteria
          </label>
          <span className="text-[10px] text-[#4F6D56] font-bold bg-[#F4F8F5] px-2 py-0.5 rounded border border-[#4F6D56]/20">
            {jiraTicket.criteria.filter(c => c.completed).length}/{jiraTicket.criteria.length} Verified
          </span>
        </div>

        {/* Dedicated AC Scrollable Container */}
        <div className="space-y-2 overflow-y-auto max-h-[440px] lg:max-h-[500px] pr-1">
          {jiraTicket.criteria.map((ac) => (
            <div 
              key={ac.id}
              className={`p-2.5 rounded-lg border transition-all flex items-start gap-2.5 ${
                ac.completed 
                  ? 'bg-[#F4F8F5] border-[#4F6D56]/30 text-[#4F6D56]' 
                  : 'bg-[#FFFDF9] border-[#E6E0D5] text-[#242220] hover:border-[#C35832]/30'
              }`}
            >
              <button 
                onClick={() => toggleAc(ac.id)}
                className="mt-0.5 text-[#C35832] hover:scale-110 transition-transform flex-shrink-0 cursor-pointer"
                title={ac.completed ? "Mark incomplete" : "Mark AC completed"}
              >
                {ac.completed ? (
                  <CheckSquare className="w-4 h-4 text-[#4F6D56]" />
                ) : ( 
                  <Square className="w-4 h-4 text-[#6B635A]" />
                )}
              </button>
              <div className="text-xs leading-relaxed">
                <span className="font-bold mr-1">{ac.id}:</span>
                <span className={ac.completed ? 'line-through opacity-75' : ''}>
                  {ac.title || ac.text || ac.description}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Add AC */}
        <form onSubmit={handleAddAc} className="mt-2.5 pt-2.5 border-t border-[#F1ECE4] flex gap-1.5">
          <input
            type="text"
            placeholder="Add custom AC..."
            value={newAcText}
            onChange={(e) => setNewAcText(e.target.value)}
            className="flex-1 bg-[#F9F6F0] border border-[#E6E0D5] rounded px-2 py-1 text-xs focus:outline-none focus:border-[#C35832]"
          />
          <button 
            type="submit"
            className="bg-[#4F6D56] hover:bg-[#3D5442] text-white px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer"
          >
            Add
          </button>
        </form>
      </div>

      {/* Import Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#E6E0D5] rounded-xl p-5 max-w-md w-full shadow-xl">
            <h3 className="text-base font-bold text-[#242220] mb-3">Import JIRA Story</h3>
            <form onSubmit={handleImportTicket} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#6B635A] mb-1">Story Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., PROJ-501: Implement OAuth2 Login"
                  value={customTicketTitle}
                  onChange={(e) => setCustomTicketTitle(e.target.value)}
                  className="w-full bg-[#F9F6F0] border border-[#E6E0D5] rounded p-2 text-xs focus:outline-none focus:border-[#C35832]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#6B635A] mb-1">Description</label>
                <textarea
                  rows="3"
                  placeholder="Describe the feature and requirements..."
                  value={customTicketDesc}
                  onChange={(e) => setCustomTicketDesc(e.target.value)}
                  className="w-full bg-[#F9F6F0] border border-[#E6E0D5] rounded p-2 text-xs focus:outline-none focus:border-[#C35832]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 bg-white border border-[#E6E0D5] text-xs font-medium rounded hover:bg-[#F9F6F0]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#C35832] text-white text-xs font-bold rounded hover:bg-[#A84725]"
                >
                  Import & Reset ACs
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}