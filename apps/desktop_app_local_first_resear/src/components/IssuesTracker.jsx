import React, { useState } from 'react';
import {
  MessageSquarePlus,
  Plus,
  Image as ImageIcon,
  Sparkles,
  Loader2,
  Send,
  X,
  Bug,
  Trash2,
  CornerDownRight
} from 'lucide-react';

async function processGeminiMultimodal({ prompt, imageBase64, apiKey }) {
  if (!apiKey) {
    return {
      success: false,
      text: 'Gemini API Key missing. Please set your Google Gemini API key in Settings to enable multimodal AI analysis for uploaded issue images.'
    };
  }

  try {
    const parts = [{ text: prompt }];
    if (imageBase64) {
      const matches = imageBase64.match(/^data:(image\/[a-zA-Z0-9\+\-\.]+);base64,(.+)$/);
      if (matches) {
        parts.push({
          inlineData: {
            mimeType: matches[1],
            data: matches[2]
          }
        });
      }
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] })
      }
    );

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `API error ${res.status}`);
    }

    const data = await res.json();
    const replyText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      'No response text received from Gemini AI.';
    return { success: true, text: replyText };
  } catch (err) {
    return {
      success: false,
      text: `Gemini Analysis Error: ${err.message}`
    };
  }
}

export default function IssuesTracker({
  issues = [],
  onSaveIssue,
  onUpdateIssue,
  settings = {},
  onOpenSettings
}) {
  const [selectedIssueId, setSelectedIssueId] = useState(null);
  const [filterType, setFilterType] = useState('All');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // New Issue Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Bug Report');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [processWithAI, setProcessWithAI] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Comment Form State
  const [commentText, setCommentText] = useState('');
  const [commentImage, setCommentImage] = useState(null);
  const [commentAI, setCommentAI] = useState(true);
  const [isAddingComment, setIsAddingComment] = useState(false);

  const selectedIssue = issues.find((i) => i.id === selectedIssueId);

  const handleImageUpload = (e, setImageState) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file (PNG, JPEG, WebP).');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => setImageState(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleCreateIssue = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setIsSubmitting(true);
    const newIssueId = 'issue_' + Date.now();
    const initialComments = [];

    if (processWithAI) {
      const promptText = `Analyze this ${category} issue request for Paper Companion desktop app:
Title: ${title}
Description: ${description}
Provide key diagnostic steps, potential fix recommendations, or relevant feature implementation ideas.`;
      const result = await processGeminiMultimodal({
        prompt: promptText,
        imageBase64: imageFile,
        apiKey: settings.geminiApiKey
      });
      initialComments.push({
        id: 'comm_' + Date.now(),
        author: 'Gemini AI Assistant',
        text: result.text,
        isAi: true,
        createdAt: new Date().toISOString()
      });
    }

    const newIssue = {
      id: newIssueId,
      title: title.trim(),
      category,
      status: 'Open',
      description: description.trim(),
      imageUrl: imageFile,
      createdAt: new Date().toISOString(),
      comments: initialComments
    };

    onSaveIssue(newIssue);
    setIsSubmitting(false);
    setIsNewModalOpen(false);
    setTitle('');
    setDescription('');
    setImageFile(null);
    setSelectedIssueId(newIssueId);
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() && !commentImage) return;
    if (!selectedIssue) return;

    setIsAddingComment(true);
    const newComment = {
      id: 'comm_' + Date.now(),
      author: 'User',
      text: commentText.trim(),
      imageUrl: commentImage,
      isAi: false,
      createdAt: new Date().toISOString()
    };

    const updatedComments = [...(selectedIssue.comments || []), newComment];
    let finalComments = updatedComments;

    if (commentAI) {
      const promptText = `Comment on issue #${selectedIssue.id} (${selectedIssue.title}).
Previous context: ${selectedIssue.description}
User comment: ${commentText}
Evaluate the uploaded context/image and provide helpful technical guidance or feedback.`;
      const result = await processGeminiMultimodal({
        prompt: promptText,
        imageBase64: commentImage,
        apiKey: settings.geminiApiKey
      });
      finalComments = [
        ...updatedComments,
        {
          id: 'comm_ai_' + Date.now(),
          author: 'Gemini AI Assistant',
          text: result.text,
          isAi: true,
          createdAt: new Date().toISOString()
        }
      ];
    }

    onUpdateIssue(selectedIssue.id, { comments: finalComments });
    setIsAddingComment(false);
    setCommentText('');
    setCommentImage(null);
  };

  const filteredIssues = issues.filter((i) => {
    if (filterType === 'All') return true;
    if (filterType === 'Open' || filterType === 'Closed') return i.status === filterType;
    return i.category === filterType;
  });

  return (
    <div className="flex-1 flex bg-[#fbfbfa] overflow-hidden select-none">
      {/* Left List of Issues */}
      <div className="w-80 md:w-96 border-r border-stone-200 flex flex-col bg-[#f7f6f3]/60 shrink-0">
        <div className="p-5 border-b border-stone-200 bg-white/80 backdrop-blur-sm space-y-3 drag-region pt-9">
          <div className="flex items-center justify-between no-drag">
            <h1 className="font-bold text-stone-900 text-sm flex items-center gap-2">
              <MessageSquarePlus className="w-4 h-4 text-sky-600" /> Issue Requests
            </h1>
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> New Request
            </button>
          </div>

          <div className="flex gap-1 overflow-x-auto no-drag text-[11px] font-mono">
            {['All', 'Open', 'Closed', 'Bug Report', 'Feature Request'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                  filterType === type
                    ? 'bg-stone-900 text-white font-semibold'
                    : 'bg-stone-200/60 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {filteredIssues.length === 0 ? (
            <div className="py-16 text-center text-stone-400 text-xs space-y-2 font-mono">
              <Bug className="w-8 h-8 mx-auto text-stone-300 stroke-[1.5]" />
              <p>No issue requests found.</p>
            </div>
          ) : (
            filteredIssues.map((issue) => {
              const isSelected = issue.id === selectedIssueId;
              return (
                <div
                  key={issue.id}
                  onClick={() => setSelectedIssueId(issue.id)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all space-y-2 ${
                    isSelected
                      ? 'bg-white border-stone-400 shadow-md ring-1 ring-stone-300'
                      : 'bg-white/80 hover:bg-white border-stone-200/90 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                    <span
                      className={`px-2 py-0.5 rounded-full font-semibold ${
                        issue.category === 'Bug Report'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-sky-50 text-sky-700 border border-sky-200'
                      }`}
                    >
                      {issue.category}
                    </span>
                    <span className="text-stone-400">
                      {new Date(issue.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-stone-800 leading-snug line-clamp-2">
                    {issue.title}
                  </h3>
                  <div className="flex items-center justify-between text-[11px] text-stone-500 font-mono pt-1 border-t border-stone-100">
                    <span className="flex items-center gap-1 text-stone-400">
                      {issue.imageUrl && <ImageIcon className="w-3 h-3 text-indigo-500" />}
                      {issue.comments?.length || 0} comment{(issue.comments?.length || 0) !== 1 ? 's' : ''}
                    </span>
                    <span className={issue.status === 'Open' ? 'text-emerald-600 font-semibold' : 'text-stone-400'}>
                      ● {issue.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Detail & Conversation View */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#fbfbfa]">
        {selectedIssue ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-6 border-b border-stone-200 bg-white flex items-center justify-between drag-region pt-9 shrink-0">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {selectedIssue.status}
                  </span>
                  <span className="text-xs text-stone-400 font-mono">
                    #{selectedIssue.id}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-stone-900 leading-tight">
                  {selectedIssue.title}
                </h2>
              </div>
              <button
                onClick={() =>
                  onUpdateIssue(selectedIssue.id, {
                    status: selectedIssue.status === 'Open' ? 'Closed' : 'Open'
                  })
                }
                className="no-drag text-xs px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 font-medium transition-colors"
              >
                Toggle Status ({selectedIssue.status === 'Open' ? 'Close Issue' : 'Re-open'})
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Original Issue Card */}
              <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between text-xs text-stone-500 font-mono">
                  <span className="font-bold text-stone-800">Reported Issue</span>
                  <span>{new Date(selectedIssue.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-xs text-stone-800 leading-relaxed font-sans whitespace-pre-wrap">
                  {selectedIssue.description}
                </p>
                {selectedIssue.imageUrl && (
                  <div className="space-y-1.5 pt-2 border-t border-stone-100">
                    <span className="text-[10px] font-mono text-stone-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5 text-indigo-600" /> Attached Screenshot
                    </span>
                    <img
                      src={selectedIssue.imageUrl}
                      alt="Issue Screenshot"
                      className="max-h-80 rounded-xl border border-stone-200 object-contain bg-stone-900/5 shadow-xs"
                    />
                  </div>
                )}
              </div>

              {/* Comment Timeline */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <CornerDownRight className="w-3.5 h-3.5" /> Discussion & Gemini AI Analysis
                </h3>

                {selectedIssue.comments?.map((comm) => (
                  <div
                    key={comm.id}
                    className={`p-4 rounded-2xl border text-xs space-y-2.5 shadow-xs ${
                      comm.isAi
                        ? 'bg-gradient-to-br from-indigo-50/70 to-purple-50/40 border-indigo-200/90 text-indigo-950'
                        : 'bg-white border-stone-200 text-stone-800'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono text-[11px] text-stone-500">
                      <span className="font-bold flex items-center gap-1.5 text-stone-800">
                        {comm.isAi ? (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Gemini AI Model
                          </>
                        ) : (
                          comm.author || 'User'
                        )}
                      </span>
                      <span>{new Date(comm.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap font-sans">{comm.text}</p>
                    {comm.imageUrl && (
                      <div className="pt-2 border-t border-stone-100">
                        <img
                          src={comm.imageUrl}
                          alt="Comment attachment"
                          className="max-h-64 rounded-lg border border-stone-200 object-contain bg-stone-900/5 shadow-xs"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Add Comment Form */}
            <form
              onSubmit={handleAddComment}
              className="p-4 border-t border-stone-200 bg-white space-y-3 shrink-0"
            >
              <textarea
                rows={2}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment or follow-up question..."
                className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-400 resize-none font-sans shadow-xs"
              />
              <div className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-stone-600 hover:text-stone-900 font-medium text-[11px] font-mono px-2.5 py-1.5 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 transition-colors">
                    <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{commentImage ? 'Image Attached' : 'Attach Screenshot'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, setCommentImage)}
                      className="hidden"
                    />
                  </label>
                  {commentImage && (
                    <button
                      type="button"
                      onClick={() => setCommentImage(null)}
                      className="text-stone-400 hover:text-rose-600 text-[10px] font-mono underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Remove image
                    </button>
                  )}
                  <label className="flex items-center gap-1.5 text-[11px] font-mono text-stone-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commentAI}
                      onChange={(e) => setCommentAI(e.target.checked)}
                      className="rounded accent-stone-900"
                    />
                    <span>Process with Gemini AI</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isAddingComment || (!commentText.trim() && !commentImage)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white font-semibold rounded-xl text-xs transition-colors shadow-xs"
                >
                  {isAddingComment ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Send Comment</span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-stone-400 space-y-3 p-8 text-center font-mono text-xs">
            <MessageSquarePlus className="w-12 h-12 text-stone-300 stroke-[1.5]" />
            <p className="font-sans text-stone-600 font-medium">Select an issue or submit a new issue request</p>
            <p className="text-[11px] text-stone-400 max-w-sm font-sans">
              Upload screenshots of bugs or request new features. Attach images to get automated analysis powered by Gemini AI models.
            </p>
          </div>
        )}
      </div>

      {/* New Issue Request Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 select-text">
          <div className="bg-white border border-stone-200 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 px-6 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
              <div className="flex items-center gap-2">
                <MessageSquarePlus className="w-4 h-4 text-sky-600" />
                <h3 className="font-bold text-stone-800 text-sm">New Issue Request</h3>
              </div>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateIssue} className="p-6 space-y-4 text-xs font-sans">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Issue Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., PDF Reader Text Selection Bug on Dual-Page Render"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-800 focus:outline-none focus:border-stone-400 shadow-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-800 focus:outline-none focus:border-stone-400 shadow-xs"
                >
                  <option value="Bug Report">Bug Report</option>
                  <option value="Feature Request">Feature Request</option>
                  <option value="General Question">General Question</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Description *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe the bug or feature request in detail..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-stone-800 focus:outline-none focus:border-stone-400 resize-none shadow-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Upload Screenshot / Context Image</label>
                <div className="border-2 border-dashed border-stone-200 rounded-xl p-3 text-center bg-stone-50/50 hover:border-stone-400 transition-colors relative cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, setImageFile)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  {imageFile ? (
                    <div className="space-y-2 relative z-20 pointer-events-none">
                      <img src={imageFile} alt="Upload Preview" className="max-h-36 mx-auto rounded-lg border border-stone-200" />
                      <p className="text-[11px] text-emerald-600 font-mono">Image attached! Click to change.</p>
                    </div>
                  ) : (
                    <div className="py-2 space-y-1 text-stone-500 font-mono text-xs pointer-events-none">
                      <ImageIcon className="w-5 h-5 text-stone-400 mx-auto" />
                      <p>Click to select or upload a screenshot image</p>
                    </div>
                  )}
                </div>
                {imageFile && (
                  <div className="flex justify-end mt-1.5">
                    <button
                      type="button"
                      onClick={() => setImageFile(null)}
                      className="text-stone-400 hover:text-rose-600 text-[10px] font-mono underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Clear image
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-stone-100 font-mono text-[11px] text-stone-600">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={processWithAI}
                    onChange={(e) => setProcessWithAI(e.target.checked)}
                    className="rounded accent-stone-900"
                  />
                  <span className="flex items-center gap-1 font-sans text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Process request with Gemini AI
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs transition-colors shadow-xs flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
