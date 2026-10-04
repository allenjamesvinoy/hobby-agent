import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db, PRESET_USERS } from './db.js';
import {
  parseRepoInput,
  parseGithubQueryId,
  listOpenPullRequests,
  fetchPullRequestWorkspace,
  fetchGithubIssue,
  buildOAuthAuthorizeUrl,
  exchangeOAuthCode,
  getAuthenticatedUser,
  listUserRepos,
  postPullRequestComment,
  submitPullRequestReview
} from './github.js';
import {
  analyzeArchitectureDiff,
  structureIssueCriteria,
  deriveSymbolsAndTests,
  resolveGeminiApiKey
} from './gemini.js';
import {
  synthesizeCriteria,
  synthesizeStandards,
  synthesizeArchitectureDiagram,
  synthesizeTestSuites
} from './heuristicSynthesizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');

/** Lightweight .env loader (no external dotenv dependency needed). */
function loadEnvFile() {
  try {
    const envPath = path.resolve(__dirname, '../.env');
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (_) {}
}
loadEnvFile();

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5174';
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const GITHUB_OAUTH_CALLBACK =
  process.env.GITHUB_OAUTH_CALLBACK || `http://localhost:${PORT}/api/github/oauth/callback`;

/** In-memory OAuth state -> userId mapping (expires after 15 min). */
const oauthStates = new Map();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

function resolveUserId(req) {
  const authHeader = req.headers.authorization;
  return (
    req.headers['x-user-id'] ||
    req.query.userId ||
    req.body?.userId ||
    (authHeader ? authHeader.replace(/^Bearer\s+/i, '').split('_')[1] : null) ||
    'reviewer_1'
  );
}

function getLinkedToken(userId) {
  if (!userId) return null;
  const link = db.getGithubLink(userId);
  return link?.accessToken || null;
}

function publicGithubStatus(link) {
  if (!link) return { linked: false, login: null, avatarUrl: null };
  return { linked: true, login: link.login, avatarUrl: link.avatarUrl || null };
}

async function maybeWritebackComment(queryId, userId, comment, filePath) {
  const parsed = parseGithubQueryId(queryId);
  if (!parsed) return { attempted: false, synced: false, reason: 'not_github_query' };

  if ((comment.type || 'note') === 'approval') {
    return { attempted: false, synced: false, reason: 'local_file_approval' };
  }

  const token = getLinkedToken(userId);
  if (!token) return { attempted: false, synced: false, reason: 'github_not_linked' };

  try {
    const queryRecord = db.getQuery(userId, queryId);
    const headSha =
      queryRecord?.meta?.headSha ||
      queryRecord?.githubMeta?.headSha ||
      null;
    const line = comment.line ?? comment.startLine ?? null;
    const path = comment.path || filePath || null;
    const result = await postPullRequestComment({
      owner: parsed.owner,
      repo: parsed.repo,
      number: parsed.number,
      body: `[${comment.type || 'note'}] ${comment.text}`,
      path,
      line,
      side: comment.side || 'RIGHT',
      commitId: headSha,
      accessToken: token
    });
    return { attempted: true, synced: true, ...result };
  } catch (err) {
    console.warn('[github] comment writeback failed:', err.message);
    return { attempted: true, synced: false, error: err.message };
  }
}

async function maybeWritebackVerdict(queryId, userId, verdictEntry) {
  const parsed = parseGithubQueryId(queryId);
  if (!parsed) return { attempted: false, synced: false, reason: 'not_github_query' };
  const token = getLinkedToken(userId);
  if (!token) return { attempted: false, synced: false, reason: 'github_not_linked' };

  try {
    const result = await submitPullRequestReview({
      owner: parsed.owner,
      repo: parsed.repo,
      number: parsed.number,
      verdict: verdictEntry.verdict,
      notes: verdictEntry.notes,
      accessToken: token
    });
    return { attempted: true, synced: true, ...result };
  } catch (err) {
    console.warn('[github] review writeback failed:', err.message);
    return { attempted: true, synced: false, error: err.message };
  }
}

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- GitHub OAuth & Link Endpoints ---
app.get('/api/github/oauth/start', (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Sign in to the app before linking GitHub' });
  }
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    return res.status(503).json({
      error: 'GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env.'
    });
  }

  const state = crypto.randomBytes(24).toString('hex');
  oauthStates.set(state, { userId, createdAt: Date.now() });
  for (const [key, value] of oauthStates.entries()) {
    if (Date.now() - value.createdAt > 15 * 60 * 1000) oauthStates.delete(key);
  }

  const url = buildOAuthAuthorizeUrl({
    clientId: GITHUB_CLIENT_ID,
    redirectUri: GITHUB_OAUTH_CALLBACK,
    state,
    scope: 'read:user repo'
  });
  return res.redirect(url);
});

