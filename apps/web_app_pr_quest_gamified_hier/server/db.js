import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  initialFiles,
  initialJiraTicket,
  architectureStandards,
  initialTestSuites
} from '../src/mockData.js';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'pr_quest.db');

// Simple reviewer users without complex roles
export const PRESET_USERS = [
  { id: 'alex', username: 'alex', name: 'Alex Chen', avatar: '👨‍💻' },
  { id: 'sarah', username: 'sarah', name: 'Sarah Lin', avatar: '👩‍💻' },
  { id: 'marcus', username: 'marcus', name: 'Marcus Brody', avatar: '🧑‍🔬' }
];

class DatabaseManager {
  constructor() {
    this.sqlite = null;
    this.useMemoryFallback = false;
    this.fallbackStore = {
      users: {},
      review_queries: {},
      user_progress: {}
    };
    this.init();
  }

  init() {
    try {
      const { DatabaseSync } = require('node:sqlite');
      this.sqlite = new DatabaseSync(DB_PATH);
      this.initTables();
      this.seedInitialData();
      console.log(`[DB] SQLite initialized successfully at: ${DB_PATH}`);
    } catch (err) {
      console.warn(`[DB] Native SQLite fallback active (${err.message}). Using persistent JSON storage.`);
      this.useMemoryFallback = true;
      this.initJsonFallback();
    }
  }

