import { createHash } from 'node:crypto';
import { chunkLargeFiles } from '../src/utils/chunkLargeFiles.js';

export const POINTS_RULES = { maxPoints: 10, reviewMs: 30000, maxPulseGapMs: 5000, bonusPoints: 10, bonusWindowMs: 60000, overlapMs: 5000 };
const revisionOf = file => createHash('sha256').update(JSON.stringify([file.originalPath || file.path, file.diffChunks || []])).digest('hex');
const blocksOf = files => chunkLargeFiles(files || []).map(file => ({ ...file, revision: revisionOf(file) }));
const keyOf = (userId, file) => JSON.stringify([userId, file.id, file.revision]);
// Keep credit for manual approvals that the original rounding rule scored as zero.
// Legacy entries with positive observed time are known to be manual; bulk had zero time.
const earnedPoints = award => award.points === 0 && (award.bulk === false || award.activeMs > 0) ? 1 : award.points;
const empty = () => ({ sessions: {}, awards: {}, bonuses: [] });
const normalize = value => ({ ...empty(), ...value });
function extend(session, now) {
  if (!session || session.paused) return;
  const delta = now - session.lastAt;
  if (delta > 0 && delta <= POINTS_RULES.maxPulseGapMs) {
    const last = session.intervals.at(-1);
    if (last?.[1] === session.lastAt) last[1] = now;
    else session.intervals.push([session.lastAt, now]);
    session.activeMs = Math.min(POINTS_RULES.reviewMs, session.activeMs + delta);
    const cutoff = now - POINTS_RULES.reviewMs - POINTS_RULES.bonusWindowMs;
    session.intervals = session.intervals.filter(([, end]) => end > cutoff).map(([start, end]) => [Math.max(start, cutoff), end]);
  }
  session.lastAt = now;
}
function overlap(a, b) {
  return a.reduce((total, [start, end]) => total + b.reduce((sum, [otherStart, otherEnd]) => sum + Math.max(0, Math.min(end, otherEnd) - Math.max(start, otherStart)), 0), 0);
}

// Heartbeats accrue time for one visible block per reviewer, using server time only.
export function pulseReview(files, value, userId, fileId, now = Date.now()) {
  const state = structuredClone(normalize(value));
  const file = blocksOf(files).find(file => file.id === fileId);
  const previous = state.sessions[userId];
  if (!file) { if (previous) previous.paused = true; return state; }
  const key = keyOf(userId, file);
  if (previous?.key === key) {
    extend(previous, now);
    previous.paused = false;
    previous.lastAt = now;
  }
  else state.sessions[userId] = { key, fileId, revision: file.revision, activeMs: 0, lastAt: now, intervals: [] };
  return state;
}

// Re-approving restores the same award; it cannot increase it. Bulk approval earns zero.
export function recordApproval(files, value, userId, fileId, { bulk = false, now = Date.now() } = {}) {
  const state = structuredClone(normalize(value));
  const file = blocksOf(files).find(file => file.id === fileId);
  if (!file) return state;
  const key = keyOf(userId, file);
  if (state.awards[key]) return state;
  const session = state.sessions[userId];
  if (session?.key === key) extend(session, now);
  const activeMs = !bulk && session?.key === key ? session.activeMs : 0;
  const award = { key, userId, fileId, revision: file.revision, points: bulk ? 0 : Math.max(1, Math.floor(POINTS_RULES.maxPoints * activeMs / POINTS_RULES.reviewMs)), bulk, activeMs, at: now, intervals: activeMs ? session.intervals : [] };
  state.awards[key] = award;
  delete state.sessions[userId];
  if (award.points === POINTS_RULES.maxPoints) {
    const used = new Set(state.bonuses.flatMap(bonus => bonus.keys));
    const current = new Map(blocksOf(files).map(block => [block.id, block]));
    const partner = Object.values(state.awards).find(other => {
      const block = current.get(other.fileId);
      return other.key !== key && other.userId !== userId && other.fileId !== fileId && !used.has(other.key)
        && other.points === POINTS_RULES.maxPoints && now >= other.at && now - other.at <= POINTS_RULES.bonusWindowMs
        && block?.revision === other.revision && block.reviewerStatuses?.[other.userId]?.status === 'approved'
        && overlap(award.intervals, other.intervals) >= POINTS_RULES.overlapMs;
    });
    if (partner) state.bonuses.push({ keys: [partner.key, key], points: POINTS_RULES.bonusPoints });
  }
  return state;
}

export function pointsSnapshot(files, value, userId) {
  const state = normalize(value);
  const current = new Map(blocksOf(files).map(file => [file.id, file]));
  const awards = Object.values(state.awards).filter(award => {
    const file = current.get(award.fileId);
    return file?.revision === award.revision && file.reviewerStatuses?.[award.userId]?.status === 'approved';
  });
  const keys = new Set(awards.map(award => award.key));
  const bonus = state.bonuses.filter(bonus => bonus.keys.every(key => keys.has(key))).reduce((sum, bonus) => sum + bonus.points, 0);
  return { teamPoints: awards.reduce((sum, award) => sum + earnedPoints(award), 0) + bonus,
    myPoints: awards.filter(award => award.userId === userId).reduce((sum, award) => sum + earnedPoints(award), 0), bonusPoints: bonus };
}

export function createReviewPointsStore(db) {
  const read = queryId => { try { return JSON.parse(db.getSetting(`review_points:${queryId}`) || '{}'); } catch (_) { return {}; } };
  const save = (queryId, value) => { if (!db.setSetting(`review_points:${queryId}`, JSON.stringify(value))) throw new Error('Points could not be saved'); };
  return { read, save,
    approve(queryId, files, userId, fileId, options) { const state = recordApproval(files, read(queryId), userId, fileId, options); save(queryId, state); return pointsSnapshot(files, state, userId); }
  };
}

export function registerReviewPointsRoutes(app, db, resolveUserId, store) {
  app.get('/api/review-points', (req, res) => {
    const userId = resolveUserId(req), queryId = req.query.query;
    const query = db.getQuery(userId, queryId);
    if (!query) return res.status(404).json({ error: 'PR not loaded' });
    res.json(pointsSnapshot(query.files, store.read(queryId), userId));
  });
  app.post('/api/review-points/pulse', (req, res) => {
    try {
      const userId = resolveUserId(req), { queryId, fileId } = req.body;
      if (!db.getUserById(userId)) return res.status(401).end();
      const query = db.getQuery(userId, queryId);
      if (!query) return res.status(404).end();
      const state = pulseReview(query.files, store.read(queryId), userId, fileId);
      store.save(queryId, state);
      res.json(pointsSnapshot(query.files, state, userId));
    } catch (_) { res.status(503).json({ error: 'Points temporarily unavailable' }); }
  });
}