app.get('/api/github/oauth/callback', async (req, res) => {
  const { code, state, error, error_description: errorDescription } = req.query;
  const frontendFail = `${FRONTEND_ORIGIN}/?github=error`;
  const frontendOk = `${FRONTEND_ORIGIN}/?github=linked`;

  if (error) {
    return res.redirect(`${frontendFail}&message=${encodeURIComponent(errorDescription || error)}`);
  }

  const pending = state ? oauthStates.get(String(state)) : null;
  if (!pending) {
    return res.redirect(`${frontendFail}&message=${encodeURIComponent('Invalid or expired OAuth state')}`);
  }
  oauthStates.delete(String(state));

  if (!code) {
    return res.redirect(`${frontendFail}&message=${encodeURIComponent('Missing OAuth code')}`);
  }

  try {
    const { accessToken } = await exchangeOAuthCode({
      clientId: GITHUB_CLIENT_ID,
      clientSecret: GITHUB_CLIENT_SECRET,
      code: String(code),
      redirectUri: GITHUB_OAUTH_CALLBACK
    });
    const ghUser = await getAuthenticatedUser(accessToken);
    db.upsertGithubLink(pending.userId, {
      githubUserId: ghUser.githubUserId,
      login: ghUser.login,
      accessToken,
      avatarUrl: ghUser.avatarUrl
    });
    return res.redirect(frontendOk);
  } catch (err) {
    console.error('[github] OAuth callback failed:', err.message);
    return res.redirect(`${frontendFail}&message=${encodeURIComponent(err.message || 'OAuth failed')}`);
  }
});

app.get('/api/github/status', (req, res) => {
  const userId = resolveUserId(req);
  const oauthConfigured = Boolean(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET);
  if (!userId) {
    return res.json({
      linked: false,
      login: null,
      avatarUrl: null,
      configured: true,
      oauthConfigured,
      patLinking: true
    });
  }
  const link = db.getGithubLink(userId);
  return res.json({
    ...publicGithubStatus(link),
    configured: true,
    oauthConfigured,
    patLinking: true
  });
});

app.post('/api/github/link-token', async (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Sign in required' });
  }

  const raw = req.body?.token || req.body?.accessToken || '';
  const accessToken = String(raw).trim();
  if (!accessToken) {
    return res.status(400).json({ error: 'A GitHub personal access token is required' });
  }
  if (accessToken.length < 20) {
    return res.status(400).json({ error: 'Token looks too short. Paste a full GitHub PAT.' });
  }

  try {
    const ghUser = await getAuthenticatedUser(accessToken);
    db.upsertGithubLink(userId, {
      githubUserId: ghUser.githubUserId,
      login: ghUser.login,
      accessToken,
      avatarUrl: ghUser.avatarUrl
    });
    return res.json({
      success: true,
      linked: true,
      login: ghUser.login,
      avatarUrl: ghUser.avatarUrl || null,
      method: 'pat'
    });
  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 401;
    return res.status(status).json({
      error: err.message || 'Invalid GitHub token'
    });
  }
});

