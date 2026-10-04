import React, { useState } from 'react';
import { MessageSquare, AlertTriangle, CheckCircle, Send, CornerDownRight, ShieldAlert, User, Trash2 } from 'lucide-react';

export default function PeerCommentsSection({
  file,
  currentUser,
  onAddComment,
  onResolveFlag,
  onRemoveFlag
}) {
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  const comments = file.comments || [];

  const handlePostReply = (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    onAddComment(file.id, {
      text: replyText.trim(),
      type: 'note'
    });
    setReplyText('');
    setIsReplying(false);
  };

  return (
    <div className="bg-white border border-[#E6E0D5] rounded-xl p-3.5 mb-4 shadow-2xs">
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#F1ECE4]">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#242220]">
          <MessageSquare className="w-4 h-4 text-[#C35832]" />
          <span>Team Review Discussion ({comments.length})</span>
        </div>
        <button
          onClick={() => setIsReplying(!isReplying)}
          className="text-xs font-semibold text-[#C35832] hover:text-[#A84725] transition-colors cursor-pointer flex items-center gap-1"
        >
          {isReplying ? 'Close Reply' : '+ Add Review Note'}
        </button>
      </div>

      {/* Unified Comments Feed */}
      {comments.length === 0 ? (
        <div className="text-center py-3 text-xs text-[#8C827A] italic">
          No peer comments or flags on this file yet. Be the first to add notes or flag issues.
        </div>
      ) : (
        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
          {comments.map((c, i) => {
            const isAuthor = (c.authorId === currentUser?.id || c.authorName === currentUser?.name);
            const isFlag = c.type === 'flag';

            return (
              <div 
                key={c.id || i}
                className={`p-3 rounded-xl border text-xs transition-all ${
                  isFlag 
                    ? 'bg-[#FFF8F6] border-[#F7D8D0] shadow-2xs' 
                    : c.type === 'approval'
                      ? 'bg-[#F4F8F5] border-[#4F6D56]/20'
                      : 'bg-[#F9F6F0] border-[#E6E0D5]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base leading-none">{c.authorAvatar || '👤'}</span>
                    <span className="font-bold text-[#242220]">{c.authorName || 'Reviewer'}</span>
                    {isFlag ? (
                      <span className="text-[10px] bg-[#C35832] text-white px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-2xs">
                        <ShieldAlert className="w-3 h-3" />
                        <span>🚩 Flagged Issue</span>
                      </span>
                    ) : c.type === 'approval' ? (
                      <span className="text-[10px] bg-[#4F6D56] text-white px-1.5 py-0.2 rounded font-bold">
                        APPROVED
                      </span>
                    ) : (
                      <span className="text-[10px] bg-[#E6E0D5] text-[#6B635A] px-1.5 py-0.2 rounded font-semibold">
                        NOTE
                      </span>
                    )}
                    <span className="text-[10px] text-[#8C827A]">{c.timestamp || 'Just now'}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isAuthor && onRemoveFlag && (
                      <button
                        onClick={() => onRemoveFlag(file.id, c.id)}
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors cursor-pointer border ${
                          isFlag
                            ? 'text-[#C35832] bg-white border-[#C35832]/30 hover:bg-[#FFF8F6]'
                            : 'text-[#6B635A] bg-white border-[#E6E0D5] hover:text-[#C35832]'
                        }`}
                        title={isFlag ? "Remove this flag" : "Delete note"}
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>{isFlag ? 'Delete Flag' : 'Delete'}</span>
                      </button>
                    )}
                    {isFlag && onResolveFlag && (
                      <button
                        onClick={() => onResolveFlag(file.id, c.id)}
                        className="text-[11px] font-semibold text-[#4F6D56] bg-white border border-[#4F6D56]/30 hover:bg-[#F4F8F5] px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                        title="Mark flag as addressed"
                      >
                        Mark Resolved
                      </button>
                    )}
                  </div>
                </div>

                <div className={`mt-1 font-mono text-xs leading-relaxed whitespace-pre-wrap ${
                  isFlag ? 'text-[#242220] bg-white/70 p-2.5 rounded-lg border border-[#F7D8D0]' : 'text-[#242220] pl-6'
                }`}>
                  {c.text}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reply Box */}
      {isReplying && (
        <form onSubmit={handlePostReply} className="mt-3 pt-3 border-t border-[#F1ECE4] space-y-2">
          <div className="text-[11px] text-[#6B635A] flex items-center gap-1.5 font-medium">
            <CornerDownRight className="w-3.5 h-3.5 text-[#C35832]" />
            <span>Posting note as <strong className="text-[#242220]">{currentUser?.name}</strong>:</span>
          </div>
          <textarea
            rows={2}
            required
            autoFocus
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder="Add your technical perspective, answer peer questions, or discuss trade-offs..."
            className="w-full text-xs font-mono p-2.5 bg-[#F9F6F0] border border-[#E6E0D5] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#C35832] resize-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsReplying(false)}
              className="px-3 py-1.5 text-xs text-[#6B635A] hover:bg-[#F9F6F0] rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!replyText.trim()}
              className="px-4 py-1.5 text-xs font-bold bg-[#C35832] hover:bg-[#A84725] text-white rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3 h-3" />
              <span>Post Reply</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
