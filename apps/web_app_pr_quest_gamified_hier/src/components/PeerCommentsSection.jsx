import React, { useState } from 'react';
import { MessageSquare, AlertTriangle, CheckCircle, Send, CornerDownRight, ShieldAlert, User } from 'lucide-react';

export default function PeerCommentsSection({
  file,
  currentUser,
  onAddComment,
  onResolveFlag
}) {
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  const comments = file.comments || [];
  const flags = comments.filter(c => c.type === 'flag');
  const otherComments = comments.filter(c => c.type !== 'flag');

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
    <div className="space-y-3 mb-4">
      {/* Active Peer Flags Alert Banner */}
      {flags.length > 0 && (
        <div className="space-y-2">
          {flags.map((flag, idx) => (
            <div 
              key={flag.id || idx}
              className="bg-[#FFF8F6] border-l-4 border-[#C35832] border border-[#F7D8D0] rounded-xl p-4 shadow-2xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5">{flag.authorAvatar || '👨‍💻'}</span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[#C35832] flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        FLAGGED BY {flag.authorName?.toUpperCase() || 'PEER REVIEWER'}
                      </span>
                      <span className="text-[11px] text-[#6B635A]">
                        {flag.timestamp || 'Recently'}
                      </span>
                    </div>
                    <p className="text-xs text-[#242220] mt-2 font-mono whitespace-pre-wrap bg-white/70 border border-[#F7D8D0] p-2.5 rounded-lg leading-relaxed">
                      {flag.text}
                    </p>
                  </div>
                </div>

                {onResolveFlag && (
                  <button
                    onClick={() => onResolveFlag(file.id, flag.id)}
                    className="text-[11px] font-semibold text-[#4F6D56] bg-white border border-[#4F6D56]/30 hover:bg-[#F4F8F5] px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0"
                    title="Mark flag as addressed"
                  >
                    Mark Resolved
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Discussion Thread & Notes */}
      <div className="bg-white border border-[#E6E0D5] rounded-xl p-4">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#F1ECE4]">
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

        {/* Existing Comments */}
        {comments.length === 0 ? (
          <div className="text-center py-4 text-xs text-[#6B635A] italic">
            No peer comments on this file yet. Be the first to add notes or flag issues.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {comments.map((c, i) => (
              <div 
                key={c.id || i}
                className={`p-3 rounded-lg border text-xs ${
                  c.type === 'flag' 
                    ? 'bg-[#FFF8F6] border-[#F7D8D0]' 
                    : c.type === 'approval'
                      ? 'bg-[#F4F8F5] border-[#4F6D56]/20'
                      : 'bg-[#F9F6F0] border-[#E6E0D5]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{c.authorAvatar || '👤'}</span>
                    <span className="font-bold text-[#242220]">{c.authorName || 'Reviewer'}</span>
                    {c.type === 'flag' && (
                      <span className="text-[10px] bg-[#C35832] text-white px-1.5 py-0.2 rounded font-bold">
                        FLAG
                      </span>
                    )}
                    {c.type === 'approval' && (
                      <span className="text-[10px] bg-[#4F6D56] text-white px-1.5 py-0.2 rounded font-bold">
                        APPROVED
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#6B635A]">{c.timestamp || 'Just now'}</span>
                </div>
                <div className="text-[#242220] pl-6 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                  {c.text}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reply Box */}
        {isReplying && (
          <form onSubmit={handlePostReply} className="mt-3 pt-3 border-t border-[#F1ECE4] space-y-2">
            <div className="text-[11px] text-[#6B635A] flex items-center gap-1.5 font-medium">
              <CornerDownRight className="w-3.5 h-3.5 text-[#C35832]" />
              <span>Replying as <strong className="text-[#242220]">{currentUser?.name}</strong>:</span>
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
    </div>
  );
}
