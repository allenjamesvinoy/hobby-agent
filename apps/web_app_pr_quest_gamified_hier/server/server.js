import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db, PRESET_USERS } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// List simple users (for 1-click persona switching / demo)
app.get('/api/users/personas', (req, res) => {
  res.json(PRESET_USERS);
});

// Simple Login / Persona Selection
app.post('/api/auth/login', (req, res) => {
  const { personaId, username } = req.body;

  if (personaId) {
    const user = db.getUserById(personaId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ token: `token_${user.id}_${Date.now()}`, user });
  }

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  let user = db.getUserByUsername(username);
  if (!user) {
    // Auto-create user for frictionless login
    const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    user = db.createUser(id, username, username, '👤');
  }

  return res.json({ token: `token_${user.id}_${Date.now()}`, user });
});

app.post('/api/auth/register', (req, res) => {
  const { username, name, avatar } = req.body;
  if (!username || !name) {
    return res.status(400).json({ error: 'Username and name are required' });
  }

  const existing = db.getUserByUsername(username);
  if (existing) {
    return res.json({ token: `token_${existing.id}_${Date.now()}`, user: existing });
  }

  const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const newUser = db.createUser(id, username, name, avatar || '👤');
  return res.status(201).json({ token: `token_${newUser.id}_${Date.now()}`, user: newUser });
});

app.get('/api/auth/me', (req, res) => {
  const userId = req.headers['x-user-id'] || 'alex';
  const user = db.getUserById(userId) || PRESET_USERS[0];
  res.json({ user });
});

// List queries with team approval & flag summaries
app.get('/api/queries', (req, res) => {
  const queries = db.listQueries();
  res.json(queries);
});

// Get state for a review query
// Combines: Shared PR Files (with team approvals, flags & comments) + User's Independent Progress (ACs, standards, symbols)
app.get('/api/state', (req, res) => {
  const queryId = req.query.query || 'PR-101';
  const userId = req.query.userId || req.headers['x-user-id'] || 'alex';

  let queryRecord = db.getQuery(userId, queryId);

  // Auto-seed query if not yet existing
  if (!queryRecord) {
    const pr101 = db.getQuery(userId, 'PR-101');
    const freshFiles = pr101 ? pr101.files.map(f => ({ ...f, reviewerStatuses: {}, comments: [] })) : [];
    db.saveQuery(queryId, `PR #${queryId}: Feature Review`, freshFiles, []);
    queryRecord = db.getQuery(userId, queryId);
  }

  const userProgress = db.getUserProgress(userId, queryId);

  res.json({
    queryId: queryRecord.queryId,
    title: queryRecord.title,
    files: queryRecord.files,
    verdicts: queryRecord.verdicts,
    userProgress,
    updatedAt: queryRecord.updatedAt
  });
});

// Save user's independent review progress (left panel ACs, standards, level, xp)
app.post('/api/state', (req, res) => {
  const { queryId, userProgress, userId } = req.body;
  if (!queryId || !userId || !userProgress) {
    return res.status(400).json({ error: 'queryId, userId, and userProgress are required' });
  }

  db.saveUserProgress(userId, queryId, userProgress);
  res.json({ success: true, updatedAt: new Date().toISOString() });
});

// Update a reviewer's approval or flag on a code file (Shared state)
app.post('/api/file-status', (req, res) => {
  const { queryId, fileId, status, userId, userName } = req.body;
  if (!queryId || !fileId || !userId || !status) {
    return res.status(400).json({ error: 'queryId, fileId, userId, and status are required' });
  }

  const updatedFile = db.updateFileReviewStatus(queryId, fileId, userId, userName, status);
  if (!updatedFile) {
    return res.status(404).json({ error: 'File or query not found' });
  }

  res.json({ success: true, file: updatedFile });
});

// Add comment or flag to a code file (Shared state)
app.post('/api/comments', (req, res) => {
  const { queryId, fileId, comment } = req.body;
  if (!queryId || !fileId || !comment || !comment.text) {
    return res.status(400).json({ error: 'queryId, fileId, and comment text are required' });
  }

  const result = db.addComment(queryId, fileId, comment);
  if (!result) {
    return res.status(404).json({ error: 'File or query not found' });
  }

  res.json({
    success: true,
    file: result.file,
    comment: result.comment
  });
});

// Remove reviewer's flag on a file (Shared state)
app.delete('/api/queries/:queryId/files/:fileId/flags', (req, res) => {
  const { queryId, fileId } = req.params;
  const userId = req.headers['x-user-id'] || req.query.userId || req.body?.userId;
  if (!userId) {
    return res.status(400).json({ error: 'x-user-id header is required' });
  }

  const file = db.removeUserFlag(queryId, fileId, userId);
  res.json({ success: true, file });
});

// Submit / Record individual reviewer verdict (Shared state)
app.post('/api/verdict', (req, res) => {
  const { queryId, verdict } = req.body;
  if (!queryId || !verdict || !verdict.userId || !verdict.verdict) {
    return res.status(400).json({ error: 'queryId and valid verdict payload are required' });
  }

  const verdicts = db.recordVerdict(queryId, verdict);
  res.json({ success: true, verdicts });
});

// Reset database to initial clean state
app.post('/api/reset', (req, res) => {
  db.resetDatabase();
  res.json({ success: true, message: 'Database reset and re-seeded to initial clean state.' });
});

// Serve frontend static build if exists
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`[Server] PR Quest API & Review Server running on http://localhost:${PORT}`);
});
