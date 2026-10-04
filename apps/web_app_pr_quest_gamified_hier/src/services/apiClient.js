// PR Quest API Client for multi-user reviews and independent progression

const API_BASE = '/api';

export const PRESET_USERS = [
  { id: 'alex', username: 'alex', name: 'Alex Chen', avatar: '👨‍💻' },
  { id: 'sarah', username: 'sarah', name: 'Sarah Lin', avatar: '👩‍💻' },
  { id: 'marcus', username: 'marcus', name: 'Marcus Brody', avatar: '🧑‍🔬' }
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
      if (saved) return JSON.parse(saved);
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
    return this.saveUserProgress(queryId, userProgress);
  }

  async updateFileReviewStatus(queryId, fileId, status) {
    const userId = this.currentUser?.id || 'alex';
    const userName = this.currentUser?.name || 'Reviewer';

    try {
      const res = await fetch(`${API_BASE}/file-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
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
    const userId = this.currentUser?.id || 'alex';
    const enrichedComment = {
      authorId: userId,
      authorName: this.currentUser?.name || 'Reviewer',
      authorAvatar: this.currentUser?.avatar || '👤',
      ...commentPayload
    };

    try {
      const res = await fetch(`${API_BASE}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify({ queryId, fileId, comment: enrichedComment })
      });
      if (res.ok) {
        const data = await res.json();
        return { success: true, comment: data.comment, isOnline: true };
      }
    } catch (_) {}

    const localComment = {
      id: `c_local_${Date.now()}`,
      ...enrichedComment,
      timestamp: 'Just now'
    };
    return { success: true, comment: localComment, isOnline: false };
  }

  async submitVerdict(queryId, verdictPayload) {
    const userId = this.currentUser?.id || 'alex';
    const payload = {
      userId,
      userName: this.currentUser?.name || 'Reviewer',
      userAvatar: this.currentUser?.avatar || '👤',
      ...verdictPayload
    };

    try {
      const res = await fetch(`${API_BASE}/verdict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify({ queryId, verdict: payload })
      });
      if (res.ok) {
        const data = await res.json();
        return { success: true, verdicts: data.verdicts, isOnline: true };
      }
    } catch (_) {}

    return { success: true, verdict: payload, isOnline: false };
  }
}

export const api = new ApiClient();
