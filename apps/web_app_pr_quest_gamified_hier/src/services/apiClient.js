// PR Quest API Client for multi-user reviews and independent progression

const API_BASE = '/api';

export const PRESET_USERS = [
  { id: 'reviewer_1', username: 'reviewer_1', name: 'reviewer_1', avatar: '👨‍💻' },
  { id: 'reviewer_2', username: 'reviewer_2', name: 'reviewer_2', avatar: '👩‍💻' },
  { id: 'reviewer_3', username: 'reviewer_3', name: 'reviewer_3', avatar: '🧑‍🔬' }
];

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('pr_quest_token') || null;
    this.currentUser = this.getInitialUser();
    this.isOnline = true;
  }

  getInitialUser() {
    try {
      const saved = localStorage.getItem('pr_quest_user');
      if (saved) {
        const u = JSON.parse(saved);
        if (u.id === 'alex' || u.name === 'Alex Chen') return PRESET_USERS[0];
        if (u.id === 'sarah' || u.name === 'Sarah Lin') return PRESET_USERS[1];
        if (u.id === 'marcus' || u.name === 'Marcus Brody') return PRESET_USERS[2];
        return u;
      }
    } catch (_) {}
    return PRESET_USERS[0];
  }

  setCurrentUser(user) {
    this.currentUser = user;
    localStorage.setItem('pr_quest_user', JSON.stringify(user));
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('pr_quest_token', token);
    } else {
      localStorage.removeItem('pr_quest_token');
    }
  }

  async checkHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
      this.isOnline = res.ok;
      return res.ok;
    } catch (_) {
      this.isOnline = false;
      return false;
    }
  }

  async getPersonas() {
    try {
      const res = await fetch(`${API_BASE}/users/personas`, { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        return await res.json();
      }
    } catch (_) {}
    return PRESET_USERS;
  }

  async login({ personaId, username }) {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId, username })
      });
      if (res.ok) {
        const data = await res.json();
        this.setToken(data.token);
        this.setCurrentUser(data.user);
        return { success: true, user: data.user };
      }
    } catch (_) {}

    // Local fallback
    if (personaId) {
      const found = PRESET_USERS.find(p => p.id === personaId);
      if (found) {
        this.setCurrentUser(found);
        return { success: true, user: found };
      }
    }
    const fallbackUser = { id: username || 'user', username: username || 'user', name: username || 'Reviewer', avatar: '👤' };
    this.setCurrentUser(fallbackUser);
    return { success: true, user: fallbackUser };
  }

  logout() {
    this.setToken(null);
    this.setCurrentUser(PRESET_USERS[0]);
  }

  authHeaders(extra = {}) {
    const userId = this.currentUser?.id || 'reviewer_1';
    const headers = {
      'x-user-id': userId,
      ...extra
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    return headers;
  }

  /** Start GitHub OAuth in the browser (full-page redirect). */
  startGithubOAuth() {
    const userId = this.currentUser?.id || 'reviewer_1';
    window.location.href = `${API_BASE}/github/oauth/start?userId=${encodeURIComponent(userId)}`;
  }

  async getGithubStatus() {
    try {
      const res = await fetch(`${API_BASE}/github/status`, {
        headers: this.authHeaders(),
        signal: AbortSignal.timeout(4000)
      });
      if (!res.ok) return { linked: false, login: null, avatarUrl: null, configured: false };
      return await res.json();
    } catch (_) {
      return { linked: false, login: null, avatarUrl: null, configured: false };
    }
  }

  async unlinkGithub() {
    try {
      const res = await fetch(`${API_BASE}/github/unlink`, {
        method: 'POST',
        headers: this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ userId: this.currentUser?.id })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, error: err.error || 'Failed to unlink GitHub' };
      }
      return { success: true, linked: false };
    } catch (_) {
      return { success: false, error: 'Server unreachable' };
    }
  }

  /** Link GitHub by pasting a personal access token (stored server-side only). */
  async linkGithubWithToken(token) {
    try {
      const res = await fetch(`${API_BASE}/github/link-token`, {
        method: 'POST',
        headers: this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          userId: this.currentUser?.id,
          token: String(token || '').trim()
        }),
        signal: AbortSignal.timeout(10000)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to link GitHub token' };
      }
      return {
        success: true,
        linked: true,
        login: data.login,
        avatarUrl: data.avatarUrl || null
      };
    } catch (_) {
      return { success: false, error: 'Server unreachable' };
    }
  }

  async listGithubRepos() {
    try {
      const res = await fetch(`${API_BASE}/github/repos`, {
        headers: this.authHeaders(),
        signal: AbortSignal.timeout(15000)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to list repositories', repos: [] };
      }
      return { success: true, repos: data.repos || [], count: data.count || 0 };
    } catch (_) {
      return { success: false, error: 'Server unreachable', repos: [] };
    }
  }

  /**
   * Fetch open PRs for a repo URL (or owner/repo). Uses linked GitHub token when available.
   */
  async fetchOpenPullRequests(repoUrl) {
    try {
      const res = await fetch(`${API_BASE}/github/open-prs`, {
        method: 'POST',
        headers: this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ repoUrl }),
        signal: AbortSignal.timeout(15000)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const hint = (res.status >= 500 && !data.error)
          ? 'API server not running. Start it with: npm run server'
          : (data.error || `Failed to load PRs (${res.status})`);
        return { success: false, error: hint };
      }
      return {
        success: true,
        owner: data.owner,
        repo: data.repo,
        repoUrl: data.repoUrl,
        count: data.count,
        pullRequests: data.pullRequests || [],
        authenticated: Boolean(data.authenticated)
      };
    } catch (_) {
      return { success: false, error: 'Server unreachable. Start the API server with: npm run server' };
    }
  }

  /**
   * Load a GitHub PR (files + diffs) into a review workspace payload.
   */
  async fetchGitHubPullRequest(owner, repo, number, options = {}) {
    try {
      const qp = new URLSearchParams();
      if (options.head) qp.set('head', options.head);
      if (options.base) qp.set('base', options.base);
      if (options.title) qp.set('title', options.title);
      const qs = qp.toString() ? `?${qp.toString()}` : '';

      const res = await fetch(
        `${API_BASE}/github/pr/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(number)}${qs}`,
        {
          headers: this.authHeaders(),
          signal: AbortSignal.timeout(20000)
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const hint = (res.status >= 500 && !data.error)
          ? 'API server not running. Start it with: npm run server'
          : (data.error || `Failed to load PR #${number}`);
        return { success: false, error: hint };
      }
      return { success: true, ...data };
    } catch (_) {
      return { success: false, error: 'Server unreachable. Start the API server with: npm run server' };
    }
  }

  /**
   * Get Gemini AI configuration status.
   */
  async getGeminiStatus() {
    try {
      const res = await fetch(`${API_BASE}/gemini/status`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        return await res.json();
      }
      return { configured: false, source: 'none' };
    } catch (_) {
      return { configured: false, source: 'none' };
    }
  }

  /**
   * Save Gemini API key in server DB.
   */
  async saveGeminiKey(apiKey) {
    try {
      const res = await fetch(`${API_BASE}/gemini/key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
        signal: AbortSignal.timeout(5000)
      });
      const data = await res.json().catch(() => ({}));
      return { success: res.ok, ...data };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to save Gemini key' };
    }
  }

  /**
   * Link a GitHub Issue directly to a PR query to extract Acceptance Criteria.
   */
  async linkGithubIssue(queryId, issueNumberOrUrl) {
    try {
      const res = await fetch(`${API_BASE}/github/link-issue`, {
        method: 'POST',
        headers: this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ queryId, issueNumberOrUrl }),
        signal: AbortSignal.timeout(30000)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to link GitHub issue' };
      }
      return { success: true, ...data };
    } catch (err) {
      return { success: false, error: err.message || 'Network error linking issue' };
    }
  }

  /**
   * Upload an architecture.md document and run Gemini architecture diff analysis.
   */
  async uploadArchitectureDoc(queryId, fileName, content) {
    try {
      const res = await fetch(`${API_BASE}/architecture/upload`, {
        method: 'POST',
        headers: this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ queryId, fileName, content }),
        signal: AbortSignal.timeout(45000)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to upload architecture document' };
      }
      return { success: true, ...data };
    } catch (err) {
      return { success: false, error: err.message || 'Network error uploading architecture' };
    }
  }

  /**
   * Trigger full Gemini AI autopopulate across all 4 review levels.
   */
  async triggerAiPopulate(queryId) {
    try {
      const res = await fetch(`${API_BASE}/github/ai-populate`, {
        method: 'POST',
        headers: this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ queryId }),
        signal: AbortSignal.timeout(45000)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || 'AI population failed' };
      }
      return { success: true, ...data };
    } catch (err) {
      return { success: false, error: err.message || 'Network error during AI population' };
    }
  }

  async listQueries() {
    try {
      const res = await fetch(`${API_BASE}/queries`, { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('pr_quest_queries_cache', JSON.stringify(data));
        return data;
      }
    } catch (_) {}

    const cached = localStorage.getItem('pr_quest_queries_cache');
    if (cached) {
      try { return JSON.parse(cached); } catch (_) {}
    }
    return [
      {
        query_id: 'PR-101',
        title: 'PR #101: Session Token Rotation & Salt Validation',
        updated_at: new Date().toISOString(),
        totalFiles: 5,
        totalApprovals: 0,
        totalFlags: 1,
        verdictsCount: 1
      },
      {
        query_id: 'PR-102',
        title: 'PR #102: Distributed Redis Token Bucket Rate Limiter',
        updated_at: new Date().toISOString(),
        totalFiles: 2,
        totalApprovals: 0,
        totalFlags: 0,
        verdictsCount: 0
      }
    ];
  }

  async getQueryState(queryId, overrideUserId = null) {
    const userId = overrideUserId || this.currentUser?.id || 'alex';
    try {
      const res = await fetch(`${API_BASE}/state?query=${encodeURIComponent(queryId)}&userId=${encodeURIComponent(userId)}`, {
        headers: { 'x-user-id': userId },
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem(`pr_quest_query_${queryId}_${userId}`, JSON.stringify(data));
        return { success: true, data, isOnline: true };
      }
    } catch (_) {}

    const cached = localStorage.getItem(`pr_quest_query_${queryId}_${userId}`);
    if (cached) {
      try {
        return { success: true, data: JSON.parse(cached), isOnline: false };
      } catch (_) {}
    }

    return { success: false, error: 'Query not found', isOnline: false };
  }

  async saveUserProgress(queryId, userProgress) {
    const userId = this.currentUser?.id || 'alex';
    const cacheKey = `pr_quest_user_prog_${queryId}_${userId}`;
    localStorage.setItem(cacheKey, JSON.stringify(userProgress));

    try {
      const res = await fetch(`${API_BASE}/state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify({ queryId, userProgress, userId })
      });
      if (res.ok) {
        return { success: true, isOnline: true };
      }
    } catch (_) {}

    return { success: true, isOnline: false };
  }

  async saveQueryState(queryId, title, stateObj, userProgress) {
    const userId = this.currentUser?.id || 'reviewer_1';
    const cachePayload = { queryId, title, state: stateObj, userProgress, updatedAt: new Date().toISOString() };
    localStorage.setItem(`pr_quest_query_${queryId}`, JSON.stringify(cachePayload));

    try {
      const res = await fetch(`${API_BASE}/state`, {
        method: 'POST',
        headers: this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ queryId, title, state: stateObj, userProgress, userId })
      });
      if (res.ok) {
        return { success: true, isOnline: true };
      }
    } catch (_) {}

    return { success: true, isOnline: false };
  }

  async updateFileReviewStatus(queryId, fileId, status) {
    const userId = this.currentUser?.id || 'reviewer_1';
    const userName = this.currentUser?.name || 'Reviewer';

    try {
      const res = await fetch(`${API_BASE}/file-status`, {
        method: 'POST',
        headers: this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ queryId, fileId, status, userId, userName })
      });
      if (res.ok) {
        const data = await res.json();
        return { success: true, file: data.file, isOnline: true };
      }
    } catch (_) {}

    return { success: true, isOnline: false };
  }

  async addComment(queryId, fileId, commentPayload) {
    const userId = this.currentUser?.id || 'reviewer_1';
    const enrichedComment = {
      authorId: userId,
      authorName: this.currentUser?.name || 'Reviewer',
      authorAvatar: this.currentUser?.avatar || '👤',
      ...commentPayload
    };

    try {
      const res = await fetch(`${API_BASE}/comments`, {
        method: 'POST',
        headers: this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ queryId, fileId, comment: enrichedComment })
      });
      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          comment: data.comment,
          githubSync: data.githubSync || null,
          isOnline: true
        };
      }
    } catch (_) {}

    const localComment = {
      id: `c_local_${Date.now()}`,
      ...enrichedComment,
      timestamp: 'Just now'
    };
    return { success: true, comment: localComment, githubSync: null, isOnline: false };
  }

  async submitVerdict(queryId, verdictPayload) {
    const userId = this.currentUser?.id || 'reviewer_1';
    const payload = {
      userId,
      userName: this.currentUser?.name || 'Reviewer',
      userAvatar: this.currentUser?.avatar || '👤',
      ...verdictPayload
    };

    try {
      const res = await fetch(`${API_BASE}/verdict`, {
        method: 'POST',
        headers: this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ queryId, verdict: payload })
      });
      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          verdicts: data.verdicts,
          githubSync: data.githubSync || null,
          isOnline: true
        };
      }
    } catch (_) {}

    return { success: true, verdict: payload, githubSync: null, isOnline: false };
  }

  async removeFlag(queryId, fileId, userId) {
    if (this.isOnline) {
      try {
        const res = await fetch(`${API_BASE}/queries/${encodeURIComponent(queryId)}/files/${encodeURIComponent(fileId)}/flags`, {
          method: 'DELETE',
          headers: {
            'x-user-id': userId
          }
        });
        if (res.ok) {
          return await res.json();
        }
      } catch (err) {
        console.warn('[API] removeFlag failed:', err);
      }
    }
    return { success: true };
  }
}

export const api = new ApiClient();