app.post('/api/github/unlink', (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Sign in required' });
  }
  db.deleteGithubLink(userId);
  return res.json({ success: true, linked: false });
});

app.get('/api/github/repos', async (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Sign in required' });
  }
  const token = getLinkedToken(userId);
  if (!token) {
    return res.status(401).json({ error: 'GitHub account not linked' });
  }
  try {
    const repos = await listUserRepos(token);
    res.json({ success: true, count: repos.length, repos });
  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
    res.status(status).json({ error: err.message || 'Failed to list repositories' });
  }
});

app.post('/api/github/open-prs', async (req, res) => {
  try {
    const repoInput = req.body?.repoUrl || req.body?.repo || '';
    const parsed = parseRepoInput(repoInput);
    if (!parsed) {
      return res.status(400).json({
        error: 'Invalid repository URL. Use https://github.com/owner/repo or owner/repo'
      });
    }

    const userId = resolveUserId(req);
    const accessToken = getLinkedToken(userId);
    const pullRequests = await listOpenPullRequests(parsed.owner, parsed.repo, accessToken);
    res.json({
      success: true,
      owner: parsed.owner,
      repo: parsed.repo,
      repoUrl: `https://github.com/${parsed.owner}/${parsed.repo}`,
      count: pullRequests.length,
      pullRequests,
      authenticated: Boolean(accessToken)
    });
  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
    res.status(status).json({
      error: err.message || 'Failed to fetch open pull requests',
      rateLimitRemaining: err.rateLimitRemaining ?? null
    });
  }
});

app.get('/api/github/pr/:owner/:repo/:number', async (req, res) => {
  try {
    const { owner, repo, number } = req.params;
    const prNumber = Number(number);
    if (!owner || !repo || !Number.isFinite(prNumber) || prNumber <= 0) {
      return res.status(400).json({ error: 'owner, repo, and a valid PR number are required' });
    }

    const userId = resolveUserId(req);
    const accessToken = getLinkedToken(userId);
    const workspace = await fetchPullRequestWorkspace(owner, repo, prNumber, accessToken);
    res.json({ success: true, ...workspace, authenticated: Boolean(accessToken) });
  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
    res.status(status).json({
      error: err.message || 'Failed to fetch pull request',
      rateLimitRemaining: err.rateLimitRemaining ?? null
    });
  }
});

// --- Gemini AI Status & Key Endpoints ---
app.get('/api/gemini/status', (req, res) => {
  const envKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  const dbKey = db.getSetting('gemini_api_key') || '';
  const configured = Boolean(envKey || dbKey);
  const source = envKey ? 'env' : dbKey ? 'database' : 'none';
  res.json({ configured, source });
});

app.post('/api/gemini/key', (req, res) => {
  const apiKey = (req.body?.apiKey || '').trim();
  if (!apiKey) {
    return res.status(400).json({ error: 'API key is required' });
  }
  db.setSetting('gemini_api_key', apiKey);
  res.json({ success: true, configured: true, source: 'database' });
});