  initTables() {
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        avatar TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS review_queries (
        query_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        files_json TEXT NOT NULL,
        verdicts_json TEXT NOT NULL DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_progress (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        query_id TEXT NOT NULL,
        level INTEGER DEFAULT 1,
        unlocked_level INTEGER DEFAULT 1,
        xp INTEGER DEFAULT 0,
        awarded_actions_json TEXT DEFAULT '[]',
        criteria_json TEXT NOT NULL,
        standards_json TEXT NOT NULL,
        symbols_json TEXT NOT NULL DEFAULT '[]',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, query_id)
      );
    `);
  }

  seedInitialData() {
    // Seed Preset Users (no roles)
    for (const u of PRESET_USERS) {
      const existing = this.getUserById(u.id);
      if (!existing) {
        const stmt = this.sqlite.prepare(`
          INSERT INTO users (id, username, name, avatar)
          VALUES (?, ?, ?, ?)
        `);
        stmt.run(u.id, u.username, u.name, u.avatar);
      }
    }

    // Seed PR-101
    const existingPr101 = this.getQuery(null, 'PR-101');
    if (!existingPr101) {
      // Seed files with 1 initial flag from Alex Chen on file-1 to demonstrate peer reviews
      const freshFiles = JSON.parse(JSON.stringify(initialFiles)).map((f, idx) => {
        if (idx === 0) {
          return {
            ...f,
            reviewerStatuses: {
              alex: { status: 'flagged', userName: 'Alex Chen', timestamp: '10 mins ago' }
            },
            comments: [
              {
                id: 'c-alex-1',
                line: 8,
                authorId: 'alex',
                authorName: 'Alex Chen',
                authorAvatar: '👨‍💻',
                type: 'flag',
                text: 'Critical: The rotateSessionToken() routine must validate that the salt meets minimum 256-bit entropy standards before writing to session state.',
                timestamp: '10 mins ago'
              }
            ]
          };
        }
        return {
          ...f,
          reviewerStatuses: {},
          comments: []
        };
      });

      const initialVerdicts = [
        {
          userId: 'alex',
          userName: 'Alex Chen',
          userAvatar: '👨‍💻',
          verdict: 'changes_requested',
          notes: 'Requested changes on SessionManager.js: must enforce 256-bit salt entropy validation before persisting tokens.',
          timestamp: '10 mins ago'
        }
      ];

      this.saveQuery('PR-101', 'PR #101: Session Token Rotation & Salt Validation', freshFiles, initialVerdicts);
    }

    // Seed PR-102
    const existingPr102 = this.getQuery(null, 'PR-102');
    if (!existingPr102) {
      const pr102Files = JSON.parse(JSON.stringify(initialFiles)).slice(0, 2).map((f, i) => ({
        ...f,
        id: `f-102-${i+1}`,
        path: i === 0 ? "src/limiter/tokenBucket.ts" : "src/limiter/redisClient.ts",
        specTag: i === 0 ? "AC-102-1" : "AC-102-2",
        reviewerStatuses: {},
        comments: []
      }));
      this.saveQuery('PR-102', 'PR #102: Distributed Redis Token Bucket Rate Limiter', pr102Files, []);
    }
  }

  // --- Fallback JSON storage ---
  initJsonFallback() {
    this.fallbackFile = path.join(DATA_DIR, 'pr_quest_store.json');
    if (fs.existsSync(this.fallbackFile)) {
      try {
        const raw = fs.readFileSync(this.fallbackFile, 'utf8');
        this.fallbackStore = JSON.parse(raw);
      } catch (e) {
        console.error('[DB Fallback] Failed reading store file, resetting.', e);
      }
    }

    for (const u of PRESET_USERS) {
      if (!this.fallbackStore.users[u.id]) {
        this.fallbackStore.users[u.id] = { ...u, created_at: new Date().toISOString() };
      }
    }

    if (!this.fallbackStore.review_queries['PR-101']) {
      const freshFiles = JSON.parse(JSON.stringify(initialFiles));
      freshFiles[0].reviewerStatuses = {
        alex: { status: 'flagged', userName: 'Alex Chen', timestamp: '10 mins ago' }
      };
      freshFiles[0].comments = [
        {
          id: 'c-alex-1',
          authorId: 'alex',
          authorName: 'Alex Chen',
          authorAvatar: '👨‍💻',
          type: 'flag',
          text: 'Critical: The rotateSessionToken() routine must validate that the salt meets minimum 256-bit entropy standards before writing to session state.',
          timestamp: '10 mins ago'
        }
      ];

      this.fallbackStore.review_queries['PR-101'] = {
        query_id: 'PR-101',
        title: 'PR #101: Session Token Rotation & Salt Validation',
        files_json: JSON.stringify(freshFiles),
        verdicts_json: JSON.stringify([
          {
            userId: 'alex',
            userName: 'Alex Chen',
            userAvatar: '👨‍💻',
            verdict: 'changes_requested',
            notes: 'Requested changes on SessionManager.js: must enforce 256-bit salt entropy validation before persisting tokens.',
            timestamp: '10 mins ago'
          }
        ]),
        updated_at: new Date().toISOString()
      };
    }

    this.persistFallback();
  }

  persistFallback() {
    if (this.useMemoryFallback && this.fallbackFile) {
      fs.writeFileSync(this.fallbackFile, JSON.stringify(this.fallbackStore, null, 2), 'utf8');
    }
  }

  // --- Users Operations ---
  getUserById(id) {
    if (this.useMemoryFallback) {
      return this.fallbackStore.users[id] || null;
    }
    const stmt = this.sqlite.prepare(`SELECT * FROM users WHERE id = ?`);
    return stmt.get(id) || null;
  }

  getUserByUsername(username) {
    if (this.useMemoryFallback) {
      return Object.values(this.fallbackStore.users).find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
    }
    const stmt = this.sqlite.prepare(`SELECT * FROM users WHERE LOWER(username) = LOWER(?)`);
    return stmt.get(username) || null;
  }

  createUser(id, username, name, avatar = '👤') {
    if (this.useMemoryFallback) {
      const user = { id, username, name, avatar, created_at: new Date().toISOString() };
      this.fallbackStore.users[id] = user;
      this.persistFallback();
      return user;
    }
    const stmt = this.sqlite.prepare(`
      INSERT INTO users (id, username, name, avatar)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, username, name, avatar);
    return this.getUserById(id);
  }

  // --- Review Queries (Shared PR Files & Verdicts) ---
  listQueries() {
    if (this.useMemoryFallback) {
      return Object.values(this.fallbackStore.review_queries).map(q => {
        let files = [];
        let verdicts = [];
        try { files = JSON.parse(q.files_json); } catch (_) {}
        try { verdicts = JSON.parse(q.verdicts_json); } catch (_) {}

        let totalApprovals = 0;
        let totalFlags = 0;
        for (const f of files) {
          const statuses = Object.values(f.reviewerStatuses || {});
          if (statuses.some(s => s.status === 'approved')) totalApprovals++;
          if (statuses.some(s => s.status === 'flagged')) totalFlags++;
        }

        return {
          query_id: q.query_id,
          title: q.title,
          updated_at: q.updated_at,
          totalFiles: files.length,
          totalApprovals,
          totalFlags,
          verdictsCount: verdicts.length
        };
      }).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    }

    const rows = this.sqlite.prepare(`
      SELECT query_id, title, files_json, verdicts_json, updated_at
      FROM review_queries
      ORDER BY updated_at DESC
    `).all();

    return rows.map(r => {
      let files = [];
      let verdicts = [];
      try { files = JSON.parse(r.files_json); } catch (_) {}
      try { verdicts = JSON.parse(r.verdicts_json); } catch (_) {}

      let totalApprovals = 0;
      let totalFlags = 0;
      for (const f of files) {
        const statuses = Object.values(f.reviewerStatuses || {});
        if (statuses.some(s => s.status === 'approved')) totalApprovals++;
        if (statuses.some(s => s.status === 'flagged')) totalFlags++;
      }

      return {
        query_id: r.query_id,
        title: r.title,
        updated_at: r.updated_at,
        totalFiles: files.length,
        totalApprovals,
        totalFlags,
        verdictsCount: verdicts.length
      };
    });
  }

  getQuery(userId, queryId) {
    if (this.useMemoryFallback) {
      const q = this.fallbackStore.review_queries[queryId];
      if (!q) return null;
      let files = [];
      let verdicts = [];
      try { files = JSON.parse(q.files_json); } catch (_) {}
      try { verdicts = JSON.parse(q.verdicts_json); } catch (_) {}
      return {
        queryId: q.query_id,
        title: q.title,
        files,
        verdicts,
        updatedAt: q.updated_at
      };
    }

    const row = this.sqlite.prepare(`
      SELECT query_id, title, files_json, verdicts_json, updated_at
      FROM review_queries
      WHERE query_id = ?
    `).get(queryId);

    if (!row) return null;
    let files = [];
    let verdicts = [];
    try { files = JSON.parse(row.files_json); } catch (_) {}
    try { verdicts = JSON.parse(row.verdicts_json); } catch (_) {}
    return {
      queryId: row.query_id,
      title: row.title,
      files,
      verdicts,
      updatedAt: row.updated_at
    };
  }

  saveQuery(queryId, title, files, verdicts) {
    const filesJson = JSON.stringify(files);
    const verdictsJson = JSON.stringify(verdicts || []);
    const now = new Date().toISOString();

    if (this.useMemoryFallback) {
      this.fallbackStore.review_queries[queryId] = {
        query_id: queryId,
        title: title || `Query ${queryId}`,
        files_json: filesJson,
        verdicts_json: verdictsJson,
        updated_at: now
      };
      this.persistFallback();
      return true;
    }

    const stmt = this.sqlite.prepare(`
      INSERT INTO review_queries (query_id, title, files_json, verdicts_json, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(query_id) DO UPDATE SET
        title = excluded.title,
        files_json = excluded.files_json,
        verdicts_json = excluded.verdicts_json,
        updated_at = excluded.updated_at
    `);
    stmt.run(queryId, title || `Query ${queryId}`, filesJson, verdictsJson, now);
    return true;
  }

  // --- Independent User Progress (Unique per User!) ---
  getUserProgress(userId, queryId) {
    const key = `${userId}:${queryId}`;
    if (this.useMemoryFallback) {
      const p = this.fallbackStore.user_progress[key];
      if (!p) {
        return this.createDefaultUserProgress(userId, queryId);
      }
      return {
        userId: p.user_id,
        queryId: p.query_id,
        level: p.level || 1,
        unlockedLevel: p.unlocked_level || 1,
        xp: p.xp || 0,
        awardedActions: JSON.parse(p.awarded_actions_json || '[]'),
        criteria: JSON.parse(p.criteria_json || '[]'),
        standards: JSON.parse(p.standards_json || '[]'),
        auditedSymbols: JSON.parse(p.symbols_json || '[]'),
        updatedAt: p.updated_at
      };
    }

    const row = this.sqlite.prepare(`
      SELECT user_id, query_id, level, unlocked_level, xp, awarded_actions_json, criteria_json, standards_json, symbols_json, updated_at
      FROM user_progress
      WHERE user_id = ? AND query_id = ?
    `).get(userId, queryId);

    if (!row) {
      return this.createDefaultUserProgress(userId, queryId);
    }

    return {
      userId: row.user_id,
      queryId: row.query_id,
      level: row.level || 1,
      unlockedLevel: row.unlocked_level || 1,
      xp: row.xp || 0,
      awardedActions: JSON.parse(row.awarded_actions_json || '[]'),
      criteria: JSON.parse(row.criteria_json || '[]'),
      standards: JSON.parse(row.standards_json || '[]'),
      auditedSymbols: JSON.parse(row.symbols_json || '[]'),
      updatedAt: row.updated_at
    };
  }

  createDefaultUserProgress(userId, queryId) {
    // All ACs start unchecked (completed: false), Level 1, 0 XP!
    const defaultCriteria = initialJiraTicket.criteria.map(ac => ({
      id: ac.id,
      text: ac.text,
      completed: false
    }));

    const defaultStandards = architectureStandards.map(s => ({
      ...s,
      completed: false
    }));

    const progress = {
      userId,
      queryId,
      level: 1,
      unlockedLevel: 1,
      xp: 0,
      awardedActions: [],
      criteria: defaultCriteria,
      standards: defaultStandards,
      auditedSymbols: [],
      updatedAt: new Date().toISOString()
    };

    this.saveUserProgress(userId, queryId, progress);
    return progress;
  }

  saveUserProgress(userId, queryId, progress) {
    const key = `${userId}:${queryId}`;
    const level = progress.level || 1;
    const unlockedLevel = progress.unlockedLevel || 1;
    const xp = progress.xp || 0;
    const awardedJson = JSON.stringify(progress.awardedActions || []);
    const criteriaJson = JSON.stringify(progress.criteria || []);
    const standardsJson = JSON.stringify(progress.standards || []);
    const symbolsJson = JSON.stringify(progress.auditedSymbols || []);
    const now = new Date().toISOString();

    if (this.useMemoryFallback) {
      this.fallbackStore.user_progress[key] = {
        id: key,
        user_id: userId,
        query_id: queryId,
        level,
        unlocked_level: unlockedLevel,
        xp,
        awarded_actions_json: awardedJson,
        criteria_json: criteriaJson,
        standards_json: standardsJson,
        symbols_json: symbolsJson,
        updated_at: now
      };
      this.persistFallback();
      return true;
    }

    const stmt = this.sqlite.prepare(`
      INSERT INTO user_progress (id, user_id, query_id, level, unlocked_level, xp, awarded_actions_json, criteria_json, standards_json, symbols_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        level = excluded.level,
        unlocked_level = excluded.unlocked_level,
        xp = excluded.xp,
        awarded_actions_json = excluded.awarded_actions_json,
        criteria_json = excluded.criteria_json,
        standards_json = excluded.standards_json,
        symbols_json = excluded.symbols_json,
        updated_at = excluded.updated_at
    `);
    stmt.run(key, userId, queryId, level, unlockedLevel, xp, awardedJson, criteriaJson, standardsJson, symbolsJson, now);
    return true;
  }

  // --- Per-File Approval / Flag by User ---
  updateFileReviewStatus(queryId, fileId, userId, userName, status) {
    const query = this.getQuery(userId, queryId);
    if (!query) return null;

    const file = query.files.find(f => f.id === fileId);
    if (!file) return null;

    file.reviewerStatuses = file.reviewerStatuses || {};
    file.reviewerStatuses[userId] = {
      status, // 'approved' | 'flagged' | 'pending'
      userName: userName || 'Reviewer',
      timestamp: 'Just now'
    };

    this.saveQuery(queryId, query.title, query.files, query.verdicts);
    return file;
  }

  // --- Add Comment or Flag to File ---
  addComment(queryId, fileId, comment) {
    const query = this.getQuery(comment.authorId, queryId);
    if (!query) return null;

    const file = query.files.find(f => f.id === fileId);
    if (!file) return null;

    file.comments = file.comments || [];
    const newComment = {
      id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      authorId: comment.authorId,
      authorName: comment.authorName || 'Reviewer',
      authorAvatar: comment.authorAvatar || '👤',
      type: comment.type || 'note', // 'flag' | 'note' | 'approval'
      text: comment.text,
      timestamp: 'Just now'
    };

    file.comments.push(newComment);

    if (comment.type === 'flag') {
      file.reviewerStatuses = file.reviewerStatuses || {};
      file.reviewerStatuses[comment.authorId] = {
        status: 'flagged',
        userName: comment.authorName || 'Reviewer',
        timestamp: 'Just now'
      };
    }

    this.saveQuery(queryId, query.title, query.files, query.verdicts);
    return { file, comment: newComment };
  }

  // --- Record Verdict ---
  recordVerdict(queryId, verdict) {
    const query = this.getQuery(verdict.userId, queryId);
    if (!query) return null;

    query.verdicts = query.verdicts || [];
    const idx = query.verdicts.findIndex(v => v.userId === verdict.userId);
    const newVerdict = {
      userId: verdict.userId,
      userName: verdict.userName || 'Reviewer',
      userAvatar: verdict.userAvatar || '👤',
      verdict: verdict.verdict,
      notes: verdict.notes || '',
      timestamp: 'Just now'
    };

    if (idx >= 0) {
      query.verdicts[idx] = newVerdict;
    } else {
      query.verdicts.push(newVerdict);
    }

    this.saveQuery(queryId, query.title, query.files, query.verdicts);
    return query.verdicts;
  }
}

export const db = new DatabaseManager();
