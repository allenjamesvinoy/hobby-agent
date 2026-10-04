import React, { useState } from 'react';
import { Check, AlertTriangle, MessageSquare, Star, ChevronDown, ChevronUp, Search, Info, ShieldAlert, Sparkles, X, Send, Trash2, Flag } from 'lucide-react';
import PeerCommentsSection from './PeerCommentsSection';

export default function HierarchicalDiffViewer({ 
  files = [], 
  selectedSpec, 
  activeFileId, 
  setActiveFileId, 
  onUpdateFileStatus, 
  onAddComment,
  onAddXp,
  level = 1,
  onInspectSymbol,
  onOpenInfo,
  currentUser,
  onRemoveFlag
}) {
  const [commentInputs, setCommentInputs] = useState({});
  const [expandedFiles, setExpandedFiles] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [flaggingFileId, setFlaggingFileId] = useState(null);
  const [flagText, setFlagText] = useState('');
  const [flagCategory, setFlagCategory] = useState('Security / Correctness');

  const detectSymbol = (content) => {
    if (content.includes("rotateSessionToken")) return "rotateSessionToken";
    if (content.includes("interceptors.response.use") || (content.includes("response.use") && content.includes("apiClient"))) return "apiClient.interceptors.response.use";
    if (content.includes("SessionProvider")) return "SessionProvider";
    if (content.includes("ProtectedRoute")) return "ProtectedRoute";
    return null;
  };

  const filteredFiles = (selectedSpec === 'ALL' 
    ? files 
    : files.filter(f => f.specTag === selectedSpec)
  ).filter(f => f.path.toLowerCase().includes(searchQuery.toLowerCase()));

  const sortedFiles = [...filteredFiles].sort((a, b) => b.importance - a.importance);

  const handleApprove = (file) => {
    const isApproved = file.reviewerStatuses?.[currentUser?.id]?.status === 'approved';
    const nextStatus = isApproved ? 'pending' : 'approved';
    onUpdateFileStatus(file.id, nextStatus);
    if (!isApproved) {
      onAddXp(40, `Reviewed & approved ${file.path}`, `review-file-${file.id}`);
    }
  };

  const handleRemoveFlag = (file) => {
    if (onRemoveFlag) {
      onRemoveFlag(file.id);
    } else {
      onUpdateFileStatus(file.id, 'pending');
    }
  };

  const handleInlineConfirmFlag = (file) => {
    const text = flagText.trim() || `Flagged under ${flagCategory}`;

    onAddComment(file.id, {
      authorId: currentUser?.id || 'alex',
      authorName: currentUser?.name || 'Reviewer',
      authorAvatar: currentUser?.avatar || '👨‍💻',
      type: 'flag',
      category: flagCategory,
      text: text,
      timestamp: 'Just now'
    });

    onUpdateFileStatus(file.id, 'flagged');
    onAddXp(40, `Flagged ${file.path}`, `flag-file-${file.id}`);
    setFlaggingFileId(null);
    setFlagText('');
  };

  const handleAddInlineComment = (fileId, lineNum) => {
    const text = commentInputs[`${fileId}-${lineNum}`];
    if (!text || !text.trim()) return;

    onAddComment(fileId, {
      id: Date.now(),
      line: lineNum,
      authorId: currentUser?.id || 'alex',
      authorName: currentUser?.name || 'Reviewer',
      authorAvatar: currentUser?.avatar || '👨‍💻',
      author: currentUser?.name || 'Reviewer (You)',
      type: 'note',
      text: text.trim(),
      timestamp: 'Just now',
      resolved: false
    });

    setCommentInputs({
      ...commentInputs,
      [`${fileId}-${lineNum}`]: ''
    });
    onAddXp(15, `Added inline comment on line ${lineNum + 1}`, `comment-${fileId}-${lineNum}`);
  };

  const toggleExpand = (fileId) => {
    setExpandedFiles(prev => ({
      ...prev,
      [fileId]: !prev[fileId]
    }));
  };

  return (
    <div className="space-y-4">
      {/* Header & Search Bar */}
      <div className="bg-white border border-[#E6E0D5] rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#6B635A] uppercase tracking-wider">
              📁 Diff Workspace ({sortedFiles.length} {sortedFiles.length === 1 ? 'file' : 'files'})
            </span>
            {selectedSpec !== 'ALL' && (
              <span className="text-[10px] font-bold bg-[#C35832]/10 text-[#C35832] px-2 py-0.5 rounded border border-[#C35832]/20 font-mono">
                Filtered: {selectedSpec}
              </span>
            )}
          </div>
          {onOpenInfo && (
            <button
              onClick={onOpenInfo}
              className="text-xs text-[#6B635A] hover:text-[#C35832] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              title="Learn what Tiers and Review Levels mean"
            >
              <Info className="w-3.5 h-3.5 text-[#C35832]" />
              <span className="hidden sm:inline">Tier Guide</span>
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#6B635A]" />
          <input
            type="text"
            placeholder="Search files by path..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#F9F6F0] border border-[#E6E0D5] rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-[#C35832]"
          />
        </div>
      </div>

      {sortedFiles.length === 0 ? (
        <div className="bg-white border border-[#E6E0D5] rounded-xl p-8 text-center">
          <p className="text-sm text-[#6B635A]">No files match the selected JIRA Spec Filter ({selectedSpec}) or search query.</p>
          <button 
            onClick={() => { setSearchQuery(''); onUpdateFileStatus(null, 'reset'); }}
            className="mt-3 text-xs text-[#C35832] font-bold hover:underline cursor-pointer"
          >
            Clear Filters & Search
          </button>
        </div>
      ) : (
        sortedFiles.map((file) => {
          const isActive = activeFileId === file.id;
          const isExpanded = expandedFiles[file.id] !== false;

          let tierBadgeColor = "bg-[#FBEFEF] text-[#C35832] border-[#C35832]/20";
          const tierStr = String(file.tier || '');
          if (tierStr.includes("2")) {
            tierBadgeColor = "bg-[#FFFDF9] text-[#D08A29] border-[#D08A29]/20";
          } else if (tierStr.includes("3")) {
            tierBadgeColor = "bg-[#F4F8F5] text-[#4F6D56] border-[#4F6D56]/20";
          }

          const reviewerEntries = Object.entries(file.reviewerStatuses || {});
          const approvedReviewers = reviewerEntries.filter(([_, s]) => s.status === 'approved').map(([_, s]) => s.userName);
          const flaggedReviewers = reviewerEntries.filter(([_, s]) => s.status === 'flagged').map(([_, s]) => s.userName);
          const currentUserStatus = file.reviewerStatuses?.[currentUser?.id]?.status || 'pending';

          return (
            <div 
              key={file.id}
              onClick={() => setActiveFileId(file.id)}
              className={`bg-white border rounded-xl overflow-hidden transition-all shadow-xs ${
                isActive ? 'ring-2 ring-[#C35832] border-transparent' : 'border-[#E6E0D5]'
              }`}
            >
              {/* File Header */}
              <div className="bg-[#FFFDF9] border-b border-[#E6E0D5] px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleExpand(file.id); }}
                    className="text-[#6B635A] hover:text-[#242220] cursor-pointer shrink-0"
                    title={isExpanded ? "Collapse diff" : "Expand diff"}
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <span className="text-sm font-bold font-mono text-[#242220] truncate" title={file.path}>
                    {file.path}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${tierBadgeColor}`}>
                    {file.tier}
                  </span>
                  {file.specTag && (
                    <span className="text-[10px] bg-[#F1ECE4] text-[#6B635A] px-1.5 py-0.5 rounded font-mono shrink-0">
                      Spec: {file.specTag}
                    </span>
                  )}
                </div>

                {/* Team Status Tally & User Review Actions (Single Row, No Wrap) */}
                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {/* Per code bit: Team Status Iconography */}
                  <div className="flex items-center gap-1">
                    <span 
                      className={`text-xs px-2 py-1 rounded-lg font-bold flex items-center gap-1 border transition-colors ${
                        approvedReviewers.length > 0 
                          ? 'bg-[#F4F8F5] text-[#4F6D56] border-[#4F6D56]/30' 
                          : 'bg-[#F9F6F0] text-[#8C827A] border-[#E6E0D5]'
                      }`}
                      title={approvedReviewers.length > 0 ? `Approved by: ${approvedReviewers.join(', ')}` : '0 approvals'}
                    >
                      <Check className="w-3.5 h-3.5 text-[#4F6D56]" />
                      <span>{approvedReviewers.length}</span>
                    </span>

                    <span 
                      className={`text-xs px-2 py-1 rounded-lg font-bold flex items-center gap-1 border transition-colors ${
                        flaggedReviewers.length > 0 
                          ? 'bg-[#FFF8F6] text-[#C35832] border-[#F7D8D0]' 
                          : 'bg-[#F9F6F0] text-[#8C827A] border-[#E6E0D5]'
                      }`}
                      title={flaggedReviewers.length > 0 ? `Flagged by: ${flaggedReviewers.join(', ')}` : '0 flags'}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-[#C35832]" />
                      <span>{flaggedReviewers.length}</span>
                    </span>
                  </div>

                  {/* Current User Action Buttons */}
                  <button
                    onClick={() => handleApprove(file)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      currentUserStatus === 'approved'
                        ? 'bg-[#4F6D56] text-white shadow-xs'
                        : 'bg-white hover:bg-[#F4F8F5] text-[#4F6D56] border border-[#4F6D56]/30'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{currentUserStatus === 'approved' ? '✓ Approved' : 'Approve'}</span>
                  </button>

                  {currentUserStatus === 'flagged' ? (
                    <button
                      onClick={() => handleRemoveFlag(file)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-[#C35832] hover:bg-[#A84725] text-white shadow-xs transition-colors cursor-pointer group"
                      title="Click to remove your flag on this file"
                    >
                      <span>🚩 You Flagged</span>
                      <span className="text-[10px] bg-black/20 group-hover:bg-black/35 px-1 py-0.2 rounded font-bold ml-0.5">
                        ✕
                      </span>
                    </button>
                  ) : (
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (flaggingFileId === file.id) {
                            setFlaggingFileId(null);
                          } else {
                            setFlaggingFileId(file.id);
                            setFlagText('');
                            setFlagCategory('Security / Correctness');
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-white hover:bg-[#FFF8F6] text-[#C35832] border border-[#C35832]/30 transition-colors cursor-pointer"
                        title="Flag issue for peers"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Flag</span>
                      </button>

                    {/* Small text window that opens up near the flag section */}
                    {flaggingFileId === file.id && (
                      <div 
                        className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-[#C35832]/40 rounded-xl p-3.5 shadow-2xl z-40 animate-in fade-in zoom-in-95 duration-150 text-left"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-[#F1ECE4]">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#C35832]">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Flag Reason</span>
                          </div>
                          <button
                            onClick={() => setFlaggingFileId(null)}
                            className="text-[#6B635A] hover:text-[#242220] p-1 rounded-md hover:bg-black/5 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <p className="text-[11px] text-[#6B635A] mt-2 leading-relaxed">
                          Select issue category and provide any optional context for peers:
                        </p>

                        {/* Category selection */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {['Security / Correctness', 'Architecture', 'Edge Case', 'Blast Radius'].map(cat => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setFlagCategory(cat)}
                              className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors cursor-pointer border ${
                                flagCategory === cat 
                                  ? 'bg-[#C35832] text-white border-[#C35832]' 
                                  : 'bg-[#F9F6F0] text-[#6B635A] border-[#E6E0D5] hover:bg-[#F1ECE4]'
                              }`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>

                        <textarea
                          rows={3}
                          autoFocus
                          value={flagText}
                          onChange={e => setFlagText(e.target.value)}
                          placeholder="Optional details: e.g. Need entropy verification, missing fallback check, etc."
                          className="w-full mt-2.5 p-2.5 bg-[#F9F6F0] border border-[#E6E0D5] rounded-lg text-xs text-[#242220] focus:outline-none focus:border-[#C35832] resize-none leading-relaxed"
                        />

                        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#F1ECE4]">
                          <button
                            type="button"
                            onClick={() => setFlaggingFileId(null)}
                            className="px-2.5 py-1 text-xs text-[#6B635A] hover:text-[#242220] cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInlineConfirmFlag(file)}
                            className="px-3 py-1.5 bg-[#C35832] hover:bg-[#A84725] text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <span>Confirm Flag</span>
                            <Send className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

              {/* Expanded Card Content */}
              {isExpanded && (
                <div className="p-4 space-y-4">
                  {/* Peer Comments & Discussions */}
                  <PeerCommentsSection 
                    file={file}
                    currentUser={currentUser}
                    onAddComment={onAddComment}
                    onRemoveFlag={(fileId, commentId) => onRemoveFlag && onRemoveFlag(fileId, commentId)}
                  />

                  {/* Diff Viewer */}
                  {Array.isArray(file.diffChunks) && file.diffChunks.length > 0 ? (
                    <div className="border border-[#E6E0D5] rounded-xl overflow-hidden font-mono text-xs shadow-inner">
                      {file.diffChunks.map((chunk, chunkIdx) => (
                        <div key={chunkIdx} className="border-b border-[#F1ECE4] last:border-0">
                          <div className="bg-[#F1ECE4]/60 text-[#6B635A] px-4 py-1 text-[11px] select-none font-semibold">
                            {chunk.header}
                          </div>
                          <div className="divide-y divide-[#F1ECE4]/30">
                            {chunk.lines.map((line, lineIdx) => {
                              let lineBg = "bg-white";
                              let linePrefix = " ";
                              let prefixColor = "text-[#6B635A]";

                              if (line.type === 'add') {
                                lineBg = "bg-[#EBF3EC] border-l-4 border-[#4F6D56]";
                                linePrefix = "+";
                                prefixColor = "text-[#4F6D56] font-bold";
                              } else if (line.type === 'delete') {
                                lineBg = "bg-[#FBEFEF] border-l-4 border-[#C35832]";
                                linePrefix = "-";
                                prefixColor = "text-[#C35832] font-bold";
                              }

                              const lineComments = (file.comments || []).filter(c => c.line === lineIdx);

                              return (
                                <div key={lineIdx} className="group">
                                  <div className={`flex items-start px-4 py-1 hover:bg-[#F9F6F0] transition-colors ${lineBg}`}>
                                    <span className="w-6 select-none text-right pr-2 text-[10px] text-[#6B635A]/60">
                                      {lineIdx + 1}
                                    </span>
                                    <span className={`w-4 select-none ${prefixColor} text-center mr-1`}>
                                      {linePrefix}
                                    </span>
                                    <pre className="flex-1 whitespace-pre-wrap break-all text-[#242220]">
                                      {line.content}
                                    </pre>
                                    
                                    {/* Function inspection only active in Level 3 (Blast Radius) */}
                                    {level === 3 && detectSymbol(line.content) && onInspectSymbol && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onInspectSymbol(detectSymbol(line.content));
                                        }}
                                        className="ml-2 px-1.5 py-0.5 rounded bg-[#FFFDF9] border border-[#C35832] text-[#C35832] text-[9px] font-bold font-mono hover:bg-[#C35832] hover:text-white transition-colors cursor-pointer flex items-center gap-1 shadow-2xs flex-shrink-0"
                                        title={`Inspect ${detectSymbol(line.content)} in Blast Radius Panel`}
                                      >
                                        🔍 {detectSymbol(line.content).split('.').pop()}()
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        setCommentInputs(prev => ({
                                          ...prev,
                                          [`${file.id}-${lineIdx}`]: prev[`${file.id}-${lineIdx}`] !== undefined ? undefined : ''
                                        }));
                                      }}
                                      className="opacity-0 group-hover:opacity-100 ml-2 text-[#6B635A] hover:text-[#C35832] transition-opacity cursor-pointer"
                                      title="Add line comment"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  {/* Line Comments List */}
                                  {lineComments.map((comment, cIdx) => (
                                    <div key={comment.id || cIdx} className="bg-[#FFFDF9] border-l-4 border-[#D08A29] ml-10 mr-4 my-1.5 p-2.5 rounded-r-md shadow-xs text-xs">
                                      <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-sm">{comment.authorAvatar || '👤'}</span>
                                          <span className="font-bold text-[#242220]">{comment.author || comment.authorName || 'Reviewer'}</span>
                                        </div>
                                        <span className="text-[10px] text-[#6B635A]">Line {lineIdx + 1}</span>
                                      </div>
                                      <p className="text-[#6B635A] leading-relaxed">{comment.text}</p>
                                    </div>
                                  ))}

                                  {/* Inline Comment Input */}
                                  {commentInputs[`${file.id}-${lineIdx}`] !== undefined && (
                                    <div className="bg-[#FFFDF9] border border-[#E6E0D5] ml-10 mr-4 my-2 p-2.5 rounded-lg shadow-inner">
                                      <textarea
                                        rows="2"
                                        placeholder="Write an inline review comment..."
                                        value={commentInputs[`${file.id}-${lineIdx}`]}
                                        onChange={(e) => setCommentInputs({
                                          ...commentInputs,
                                          [`${file.id}-${lineIdx}`]: e.target.value
                                        })}
                                        className="w-full bg-white border border-[#E6E0D5] rounded p-2 text-xs focus:outline-none focus:border-[#C35832]"
                                      />
                                      <div className="flex justify-end gap-1.5 mt-2">
                                        <button
                                          onClick={() => setCommentInputs(prev => {
                                            const copy = { ...prev };
                                            delete copy[`${file.id}-${lineIdx}`];
                                            return copy;
                                          })}
                                          className="px-2.5 py-1 bg-white border border-[#E6E0D5] text-[11px] font-medium rounded hover:bg-[#F9F6F0] cursor-pointer"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          onClick={() => handleAddInlineComment(file.id, lineIdx)}
                                          className="px-2.5 py-1 bg-[#C35832] text-white text-[11px] font-bold rounded hover:bg-[#A84725] cursor-pointer"
                                        >
                                          Post Comment
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))} 
                    </div>
                  ) : (
                    <div className="border border-[#E6E0D5] rounded-xl p-4 font-mono text-xs bg-white text-[#242220] whitespace-pre-wrap">
                      {file.diff || 'No diff content available for this file.'}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}