// --- Link a GitHub Issue to Query (Level 1 Acceptance Criteria) ---
app.post('/api/github/link-issue', async (req, res) => {
  try {
    const { queryId, issueNumberOrUrl } = req.body || {};
    if (!queryId || !issueNumberOrUrl) {
      return res.status(400).json({ error: 'queryId and issueNumberOrUrl are required' });
    }

    const userId = resolveUserId(req);
    const accessToken = getLinkedToken(userId);

    let owner = '';
    let repo = '';
    let issueNumber = null;

    const urlMatch = String(issueNumberOrUrl).match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/i);
    if (urlMatch) {
      owner = urlMatch[1];
      repo = urlMatch[2];
      issueNumber = Number(urlMatch[3]);
    } else {
      const numMatch = String(issueNumberOrUrl).match(/#?(\d+)/);
      if (numMatch) {
        issueNumber = Number(numMatch[1]);
      }
      const qMatch = String(queryId).match(/^GH-([^/]+)\/([^#]+)#/);
      if (qMatch) {
        owner = qMatch[1];
        repo = qMatch[2];
      }
    }

    if (!owner || !repo || !issueNumber) {
      return res.status(400).json({ error: 'Could not resolve owner, repo, and issue number. Provide URL or #number' });
    }

    const issue = await fetchGithubIssue(owner, repo, issueNumber, accessToken);
    if (!issue) {
      return res.status(404).json({ error: `GitHub Issue #${issueNumber} not found in ${owner}/${repo}` });
    }

    const currentQuery = db.getQuery(userId, queryId);
    const files = currentQuery?.files || [];
    const meta = currentQuery?.meta || {};

    const geminiKey = resolveGeminiApiKey(null, db.getSetting('gemini_api_key'));
    let criteria = [];
    let fileSpecTags = {};

    if (geminiKey) {
      try {
        const geminiRes = await structureIssueCriteria({
          issueNumber: issue.number,
          issueTitle: issue.title,
          issueBody: issue.body,
          files,
          apiKey: geminiKey
        });
        if (Array.isArray(geminiRes?.criteria) && geminiRes.criteria.length > 0) {
          criteria = geminiRes.criteria;
          fileSpecTags = geminiRes.fileSpecTags || {};
        }
      } catch (geminiErr) {
        console.warn('[Gemini] structureIssueCriteria failed, falling back:', geminiErr.message);
      }
    }

    if (criteria.length === 0) {
      const synth = synthesizeCriteria({
        prTitle: currentQuery?.title || '',
        prBody: meta?.description || '',
        issueBody: issue.body,
        files
      });
      criteria = synth.criteria;
      fileSpecTags = synth.fileSpecTags || {};
    }

    const updatedFiles = files.map(f => ({
      ...f,
      specTag: fileSpecTags[f.path] || f.specTag || 'ALL'
    }));

    const nextJiraTicket = {
      id: `#${issue.number}`,
      title: issue.title,
      description: issue.body || `GitHub Issue #${issue.number}`,
      criteria,
      linkedIssue: {
        number: issue.number,
        title: issue.title,
        htmlUrl: issue.htmlUrl,
        author: issue.author
      }
    };

    const nextMeta = {
      ...meta,
      jiraTicket: nextJiraTicket,
      linkedIssue: nextJiraTicket.linkedIssue,
      fileSpecTags
    };

    db.saveQuery(queryId, currentQuery?.title, updatedFiles, currentQuery?.verdicts || [], nextMeta);

    res.json({
      success: true,
      jiraTicket: nextJiraTicket,
      files: updatedFiles,
      fileSpecTags
    });
  } catch (err) {
    console.error('[API] link-issue failed:', err);
    res.status(500).json({ error: err.message || 'Failed to link GitHub issue' });
  }
});

// --- Upload architecture.md & Run Gemini Architecture Diff Analysis (Level 2) ---
app.post('/api/architecture/upload', async (req, res) => {
  try {
    const { queryId, fileName = 'architecture.md', content = '' } = req.body || {};
    if (!queryId || !content.trim()) {
      return res.status(400).json({ error: 'queryId and file content are required' });
    }

    const userId = resolveUserId(req);
    const currentQuery = db.getQuery(userId, queryId);
    const files = currentQuery?.files || [];
    const meta = currentQuery?.meta || {};

    const prDiffs = files.map(f => ({
      path: f.path,
      patch: (f.diffChunks || []).map(c => (c.lines || []).map(l => l.text).join('\n')).join('\n')
    }));

    const geminiKey = resolveGeminiApiKey(null, db.getSetting('gemini_api_key'));
    let standards = [];
    let architectureDiff = null;
    let architectureSummary = '';

    if (geminiKey) {
      try {
        const geminiRes = await analyzeArchitectureDiff({
          architectureDoc: content,
          prDiffs,
          files,
          prTitle: currentQuery?.title || '',
          apiKey: geminiKey
        });

        if (geminiRes) {
          standards = geminiRes.standards || [];
          architectureDiff = {
            nodes: geminiRes.nodes || [],
            edges: geminiRes.edges || []
          };
          architectureSummary = geminiRes.summary || '';
        }
      } catch (geminiErr) {
        console.warn('[Gemini] analyzeArchitectureDiff failed, falling back:', geminiErr.message);
      }
    }

    if (standards.length === 0) {
      standards = synthesizeStandards(files);
      architectureDiff = synthesizeArchitectureDiagram(files, currentQuery?.title || '');
      architectureSummary = `# Architecture Analysis\n\nUploaded \`${fileName}\` analyzed against PR changes.`;
    }

    const prevDocs = currentQuery?.repoDocs || meta.repoDocs || [];
    const updatedDocs = [
      { role: 'architecture', path: fileName, content, changedInPr: false },
      ...prevDocs.filter(d => d.role !== 'architecture')
    ];

    const nextMeta = {
      ...meta,
      standards,
      architectureText: content,
      architectureSummary,
      architectureDiagramModel: architectureDiff,
      repoDocs: updatedDocs
    };

    db.saveQuery(queryId, currentQuery?.title, files, currentQuery?.verdicts || [], nextMeta);

    res.json({
      success: true,
      standards,
      architectureText: content,
      architectureSummary,
      diagramModel: architectureDiff,
      architectureDiagramModel: architectureDiff,
      repoDocs: updatedDocs
    });
  } catch (err) {
    console.error('[API] architecture/upload failed:', err);
    res.status(500).json({ error: err.message || 'Failed to upload architecture document' });
  }
});

// --- On-Demand Full Gemini AI Autopopulate for PR Query ---
app.post('/api/github/ai-populate', async (req, res) => {
  try {
    const { queryId } = req.body || {};
    if (!queryId) return res.status(400).json({ error: 'queryId is required' });

    const userId = resolveUserId(req);
    const currentQuery = db.getQuery(userId, queryId);
    if (!currentQuery) return res.status(404).json({ error: 'Query not found' });

    const files = currentQuery.files || [];
    const meta = currentQuery.meta || {};
    const geminiKey = resolveGeminiApiKey(null, db.getSetting('gemini_api_key'));

    if (!geminiKey) {
      return res.status(400).json({ error: 'Gemini API key is not configured' });
    }

    const prDiffs = files.map(f => ({
      path: f.path,
      patch: (f.diffChunks || []).map(c => (c.lines || []).map(l => l.text).join('\n')).join('\n')
    }));

    const archDoc = currentQuery.architectureText || (meta.repoDocs || []).find(d => d.role === 'architecture')?.content || '';

    const [archRes, symbolsAndTestsRes] = await Promise.allSettled([
      archDoc ? analyzeArchitectureDiff({
        architectureDoc: archDoc,
        prDiffs,
        files,
        prTitle: currentQuery.title,
        apiKey: geminiKey
      }) : Promise.resolve(null),
      deriveSymbolsAndTests({
        files,
        prTitle: currentQuery.title,
        prBody: meta.description || '',
        criteria: currentQuery.jiraTicket?.criteria || [],
        apiKey: geminiKey
      })
    ]);

    let standards = currentQuery.standards;
    let architectureDiff = meta.architectureDiagramModel;
    let architectureSummary = meta.architectureSummary;
    if (archRes.status === 'fulfilled' && archRes.value) {
      standards = archRes.value.standards || standards;
      architectureDiff = { nodes: archRes.value.nodes || [], edges: archRes.value.edges || [] };
      architectureSummary = archRes.value.summary || architectureSummary;
    }

    let symbolCatalog = meta.symbolCatalog || null;
    let testSuites = currentQuery.testSuites || meta.testSuites || null;
    if (symbolsAndTestsRes.status === 'fulfilled' && symbolsAndTestsRes.value) {
      symbolCatalog = symbolsAndTestsRes.value.symbolCatalog || symbolCatalog;
      testSuites = symbolsAndTestsRes.value.testSuites || testSuites;
    }

    const nextMeta = {
      ...meta,
      standards,
      architectureDiagramModel: architectureDiff,
      architectureSummary,
      symbolCatalog,
      testSuites
    };

    db.saveQuery(queryId, currentQuery.title, files, currentQuery.verdicts || [], nextMeta);

    res.json({
      success: true,
      standards,
      diagramModel: architectureDiff,
      symbolCatalog,
      testSuites,
      architectureSummary
    });
  } catch (err) {
    console.error('[API] ai-populate failed:', err);
    res.status(500).json({ error: err.message || 'AI population failed' });
  }
});

app.post('/api/github/comment', async (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: 'Sign in required' });
  const token = getLinkedToken(userId);
  if (!token) return res.status(401).json({ error: 'GitHub account not linked' });

  const { queryId, owner, repo, number, body, path: filePath, line, side, commitId } = req.body || {};
  const parsed = queryId ? parseGithubQueryId(queryId) : null;
  const target = {
    owner: owner || parsed?.owner,
    repo: repo || parsed?.repo,
    number: Number(number || parsed?.number)
  };
  if (!target.owner || !target.repo || !Number.isFinite(target.number) || !body) {
    return res.status(400).json({ error: 'owner/repo/number (or queryId) and body are required' });
  }

  try {
    let headSha = commitId || null;
    if (!headSha && queryId) {
      const q = db.getQuery(userId, queryId);
      headSha = q?.meta?.headSha || q?.githubMeta?.headSha || null;
    }
    const result = await postPullRequestComment({
      ...target,
      body,
      path: filePath,
      line,
      side,
      commitId: headSha,
      accessToken: token
    });
    res.json({ success: true, ...result });
  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
    res.status(status).json({ error: err.message || 'Failed to post GitHub comment' });
  }
});

app.post('/api/github/review', async (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: 'Sign in required' });
  const token = getLinkedToken(userId);
  if (!token) return res.status(401).json({ error: 'GitHub account not linked' });

  const { queryId, owner, repo, number, verdict, notes } = req.body || {};
  const parsed = queryId ? parseGithubQueryId(queryId) : null;
  const target = {
    owner: owner || parsed?.owner,
    repo: repo || parsed?.repo,
    number: Number(number || parsed?.number)
  };
  if (!target.owner || !target.repo || !Number.isFinite(target.number) || !verdict) {
    return res.status(400).json({ error: 'owner/repo/number (or queryId) and verdict are required' });
  }

  try {
    const result = await submitPullRequestReview({
      ...target,
      verdict,
      notes,
      accessToken: token
    });
    res.json({ success: true, ...result });
  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
    res.status(status).json({ error: err.message || 'Failed to submit GitHub review' });
  }
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
  const userId = resolveUserId(req);
  const user = db.getUserById(userId) || PRESET_USERS[0];
  res.json({ user });
});

