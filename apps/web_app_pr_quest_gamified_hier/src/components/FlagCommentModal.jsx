import React, { useState } from 'react';
import { AlertTriangle, MessageSquare, X, ShieldAlert } from 'lucide-react';

export default function FlagCommentModal({
  isOpen,
  onClose,
  onConfirmFlag,
  file,
  currentUser
}) {
  const [commentText, setCommentText] = useState('');
  const [tag, setTag] = useState('Security / Correctness');

  if (!isOpen || !file) return null;

  const quickTags = [
    'Security / Correctness',
    'Architectural Violation',
    'Edge Case / Panic Risk',
    'Downstream Blast Radius',
    'Performance Regression'
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    onConfirmFlag({
      text: commentText.trim(),
      tag,
      type: 'flag'
    });
    setCommentText('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-[#E6E0D5] max-w-lg w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#FFF8F6] border-b border-[#F7D8D0] p-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#C35832]/10 text-[#C35832] rounded-xl border border-[#C35832]/20">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#242220]">Flag File for Team Review</h3>
              <p className="text-xs text-[#6B635A] mt-0.5 truncate max-w-sm">
                Target: <span className="font-mono font-medium text-[#C35832]">{file.path}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-[#6B635A] hover:text-[#242220] p-1.5 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-[#F9F6F0] border border-[#E6E0D5] rounded-xl p-3.5 flex items-center gap-3 text-xs text-[#242220]">
            <span className="text-2xl">{currentUser?.avatar || '👨‍💻'}</span>
            <div>
              <div className="font-semibold text-xs text-[#242220]">
                Reviewing as: <span className="text-[#C35832] font-bold">{currentUser?.name || 'Reviewer'}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#6B635A] mb-1.5">
              Issue Category
            </label>
            <div className="flex flex-wrap gap-1.5">
              {quickTags.map(t => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setTag(t)}
                  className={`text-[11px] px-2.5 py-1 rounded-md border font-medium transition-colors cursor-pointer ${
                    tag === t
                      ? 'bg-[#C35832] text-white border-[#C35832]'
                      : 'bg-[#F9F6F0] text-[#6B635A] border-[#E6E0D5] hover:bg-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#6B635A]">
                Reason for Flagging <span className="text-[#C35832]">* (Mandatory)</span>
              </label>
              <span className="text-[11px] text-[#6B635A]">Visible to peer reviewers</span>
            </div>
            <textarea
              rows={4}
              required
              autoFocus
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Explain clearly what logic is flawed, why it fails review, or what changes are requested before this file can be approved..."
              className="w-full text-xs font-mono p-3 bg-white border border-[#E6E0D5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C35832]/30 focus:border-[#C35832] resize-none"
            />
          </div>

          <div className="bg-[#FFFDF9] border border-[#F1ECE4] rounded-lg p-2.5 text-[11px] text-[#6B635A] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#D08A29] shrink-0" />
            <span>Peers reviewing this query will see your flag, author badge, and timestamp immediately.</span>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#6B635A] hover:bg-[#F9F6F0] rounded-xl transition-colors cursor-pointer border border-transparent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!commentText.trim()}
              className="px-5 py-2 text-xs font-bold bg-[#C35832] hover:bg-[#A84725] disabled:opacity-50 text-white rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Confirm Flag & Post Comment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
