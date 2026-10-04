import React, { useState, useEffect } from 'react';
import {
  GitPullRequest,
  Plus,
  Search,
  Check,
  X,
  ShieldAlert,
  Award,
  Link2,
  Loader2,
  ExternalLink,
  Github
} from 'lucide-react';

export default function QuerySelectorModal({
  isOpen,
  onClose,
  currentQueryId,
  queries = [],
  onSelectQuery,
  onCreateQuery,
  githubRepoUrl = '',
  githubPullRequests = [],
  githubLoading = false,
  githubError = '',
  onLoadRepo,
  onSelectGitHubPr,
  githubLinked = false,
  githubLogin = null,
  myRepos = [],
  myReposLoading = false,
  onRefreshMyRepos,
  onSelectMyRepo
}) {
  const [newQueryId, setNewQueryId] = useState('');
  const [newQueryTitle, setNewQueryTitle] = useState('');
  const [filterText, setFilterText] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [repoInput, setRepoInput] = useState(githubRepoUrl || '');
  const [selectedFullName, setSelectedFullName] = useState('');
  const [activeTab, setActiveTab] = useState(
    githubPullRequests.length > 0 ? 'github' : 'local'
  );

  useEffect(() => {
    if (isOpen) {
      setRepoInput(githubRepoUrl || '');
      setActiveTab(githubPullRequests.length > 0 || githubLinked ? 'github' : 'local');
      if (githubLinked && onRefreshMyRepos) {
        onRefreshMyRepos();
      }
      const currentFull = (githubRepoUrl || '').replace(/^https?:\/\/github\.com\//, '');
      setSelectedFullName(currentFull);
    }
  }, [isOpen, githubRepoUrl, githubPullRequests.length, githubLinked]);

  if (!isOpen) return null;

  const filteredQueries = queries.filter(q =>
    q.query_id.toLowerCase().includes(filterText.toLowerCase()) ||
    (q.title && q.title.toLowerCase().includes(filterText.toLowerCase()))
  );

  const filteredGithubPrs = githubPullRequests.filter(pr =>
    String(pr.number).includes(filterText) ||
    (pr.title && pr.title.toLowerCase().includes(filterText.toLowerCase())) ||
    (pr.user && pr.user.toLowerCase().includes(filterText.toLowerCase()))
  );

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newQueryId.trim()) return;
    const cleanId = newQueryId.trim().toUpperCase();
    const cleanTitle = newQueryTitle.trim() || `PR #${cleanId}: Feature Review`;
    onCreateQuery(cleanId, cleanTitle);
    setNewQueryId('');
    setNewQueryTitle('');
    setIsCreating(false);
    onClose();
  };

  const handleLoadRepo = async (e) => {
    e.preventDefault();
    if (!repoInput.trim() || !onLoadRepo) return;
    const ok = await onLoadRepo(repoInput.trim());
    if (ok) setActiveTab('github');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-[#E6E0D5] max-w-xl w-full overflow-hidden flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#F9F6F0] border-b border-[#E6E0D5] p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#4F6D56] text-white rounded-xl shadow-xs">
              <GitPullRequest className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#242220]">Review Queries & Pull Requests</h3>
              <p className="text-xs text-[#6B635A]">
                {githubLinked
                  ? `Linked as @${githubLogin} — pick a repo or paste a URL`
                  : 'Load a public GitHub repo or switch local review targets'}
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

        {/* GitHub Repo Entry */}
        <div className="p-4 border-b border-[#E6E0D5] bg-[#FFFDF9] space-y-2.5">
          {githubLinked && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#6B635A] flex items-center gap-1.5">
                <Github className="w-3.5 h-3.5" />
                My Repos
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedFullName}
                  disabled={myReposLoading || githubLoading}
                  onChange={async (e) => {
                    const fullName = e.target.value;
                    setSelectedFullName(fullName);
                    if (!fullName || !onSelectMyRepo) return;
                    setRepoInput(fullName);
                    const ok = await onSelectMyRepo(fullName);
                    if (ok) setActiveTab('github');
                  }}
                  className="flex-1 text-xs p-2 bg-white border border-[#E6E0D5] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#C35832] font-mono"
                >
                  <option value="">
                    {myReposLoading ? 'Loading your repositories…' : 'Select a repository…'}
                  </option>
                  {myRepos.map((r) => (
                    <option key={r.id || r.fullName} value={r.fullName}>
                      {r.fullName}{r.private ? ' (private)' : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={onRefreshMyRepos}
                  disabled={myReposLoading}
                  className="px-3 py-2 text-xs font-bold border border-[#E6E0D5] bg-white hover:bg-[#F9F6F0] rounded-xl cursor-pointer disabled:opacity-50"
                  title="Refresh repo list"
                >
                  {myReposLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '↻'}
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleLoadRepo} className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#6B635A] flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5" />
              {githubLinked ? 'Or paste any repo URL' : 'Public repository URL'}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Github className="w-4 h-4 text-[#6B635A] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={repoInput}
                  onChange={e => setRepoInput(e.target.value)}
                  placeholder="https://github.com/owner/repo or owner/repo"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E6E0D5] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#C35832] font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={!repoInput.trim() || githubLoading}
                className="px-4 py-2 bg-[#242220] hover:bg-black text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50"
              >
                {githubLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Loading…</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    <span>Load Open PRs</span>
                  </>
                )}
              </button>
            </div>
          </form>
          {githubError && (
            <p className="text-[11px] text-[#C35832] bg-[#FFF8F6] border border-[#F7D8D0] rounded-lg px-2.5 py-1.5">
              {githubError}
            </p>
          )}
          {githubRepoUrl && !githubError && (
            <p className="text-[11px] text-[#4F6D56]">
              Loaded <strong>{githubPullRequests.length}</strong> open PR{githubPullRequests.length === 1 ? '' : 's'} from{' '}
              <span className="font-mono">{githubRepoUrl.replace('https://github.com/', '')}</span>
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="px-4 pt-3 flex items-center gap-2 border-b border-[#E6E0D5]">
          <button
            type="button"
            onClick={() => setActiveTab('github')}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'github'
                ? 'border-[#C35832] text-[#C35832]'
                : 'border-transparent text-[#6B635A] hover:text-[#242220]'
            }`}
          >
            GitHub Open PRs ({githubPullRequests.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('local')}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'local'
                ? 'border-[#C35832] text-[#C35832]'
                : 'border-transparent text-[#6B635A] hover:text-[#242220]'
            }`}
          >
            Local Queries ({queries.length})
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="p-4 border-b border-[#E6E0D5] flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#6B635A] absolute left-3 top-2.5" />
            <input
              type="text"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              placeholder={activeTab === 'github' ? 'Filter open PRs…' : 'Search PR query by name or ID...'}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F9F6F0] border border-[#E6E0D5] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#C35832]"
            />
          </div>
          {activeTab === 'local' && (
            <button
              onClick={() => setIsCreating(!isCreating)}
              className="px-3 py-1.5 bg-[#C35832] hover:bg-[#A84725] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1 shrink-0 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isCreating ? 'Cancel' : 'New Query'}</span>
            </button>
          )}
        </div>

        {/* Create Query Inline Box */}
        {activeTab === 'local' && isCreating && (
          <form onSubmit={handleCreate} className="p-4 bg-[#FFF8F6] border-b border-[#F7D8D0] space-y-2.5 animate-in fade-in">
            <div className="text-xs font-bold text-[#C35832]">Start New Review Session Target</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                required
                value={newQueryId}
                onChange={e => setNewQueryId(e.target.value)}
                placeholder="Query ID (e.g. PR-204)"
                className="text-xs p-2 bg-white border border-[#E6E0D5] rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-[#C35832]"
              />
              <input
                type="text"
                value={newQueryTitle}
                onChange={e => setNewQueryTitle(e.target.value)}
                placeholder="Title / Description (optional)"
                className="text-xs p-2 bg-white border border-[#E6E0D5] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#C35832]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-3 py-1 text-xs text-[#6B635A] hover:bg-black/5 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newQueryId.trim()}
                className="px-4 py-1 text-xs font-bold bg-[#C35832] hover:bg-[#A84725] text-white rounded-lg disabled:opacity-50 cursor-pointer"
              >
                Create & Open
              </button>
            </div>
          </form>
        )}

        {/* Lists */}
        <div className="p-4 space-y-2.5 overflow-y-auto flex-1">
          {activeTab === 'github' ? (
            filteredGithubPrs.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#6B635A] space-y-1">
                {githubPullRequests.length === 0 ? (
                  <>
                    <p>Paste a public GitHub repo URL above and click <strong>Load Open PRs</strong>.</p>
                    <p className="text-[11px]">Example: <span className="font-mono">facebook/react</span></p>
                  </>
                ) : (
                  <p>No open PRs match your filter.</p>
                )}
              </div>
            ) : (
              filteredGithubPrs.map(pr => {
                const isSelected = pr.queryId === currentQueryId;
                return (
                  <button
                    key={pr.queryId}
                    onClick={async () => {
                      if (onSelectGitHubPr) {
                        await onSelectGitHubPr(pr);
                      }
                      onClose();
                    }}
                    className={`w-full p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#FFFDF9] border-[#D08A29] shadow-xs ring-1 ring-[#D08A29]'
                        : 'bg-white border-[#E6E0D5] hover:bg-[#F9F6F0]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold font-mono text-[#C35832]">
                            #{pr.number}
                          </span>
                          {pr.draft && (
                            <span className="text-[10px] bg-[#F1ECE4] text-[#6B635A] px-1.5 py-0.2 rounded font-bold">
                              Draft
                            </span>
                          )}
                          {isSelected && (
                            <span className="text-[10px] bg-[#D08A29] text-white px-1.5 py-0.2 rounded font-bold">
                              Active PR
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-semibold text-[#242220] mt-0.5 line-clamp-2">
                          {pr.title}
                        </div>
                        <div className="text-[11px] text-[#6B635A] mt-1">
                          @{pr.user} · {pr.head} → {pr.base}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {pr.htmlUrl && (
                          <a
                            href={pr.htmlUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="p-1.5 text-[#6B635A] hover:text-[#242220] rounded-lg hover:bg-black/5"
                            title="Open on GitHub"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {isSelected && <Check className="w-5 h-5 text-[#D08A29]" />}
                      </div>
                    </div>
                  </button>
                );
              })
            )
          ) : filteredQueries.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#6B635A]">
              No queries match your search. Click <strong>+ New Query</strong> to create one.
            </div>
          ) : (
            filteredQueries.map(q => {
              const isSelected = q.query_id === currentQueryId;
              return (
                <button
                  key={q.query_id}
                  onClick={() => {
                    onSelectQuery(q.query_id);
                    onClose();
                  }}
                  className={`w-full p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#FFFDF9] border-[#D08A29] shadow-xs ring-1 ring-[#D08A29]'
                      : 'bg-white border-[#E6E0D5] hover:bg-[#F9F6F0]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-mono text-[#C35832]">
                          {q.query_id}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] bg-[#D08A29] text-white px-1.5 py-0.2 rounded font-bold">
                            Active Query
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-[#242220] mt-0.5">
                        {q.title || `Query ${q.query_id}`}
                      </div>
                    </div>
                    {isSelected && <Check className="w-5 h-5 text-[#D08A29] shrink-0" />}
                  </div>

                  <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-[#F1ECE4] text-[11px] text-[#6B635A]">
                    <span>📁 {q.reviewedFiles || 0}/{q.totalFiles || 0} Files</span>
                    {q.flagsCount > 0 && (
                      <span className="text-[#C35832] font-semibold flex items-center gap-0.5">
                        <ShieldAlert className="w-3 h-3" />
                        {q.flagsCount} {q.flagsCount === 1 ? 'flag' : 'flags'}
                      </span>
                    )}
                    {q.verdictsCount > 0 && (
                      <span className="text-[#4F6D56] font-semibold flex items-center gap-0.5">
                        <Award className="w-3 h-3" />
                        {q.verdictsCount} {q.verdictsCount === 1 ? 'verdict' : 'verdicts'}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#F9F6F0] border-t border-[#E6E0D5] p-3.5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold bg-white border border-[#E6E0D5] text-[#242220] hover:bg-[#FFFDF9] rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