// List queries with team approval & flag summaries
app.get('/api/queries', (req, res) => {
  const queries = db.listQueries();
  res.json(queries);
});

// Get state for a review query
app.get('/api/state', (req, res) => {
  const queryId = req.query.query || 'PR-101';
  const userId = resolveUserId(req);

  let queryRecord = db.getQuery(userId, queryId);

  // Auto-seed query if not yet existing (only for local non-GH queries)
  if (!queryRecord) {
    if (String(queryId).startsWith('GH-')) {
      return res.status(404).json({ error: 'GitHub query not found', queryId });
    }
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
    jiraTicket: queryRecord.jiraTicket,
    standards: queryRecord.standards,
    architectureText: queryRecord.architectureText,
    repoDocs: queryRecord.repoDocs,
    testSuites: queryRecord.testSuites || queryRecord.meta?.testSuites,
    architectureDiagramModel: queryRecord.architectureDiagramModel || queryRecord.meta?.architectureDiagramModel,
    symbolCatalog: queryRecord.symbolCatalog || queryRecord.meta?.symbolCatalog,
    architectureSummary: queryRecord.architectureSummary || queryRecord.meta?.architectureSummary,
    meta: queryRecord.meta,
    userProgress,
    updatedAt: queryRecord.updatedAt
  });
});

// Save review query state & user progress
app.post('/api/state', (req, res) => {
  const { queryId, title, files, verdicts, state, userProgress } = req.body;
  const userId = resolveUserId(req);
  if (!queryId) {
    return res.status(400).json({ error: 'queryId is required' });
  }

  if (state) {
    const queryTitle = title || state.title || `PR #${queryId}`;
    const queryFiles = state.files || [];
    const queryVerdicts = state.verdicts || [];
    const currentQuery = db.getQuery(userId, queryId);
    const prevMeta = currentQuery?.meta || {};
    const meta = {
      ...prevMeta,
      jiraTicket: state.jiraTicket ?? prevMeta.jiraTicket,
      standards: state.standards ?? prevMeta.standards,
      architectureText: state.architectureText ?? prevMeta.architectureText,
      repoDocs: state.repoDocs ?? prevMeta.repoDocs,
      testSuites: state.testSuites ?? prevMeta.testSuites,
      architectureDiagramModel: state.architectureDiagramModel ?? prevMeta.architectureDiagramModel,
      symbolCatalog: state.symbolCatalog ?? prevMeta.symbolCatalog,
      architectureSummary: state.architectureSummary ?? prevMeta.architectureSummary,
      githubMeta: state.githubMeta || state.meta || prevMeta.githubMeta
    };
    db.saveQuery(queryId, queryTitle, queryFiles, queryVerdicts, meta);
  } else if (files) {
    db.saveQuery(queryId, title, files, verdicts);
  }

  if (userId && userProgress) {
    db.saveUserProgress(userId, queryId, userProgress);
  }

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

// Add comment or flag to a code file (Shared state + GitHub writeback if GH- query)
app.post('/api/comments', async (req, res) => {
  const { queryId, fileId, comment } = req.body;
  if (!queryId || !fileId || !comment || !comment.text) {
    return res.status(400).json({ error: 'queryId, fileId, and comment text are required' });
  }

  const result = db.addComment(queryId, fileId, comment);
  if (!result) {
    return res.status(404).json({ error: 'File or query not found' });
  }

  const syncUserId = comment.authorId || resolveUserId(req);
  const githubSync = await maybeWritebackComment(queryId, syncUserId, result.comment, result.file?.path);

  res.json({
    success: true,
    file: result.file,
    comment: result.comment,
    githubSync
  });
});

// Remove reviewer's flag on a file (Shared state)
app.delete('/api/queries/:queryId/files/:fileId/flags', (req, res) => {
  const { queryId, fileId } = req.params;
  const userId = resolveUserId(req);
  if (!userId) {
    return res.status(400).json({ error: 'x-user-id header is required' });
  }

  const file = db.removeUserFlag(queryId, fileId, userId);
  res.json({ success: true, file });
});

// Submit / Record individual reviewer verdict (Shared state + GitHub review writeback)
app.post('/api/verdict', async (req, res) => {
  const { queryId, verdict } = req.body;
  if (!queryId || !verdict || !verdict.userId || !verdict.verdict) {
    return res.status(400).json({ error: 'queryId and valid verdict payload are required' });
  }

  const verdicts = db.recordVerdict(queryId, verdict);
  const targetVerdict = verdicts?.find(v => v.userId === verdict.userId) || verdict;

  const githubSync = await maybeWritebackVerdict(queryId, verdict.userId, targetVerdict);

  res.json({
    success: true,
    verdicts,
    submittedVerdict: targetVerdict,
    githubSync
  });
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
