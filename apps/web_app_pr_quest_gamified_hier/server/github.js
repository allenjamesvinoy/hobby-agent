/**
 * GitHub public API helpers for fetching open PRs, PR file diffs,
 * and PR-head repository context docs (ARCHITECTURE / CONTEXT / PRODUCT).
 */

import { 
  synthesizeCriteria, 
  synthesizeStandards, 
  synthesizeTestSuites, 
  synthesizeArchitectureDiagram,
  extractMarkdownChecklist 
} from './heuristicSynthesizer.js';
import { chunkLargeFiles } from './locChunker.js';
import { findLocalGitRepo, resolveLocalGitBranch, resolveCommit, readGit, readGitDocument } from './localGit.js';
export { findLocalGitRepo, resolveLocalGitBranch } from './localGit.js';
import { db } from './db.js';
import { buildSymbolCatalogFromFiles } from '../src/utils/buildSymbolCatalog.js';

const GITHUB_API = 'https://api.github.com';
const MAX_CRITERIA = 8;
const MAX_STANDARDS = 8;

/** Candidate paths per logical role, ordered by preference. */
const DOC_CANDIDATES = {
  architecture: [
    'ARCHITECTURE.md',
    'architecture.md',
    'Architecture.md',
    'docs/ARCHITECTURE.md',
    'docs/architecture.md',
    'docs/Architecture.md'
  ],
  context: [
    'CONTEXT.md',
    'context.md',
    'Context.md',
    'docs/CONTEXT.md',
    'docs/context.md',
    'docs/Context.md'
  ],
  product: [
    'PRODUCT.md',
    'product.md',
    'Product.md',
    'docs/PRODUCT.md',
    'docs/product.md',
    'docs/Product.md'
  ]
};

/**
 * Parse owner/repo from common GitHub URL shapes or "owner/repo".
 * @param {string} input
 * @returns {{ owner: string, repo: string } | null}
 */
export function parseRepoInput(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim().replace(/\/+$/, '');

  // owner/repo
  const short = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/);
  if (short && !trimmed.includes('://') && !trimmed.includes('github.com')) {
    return { owner: short[1], repo: short[2] };
  }

  try {
    const withProtocol = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    const url = new URL(withProtocol);
    if (!url.hostname.includes('github.com')) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return {
      owner: parts[0],
      repo: parts[1].replace(/\.git$/, '')
    };
  } catch (_) {
    return null;
  }
}

function resolveAccessToken(accessToken) {
  return accessToken || db.getSetting?.('github_token') || process.env.GITHUB_TOKEN || null;
}

function githubHeaders(accessToken) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'PR-Quest-Hackathon',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  const token = resolveAccessToken(accessToken);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function githubFetch(path, accessToken) {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: githubHeaders(accessToken), signal: AbortSignal.timeout(10000) });
  const remaining = res.headers.get('x-ratelimit-remaining');
  if (!res.ok) {
    let message = `GitHub API error (${res.status})`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch (_) {}
    const err = new Error(message);
    err.status = res.status;
    err.rateLimitRemaining = remaining;
    throw err;
  }
  return res.json();
}

async function githubFetchOptional(path, accessToken) {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: githubHeaders(accessToken), signal: AbortSignal.timeout(10000) });
  if (res.status === 404) return null;
  if (!res.ok) {
    let message = `GitHub API error (${res.status})`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch (_) {}
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function githubPost(path, body, accessToken) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    method: 'POST',
    headers: {
      ...githubHeaders(accessToken),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    let message = `GitHub API error (${res.status})`;
    try {
      const data = await res.json();
      if (data?.message) message = data.message;
      if (Array.isArray(data?.errors) && data.errors.length) {
        message += `: ${data.errors.map((e) => e.message || JSON.stringify(e)).join('; ')}`;
      }
    } catch (_) {}
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/**
 * Parse GH-owner/repo#n query ids used by the app for GitHub PRs.
 * @returns {{ owner: string, repo: string, number: number } | null}
 */
export function parseGithubQueryId(queryId) {
  if (!queryId || typeof queryId !== 'string') return null;
  const match = queryId.match(/^GH-([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)#(\d+)$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2], number: Number(match[3]) };
}

/**
 * List open pull requests for a repo (paginates up to 100).
 * Uses linked-user token when provided; otherwise public/unauthenticated (or GITHUB_TOKEN).
 */
export function listLocalGitPullRequests(owner = 'allenjamesvinoy', repo = 'hobby-agent') {
  const repoDir = findLocalGitRepo(owner, repo);
  if (!repoDir) return [];

  try {
    const branchesRaw = readGit(repoDir, ['branch', '-a']);
    const lines = branchesRaw.split('\n').map(l => l.trim().replace(/^[* ]\s*/, '')).filter(Boolean);
    const prs = [];
    const seenNumbers = new Set();

    for (const b of lines) {
      if (b.includes('->') || b.includes('feat/') || b === 'main' || b === 'remotes/origin/main') continue;

      let prNumber = null;
      let head = b.replace(/^remotes\/origin\//, '');
      let title = '';

      const prMatch = head.match(/^pr-(\d+)$/i);
      const ideaMatch = head.match(/^idea-issue-(\d+)(?:-.*)?$/i);

      if (prMatch) {
        prNumber = parseInt(prMatch[1], 10);
      }

      if (!prNumber || seenNumbers.has(prNumber)) continue;
      seenNumbers.add(prNumber);

      try {
        const commitSubject = readGit(repoDir, ['log', '-n', '1', '--format=%s', b]).trim();
        title = commitSubject.replace(/^feat:\s*autonomous implementation for\s*['"]?|['"]?$/gi, '').trim() || (`PR #${prNumber}`);
        if (ideaMatch) {
          title = `🤖 [Agent PR] ${title}`;
        }
      } catch (_) {
        title = `PR #${prNumber}`;
      }

      prs.push({
        number: prNumber,
        title,
        body: '',
        htmlUrl: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
        user: ideaMatch ? 'github-actions[bot]' : 'local-git',
        avatarUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        draft: false,
        labels: ['local-git-synced'],
        base: 'main',
        head,
        additions: null,
        deletions: null,
        changedFiles: null,
        queryId: `GH-${owner}/${repo}#${prNumber}`,
        owner,
        repo,
        isLocalFallback: true
      });
    }

    // Reuse recorded GitHub PR-to-branch mappings when remote listing is unavailable.
    for (const summary of db.listQueries()) {
      const match = summary.query_id.match(/^GH-([^/]+)\/([^#]+)#(\d+)$/);
      if (!match || match[1].toLowerCase() !== owner.toLowerCase() || match[2].toLowerCase() !== repo.toLowerCase()) continue;
      const number = Number(match[3]);
      if (seenNumbers.has(number)) continue;
      const saved = db.getQuery('reviewer_1', summary.query_id);
      const meta = saved?.meta?.githubMeta || saved?.meta || {};
      if (!meta.head || !resolveLocalGitBranch(repoDir, number, meta.head)) continue;
      prs.push({ number, title: summary.title, queryId: summary.query_id, owner, repo,
        head: meta.head, base: meta.base || 'main', isLocalFallback: true,
        labels: ['local-git-synced'], htmlUrl: `https://github.com/${owner}/${repo}/pull/${number}` });
    }
    return prs.sort((a, b) => b.number - a.number);
  } catch (err) {
    console.warn('[github-local] Failed to list local git PRs:', err.message);
    return [];
  }
}

/**
 * List open pull requests for a repo (paginates up to 100).
 * Uses linked-user token when provided; otherwise public/unauthenticated (or GITHUB_TOKEN).
 * Seamlessly falls back to local git branches when rate-limited.
 */
export async function listOpenPullRequests(owner, repo, accessToken) {
  try {
    const pulls = await githubFetch(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=open&per_page=100&sort=updated&direction=desc`,
      accessToken
    );

    return pulls.map((pr) => ({
      number: pr.number,
      title: pr.title,
      body: pr.body || '',
      htmlUrl: pr.html_url,
      user: pr.user?.login || 'unknown',
      avatarUrl: pr.user?.avatar_url || null,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      draft: Boolean(pr.draft),
      labels: (pr.labels || []).map((l) => l.name),
      base: pr.base?.ref || 'main',
      head: pr.head?.ref || '',
      additions: pr.additions ?? null,
      deletions: pr.deletions ?? null,
      changedFiles: pr.changed_files ?? null,
      queryId: `GH-${owner}/${repo}#${pr.number}`,
      owner,
      repo
    }));
  } catch (err) {
    console.warn(`[github] listOpenPullRequests remote call failed (${err.message}). Checking local git branches...`);
    const localPrs = listLocalGitPullRequests(owner, repo);
    if (localPrs.length > 0) {
      console.log(`[github] Successfully fell back to ${localPrs.length} local git PR branches.`);
      return localPrs;
    }
    throw err;
  }
}

/**
 * Parse a unified diff patch into app diffChunks format.
 */
export function parsePatchToChunks(patch) {
  if (!patch || typeof patch !== 'string') {
    return [{
      header: '@@ (binary or empty diff) @@',
      lines: [{ type: 'normal', content: '(No textual diff available for this file)' }]
    }];
  }

  const chunks = [];
  let current = null;

  for (const rawLine of patch.split('\n')) {
    if (rawLine.startsWith('@@')) {
      if (current) chunks.push(current);
      current = { header: rawLine, lines: [] };
      continue;
    }
    if (!current) {
      current = { header: '@@ patch @@', lines: [] };
    }
    if (rawLine.startsWith('+') && !rawLine.startsWith('+++')) {
      current.lines.push({ type: 'add', content: rawLine.slice(1) });
    } else if (rawLine.startsWith('-') && !rawLine.startsWith('---')) {
      current.lines.push({ type: 'delete', content: rawLine.slice(1) });
    } else if (rawLine.startsWith('\\')) {
      // "\ No newline at end of file"
      continue;
    } else {
      const content = rawLine.startsWith(' ') ? rawLine.slice(1) : rawLine;
      current.lines.push({ type: 'normal', content });
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [{
    header: '@@ patch @@',
    lines: [{ type: 'normal', content: '(Empty patch)' }]
  }];
}

function inferTier(filename, additions = 0, deletions = 0) {
  const lower = filename.toLowerCase();
  if (lower.includes('test') || lower.includes('spec') || lower.includes('__tests__')) {
    return 'Tier 3: Tests';
  }
  if (
    lower.includes('component') ||
    lower.includes('page') ||
    lower.includes('view') ||
    lower.includes('ui/') ||
    lower.endsWith('.css') ||
    lower.endsWith('.scss')
  ) {
    return 'Tier 2: Consumer';
  }
  const churn = (additions || 0) + (deletions || 0);
  if (churn >= 40 || lower.includes('service') || lower.includes('core') || lower.includes('auth')) {
    return 'Tier 1: Core Logic';
  }
  return 'Tier 2: Consumer';
}

function inferImportance(filename, additions = 0, deletions = 0) {
  const churn = (additions || 0) + (deletions || 0);
  let score = 50 + Math.min(40, Math.floor(churn / 2));
  const lower = filename.toLowerCase();
  if (lower.includes('auth') || lower.includes('security') || lower.includes('session')) score += 10;
  if (lower.includes('test') || lower.includes('spec')) score -= 15;
  return Math.max(20, Math.min(98, score));
}

function decodeContentFile(fileJson) {
  if (!fileJson || fileJson.type !== 'file' || !fileJson.content) return null;
  try {
    const raw = Buffer.from(fileJson.content.replace(/\n/g, ''), 'base64').toString('utf8');
    return raw;
  } catch (_) {
    return null;
  }
}

/**
 * Fetch first existing candidate for a role at a given commit SHA.
 */
async function fetchDocForRole(owner, repo, role, candidates, refSha, changedPathSet, accessToken) {
  const results = await Promise.all(candidates.map(async (path) => {
    const data = await githubFetchOptional(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(refSha)}`,
      accessToken
    );
    const content = data && decodeContentFile(data);
    return content?.trim() ? { role, path: data.path || path, content: content.trim(),
      changedInPr: changedPathSet.has((data.path || path).toLowerCase()) } : null;
  }));
  return results.find(Boolean) || null;
}

/**
 * Discover ARCHITECTURE / CONTEXT / PRODUCT docs at PR head.
 * README.md is used only as a secondary architecture fallback.
 */
export async function fetchRepoDocsAtHead(owner, repo, headSha, changedFiles = [], accessToken) {
  const changedPathSet = new Set(
    (changedFiles || []).map((f) => String(f.filename || f.path || '').toLowerCase()).filter(Boolean)
  );

  // Only context and product docs are discovered automatically; architecture requires explicit user upload
  const roles = ['context', 'product'];
  const results = await Promise.all(
    roles.map((role) => fetchDocForRole(owner, repo, role, DOC_CANDIDATES[role], headSha, changedPathSet, accessToken))
  );

  const repoDocs = results.filter(Boolean);

  // Secondary: README as readme doc (not architecture)
  if (!repoDocs.some((d) => d.role === 'readme')) {
    const readme = await fetchDocForRole(
      owner,
      repo,
      'readme',
      ['README.md', 'readme.md', 'docs/README.md'],
      headSha,
      changedPathSet,
      accessToken
    );
    if (readme) {
      repoDocs.push({ ...readme, role: 'readme', path: readme.path });
    }
  }

  return repoDocs;
}

function stripMdNoise(text) {
  return text
    .replace(/^[-*+]\s+(\[[ xX]\]\s*)?/, '')
    .replace(/^\d+[\.\)]\s+/, '')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .trim();
}

function isUsefulBullet(text) {
  if (!text) return false;
  if (text.length < 12 || text.length > 220) return false;
  if (/^https?:\/\//i.test(text)) return false;
  if (/^#{1,6}\s/.test(text)) return false;
  return true;
}

/**
 * Extract checklist / bullet / numbered items from markdown.
 * When sectionHints provided, prefer lines under matching headings.
 */
export function extractMarkdownItems(markdown, { sectionHints = [], limit = MAX_CRITERIA } = {}) {
  if (!markdown || typeof markdown !== 'string') return [];

  const lines = markdown.split('\n');
  const items = [];
  let inPreferredSection = sectionHints.length === 0;
  const hintRe = sectionHints.length
    ? new RegExp(sectionHints.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i')
    : null;

  for (const raw of lines) {
    const line = raw.trim();
    if (/^#{1,6}\s+/.test(line)) {
      if (hintRe) {
        inPreferredSection = hintRe.test(line);
      }
      continue;
    }
    if (!inPreferredSection && hintRe) continue;

    const isChecklist = /^[-*+]\s+\[[ xX]\]\s+/.test(line);
    const isBullet = /^[-*+]\s+/.test(line);
    const isNumbered = /^\d+[\.\)]\s+/.test(line);
    if (!isChecklist && !isBullet && !isNumbered) continue;

    const text = stripMdNoise(line);
    if (!isUsefulBullet(text)) continue;
    if (items.some((i) => i.text.toLowerCase() === text.toLowerCase())) continue;

    items.push({
      text,
      completed: isChecklist ? /\[[xX]\]/.test(line) : false
    });
    if (items.length >= limit) break;
  }

  // If section filtering yielded nothing, retry without section filter
  if (items.length === 0 && sectionHints.length > 0) {
    return extractMarkdownItems(markdown, { sectionHints: [], limit });
  }

  return items;
}

export function buildCriteriaFromDocs(prTitle, bodyPreview, repoDocs) {
  const fromBody = bodyPreview
    ? bodyPreview
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => /^[-*]\s+\[[ xX]\]/.test(l) || /^[-*]\s+/.test(l))
        .slice(0, MAX_CRITERIA)
        .map((l, i) => ({
          id: `AC-${i + 1}`,
          text: stripMdNoise(l),
          completed: /\[[xX]\]/.test(l)
        }))
        .filter((c) => isUsefulBullet(c.text))
    : [];

  if (fromBody.length > 0) return fromBody;

  const byRole = Object.fromEntries(repoDocs.map((d) => [d.role, d]));
  const productItems = byRole.product
    ? extractMarkdownItems(byRole.product.content, {
        sectionHints: ['goal', 'requirement', 'acceptance', 'criteria', 'feature', 'scope', 'product'],
        limit: MAX_CRITERIA
      })
    : [];
  const contextItems = byRole.context
    ? extractMarkdownItems(byRole.context.content, {
        sectionHints: ['goal', 'requirement', 'acceptance', 'criteria', 'intent', 'context', 'overview'],
        limit: MAX_CRITERIA
      })
    : [];

  const merged = [...productItems];
  for (const item of contextItems) {
    if (merged.length >= MAX_CRITERIA) break;
    if (!merged.some((m) => m.text.toLowerCase() === item.text.toLowerCase())) {
      merged.push(item);
    }
  }

  if (merged.length > 0) {
    return merged.slice(0, MAX_CRITERIA).map((item, i) => ({
      id: `AC-${i + 1}`,
      text: item.text,
      completed: Boolean(item.completed)
    }));
  }

  return [
    { id: 'AC-1', text: `Review intent: ${prTitle}`, completed: false },
    { id: 'AC-2', text: 'Validate changed files for correctness and regressions', completed: false },
    { id: 'AC-3', text: 'Confirm tests / coverage for the touched paths', completed: false }
  ];
}

export function extractStandardsFromMarkdown(md, docPath = 'docs/architecture.md') {
  if (!md || typeof md !== 'string') return [];
  const standards = [];
  const lines = md.split('\n');
  let currentStd = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const headingMatch = line.match(/^#{1,4}\s+(STD-[\w\d]+|Standard\s+[\w\d]+|RULE-[\w\d]+)[:\s]+(.*)/i);
    if (headingMatch) {
      if (currentStd) standards.push(currentStd);
      currentStd = {
        id: headingMatch[1].toUpperCase(),
        standardFile: docPath,
        category: 'Architecture Standard',
        title: headingMatch[2].trim() || headingMatch[1],
        description: '',
        completed: false
      };
      continue;
    }

    if (currentStd) {
      if (/^#{1,3}\s+/.test(line)) {
        standards.push(currentStd);
        currentStd = null;
      } else if (line) {
        currentStd.description = (currentStd.description ? currentStd.description + ' ' : '') + line;
      }
    }
  }
  if (currentStd) standards.push(currentStd);
  return standards;
}

export function buildStandardsFromDocs(repoDocs) {
  const byRole = Object.fromEntries(repoDocs.map((d) => [d.role, d]));
  const arch = byRole.architecture;
  const context = byRole.context;

  if (arch && arch.content) {
    const extracted = extractStandardsFromMarkdown(arch.content, arch.path || 'docs/architecture.md');
    if (extracted.length > 0) {
      return extracted.slice(0, MAX_STANDARDS);
    }
  }

  let source = arch;
  let items = arch
    ? extractMarkdownItems(arch.content, {
        sectionHints: ['rule', 'agent', 'guideline', 'standard', 'contract', 'must', 'never', 'placement', 'architecture'],
        limit: MAX_STANDARDS
      })
    : [];

  if (items.length === 0 && context) {
    source = context;
    items = extractMarkdownItems(context.content, {
      sectionHints: ['rule', 'agent', 'guideline', 'standard', 'architecture'],
      limit: MAX_STANDARDS
    });
  }

  if (items.length > 0) {
    return items.map((item, i) => {
      const title = item.text.length > 72 ? `${item.text.slice(0, 69)}…` : item.text;
      return {
        id: `DOC-STD-${String(i + 1).padStart(2, '0')}`,
        standardFile: source?.path || 'ARCHITECTURE.md',
        category: arch ? 'Architecture Doc' : 'Context Doc',
        title,
        description: item.text,
        completed: false
      };
    });
  }

  if (arch || context || byRole.product) {
    const docPath = arch?.path || context?.path || byRole.product?.path || 'repo docs';
    return [
      {
        id: 'DOC-STD-01',
        standardFile: docPath,
        category: 'Architecture Doc',
        title: 'Changes respect documented architecture boundaries',
        description: `Review Tier 1 diffs against guidance in ${docPath}.`,
        completed: false
      },
      {
        id: 'DOC-STD-02',
        standardFile: docPath,
        category: 'Architecture Doc',
        title: 'No undocumented cross-layer coupling introduced',
        description: 'Flag new imports/calls that violate stated module boundaries or placement rules.',
        completed: false
      },
      {
        id: 'DOC-STD-03',
        standardFile: docPath,
        category: 'Architecture Doc',
        title: 'Core vs consumer responsibilities remain clear',
        description: 'Confirm UI/consumer code does not absorb core service responsibilities.',
        completed: false
      }
    ];
  }

  return [];
}

function buildArchitectureText(repoDocs) {
  const byRole = Object.fromEntries(repoDocs.map((d) => [d.role, d]));
  if (byRole.architecture?.content) return byRole.architecture.content;

  const parts = [];
  if (byRole.context?.content) {
    parts.push(`# Context\n\n${byRole.context.content}`);
  }
  if (byRole.product?.content) {
    parts.push(`# Product\n\n${byRole.product.content}`);
  }
  return parts.join('\n\n---\n\n');
}

/**
 * Fetch a GitHub Issue by number, extracting criteria and issue state.
 */
export async function fetchGithubIssue(owner, repo, issueNumber, accessToken) {
  try {
    const issue = await githubFetch(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${encodeURIComponent(issueNumber)}`,
      accessToken
    );
    const body = issue.body || '';
    const checklist = extractMarkdownChecklist(body);

    return {
      number: issue.number,
      title: issue.title,
      body,
      state: issue.state,
      htmlUrl: issue.html_url,
      labels: (issue.labels || []).map(l => (typeof l === 'string' ? l : l.name)),
      author: issue.user?.login || 'unknown',
      checklist
    };
  } catch (err) {
    console.warn(`[github] Failed to fetch issue #${issueNumber}:`, err.message);
    return null;
  }
}

export async function fetchPullRequestFromLocalGit(owner, repo, number, options = {}) {
  const repoDir = findLocalGitRepo(owner, repo);
  if (!repoDir) return null;

  const targetBranch = resolveLocalGitBranch(repoDir, number, options.head);
  if (!targetBranch) {
    console.warn(`[github-local] Could not resolve local git branch for PR #${number}`);
    return null;
  }

  const targetRef = resolveCommit(repoDir, targetBranch);
  const baseBranch = options.base || 'main';
  const baseRef = resolveCommit(repoDir, baseBranch);
  if (!targetRef || !baseRef) return null;

  const numstat = readGit(repoDir, ['diff', '--no-renames', '--numstat', '-z', `${baseRef}...${targetRef}`]);
  const rawFiles = [];
  for (const entry of numstat.split('\0').filter(Boolean)) {
    const match = entry.match(/^([^\t]+)\t([^\t]+)\t([\s\S]+)$/);
    if (!match) continue;
    const [, adds, dels, filename] = match;
    const patch = readGit(repoDir, ['diff', '--no-renames', '-u', `${baseRef}...${targetRef}`, '--', filename]);
    rawFiles.push({ filename, path: filename, status: 'modified', additions: parseInt(adds, 10) || 0, deletions: parseInt(dels, 10) || 0, patch });
  }

  // Commit info
  let commitTitle = '';
  let commitBody = '';
  let commitAuthor = 'github-actions[bot]';
  try {
    commitTitle = readGit(repoDir, ['log', '-n', '1', '--format=%s', targetRef]).trim();
    commitBody = readGit(repoDir, ['log', '-n', '1', '--format=%b', targetRef]).trim();
    commitAuthor = readGit(repoDir, ['log', '-n', '1', '--format=%an', targetRef]).trim();
  } catch (_) {}

  const prTitle = options.title || commitTitle.replace(/^feat:\s*autonomous implementation for\s*['"]?|['"]?$/gi, '').trim() || `PR #${number}`;

  // Load diffs without waiting for optional AI enrichment (available via AI Populate).
  // Repo Docs: only issue specs and readmes; architecture must be uploaded in UI
  const repoDocs = [];

  const specCandidates = ['docs/simulated_issue_spec.md', 'docs/CONTEXT.md', 'CONTEXT.md', 'docs/PRODUCT.md', 'PRODUCT.md'];
  for (const rel of specCandidates) {
    const content = readGitDocument(repoDir, targetRef, rel);
    if (content) {
      repoDocs.push({ role: 'product', path: rel, content, changedInPr: rawFiles.some(f => f.path === rel) });
      break;
    }
  }
  const readme = readGitDocument(repoDir, targetRef, 'README.md');
  if (readme) repoDocs.push({ role: 'readme', path: 'README.md', content: readme, changedInPr: false });

  const specDoc = repoDocs.find(d => d.path.includes('simulated_issue_spec') || d.role === 'product');
  const archDoc = repoDocs.find(d => d.role === 'architecture');
  const hasArchitectureDoc = Boolean(archDoc && archDoc.content && archDoc.content.trim());

  const issueBody = specDoc ? specDoc.content : commitBody;
  const synthCriteria = synthesizeCriteria({
    prTitle,
    prBody: commitBody || issueBody || '',
    issueBody: issueBody || '',
    files: rawFiles
  });

  const criteria = synthCriteria.criteria;
  const fileSpecTags = synthCriteria.fileSpecTags || {};

  const mappedFiles = rawFiles.map((f, idx) => ({
    id: `gh-${number}-file-${idx + 1}`,
    path: f.filename,
    tier: inferTier(f.filename, f.additions, f.deletions),
    importance: inferImportance(f.filename, f.additions, f.deletions),
    specTag: fileSpecTags[f.filename] || 'ALL',
    status: 'pending',
    comments: [],
    status_github: f.status,
    additions: f.additions,
    deletions: f.deletions,
    diffChunks: parsePatchToChunks(f.patch)
  }));

  // Architecture standards and diagram are empty for GitHub PRs until user uploads architecture.md
  const standards = [];
  const architectureText = '';
  const testSuites = synthesizeTestSuites(rawFiles, prTitle);
  const architectureDiagramModel = null;

  const chunkedFiles = chunkLargeFiles(mappedFiles, 200);
  const derivedCatalog = buildSymbolCatalogFromFiles(chunkedFiles);
  const symbolCatalog = derivedCatalog.catalog;

  const linkedIssueNumber = Number(targetBranch.match(/(?:^|\/)idea-issue-(\d+)(?:-|$)/)?.[1]) || null;
  const linkedIssue = linkedIssueNumber ? {
    number: linkedIssueNumber,
    title: prTitle,
    description: issueBody || `Local specification for Issue #${linkedIssueNumber}`,
    author: commitAuthor
  } : null;

  return {
    queryId: `GH-${owner}/${repo}#${number}`,
    title: `PR #${number}: ${prTitle}`,
    owner,
    repo,
    number,
    htmlUrl: `https://github.com/${owner}/${repo}/pull/${number}`,
    user: commitAuthor,
    jiraTicket: {
      id: linkedIssueNumber ? `#${linkedIssueNumber}` : `${owner}/${repo}#${number}`,
      title: prTitle,
      description: issueBody || `PR #${number} locally synchronized from ${targetBranch}`,
      criteria,
      linkedIssue
    },
    files: chunkedFiles,
    symbolCatalog,
    repoDocs,
    architectureText,
    standards,
    testSuites,
    architectureDiagramModel,
    fileSpecTags,
    isLocalFallback: true,
    meta: {
      draft: false,
      base: baseBranch,
      head: targetBranch,
      headSha: targetRef,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      additions: rawFiles.reduce((s, f) => s + (f.additions || 0), 0),
      deletions: rawFiles.reduce((s, f) => s + (f.deletions || 0), 0),
      changedFiles: rawFiles.length,
      linkedIssue,
      testSuites,
      architectureDiagramModel,
      symbolCatalog,
      fileSpecTags
    }
  };
}

/**
 * Fetch PR metadata + changed files with parsed diffs for the review workspace,
 * plus PR-head repo docs seeded into Level 1 / Level 2.
 * Transparently falls back to local git workspace on rate limits or API errors.
 */
export async function fetchPullRequestWorkspace(owner, repo, number, accessToken, options = {}) {
  let pr = null;
  let files = null;
  let fetchError = null;

  try {
    const [remotePr, remoteFiles] = await Promise.all([
      githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}`, accessToken),
      githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}/files?per_page=100`, accessToken)
    ]);
    pr = remotePr;
    files = remoteFiles;
  } catch (err) {
    fetchError = err;
    console.warn(`[github] GitHub API fetch failed for PR #${number} (${err.message}). Attempting local git fallback...`);
  }

  if (!pr || !files) {
    const localWorkspace = await fetchPullRequestFromLocalGit(owner, repo, number, options);
    if (localWorkspace) {
      console.log(`[github] Successfully loaded PR #${number} from local git workspace!`);
      return localWorkspace;
    }
    throw fetchError || new Error(`Failed to load PR #${number}`);
  }

  const headSha = pr.head?.sha;
  let repoDocs = [];
  if (headSha) {
    try {
      repoDocs = await fetchRepoDocsAtHead(owner, repo, headSha, files, accessToken);
    } catch (err) {
      console.warn('[github] repo docs fetch failed:', err.message);
      repoDocs = [];
    }
  }

  const bodyPreview = (pr.body || '').trim();

  // 1. Check for linked GitHub issue in PR body
  let linkedIssue = null;
  const issueMatch = bodyPreview.match(/(?:fixes|closes|resolves|issue|ref|refs|see)\s*[:#]?\s*(?:https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/)?(\d+)/i);
  if (issueMatch && issueMatch[1]) {
    linkedIssue = await fetchGithubIssue(owner, repo, issueMatch[1], accessToken);
  }

  // Normalize files so both path and filename are always defined
  const normalizedFiles = (files || []).map(f => ({
    ...f,
    path: f.path || f.filename || '',
    filename: f.filename || f.path || ''
  }));

  // 2. Synthesize criteria & file tags
  const synthCriteria = synthesizeCriteria({
    prTitle: pr.title,
    prBody: bodyPreview,
    issueBody: linkedIssue?.body || '',
    files: normalizedFiles
  });

  const criteria = synthCriteria.criteria;
  const fileSpecTags = synthCriteria.fileSpecTags || {};

  const mappedFiles = normalizedFiles.map((f, idx) => ({
    id: `gh-${number}-file-${idx + 1}`,
    path: f.path,
    filename: f.filename,
    tier: inferTier(f.path, f.additions, f.deletions),
    importance: inferImportance(f.path, f.additions, f.deletions),
    specTag: fileSpecTags[f.path] || fileSpecTags[f.filename] || 'ALL',
    status: 'pending',
    comments: [],
    status_github: f.status,
    additions: f.additions,
    deletions: f.deletions,
    diffChunks: parsePatchToChunks(f.patch)
  }));

  // 3. Architecture standards & text: for GitHub PRs, require explicit architecture.md upload
  const standards = [];
  const architectureText = '';
  const architectureDiagramModel = null;

  // 4. Test suites
  const testSuites = synthesizeTestSuites(normalizedFiles, pr.title);

  // 5. Break down files exceeding 200 lines into logical chunks
  const chunkedFiles = chunkLargeFiles(mappedFiles, 200);

  // 6. Level 3 Symbol Catalog with complete function bodies
  const derivedCatalog = buildSymbolCatalogFromFiles(chunkedFiles);
  const symbolCatalog = derivedCatalog.catalog;

  return {
    queryId: `GH-${owner}/${repo}#${pr.number}`,
    title: `PR #${pr.number}: ${pr.title}`,
    owner,
    repo,
    number: pr.number,
    htmlUrl: pr.html_url,
    user: pr.user?.login || 'unknown',
    jiraTicket: {
      id: linkedIssue ? `#${linkedIssue.number}` : `${owner}/${repo}#${pr.number}`,
      title: linkedIssue ? linkedIssue.title : pr.title,
      description: linkedIssue?.body || bodyPreview || `Open pull request #${pr.number} from ${pr.user?.login || 'unknown'} against ${pr.base?.ref || 'main'}.`,
      criteria,
      linkedIssue: linkedIssue ? {
        number: linkedIssue.number,
        title: linkedIssue.title,
        htmlUrl: linkedIssue.htmlUrl,
        author: linkedIssue.author
      } : null
    },
    files: chunkedFiles,
    symbolCatalog,
    repoDocs,
    architectureText,
    standards,
    testSuites,
    architectureDiagramModel,
    fileSpecTags,
    meta: {
      draft: Boolean(pr.draft),
      base: pr.base?.ref,
      head: pr.head?.ref,
      headSha: headSha || null,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
      linkedIssue: linkedIssue ? {
        number: linkedIssue.number,
        title: linkedIssue.title,
        htmlUrl: linkedIssue.htmlUrl,
        author: linkedIssue.author
      } : null,
      testSuites,
      architectureDiagramModel,
      symbolCatalog,
      fileSpecTags
    }
  };
}

/** OAuth authorize URL for browser redirect. */
export function buildOAuthAuthorizeUrl({ clientId, redirectUri, state, scope = 'read:user repo' }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/** Exchange OAuth code for access token. */
export async function exchangeOAuthCode({ clientId, clientSecret, code, redirectUri }) {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'PR-Quest-Hackathon'
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri
    })
  });
  const data = await res.json();
  if (!res.ok || data.error || !data.access_token) {
    const err = new Error(data.error_description || data.error || 'OAuth token exchange failed');
    err.status = 502;
    throw err;
  }
  return {
    accessToken: data.access_token,
    scope: data.scope || '',
    tokenType: data.token_type || 'bearer'
  };
}

/** Authenticated GitHub user for the given token. */
export async function getAuthenticatedUser(accessToken) {
  const user = await githubFetch('/user', accessToken);
  return {
    githubUserId: String(user.id),
    login: user.login,
    avatarUrl: user.avatar_url || null,
    name: user.name || user.login
  };
}

/**
 * List repos the linked user can access (owner / collaborator / org member).
 */
export async function listUserRepos(accessToken, { perPage = 100, maxPages = 3 } = {}) {
  const repos = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const batch = await githubFetch(
      `/user/repos?affiliation=owner,collaborator,organization_member&sort=updated&per_page=${perPage}&page=${page}`,
      accessToken
    );
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const r of batch) {
      repos.push({
        id: r.id,
        fullName: r.full_name,
        name: r.name,
        owner: r.owner?.login || r.full_name?.split('/')[0],
        private: Boolean(r.private),
        htmlUrl: r.html_url,
        description: r.description || '',
        language: r.language || null,
        updatedAt: r.updated_at,
        openIssues: r.open_issues_count ?? null,
        defaultBranch: r.default_branch || 'main'
      });
    }
    if (batch.length < perPage) break;
  }
  return repos;
}

/**
 * Create a PR review line comment when path + line are known; otherwise an issue comment.
 */
export async function postPullRequestComment({
  owner,
  repo,
  number,
  body,
  path,
  line,
  side = 'RIGHT',
  commitId,
  accessToken
}) {
  const text = body.startsWith('[PR Quest]') ? body : `[PR Quest] ${body}`;
  const hasLine = path && Number.isFinite(Number(line)) && Number(line) > 0 && commitId;

  if (hasLine) {
    const created = await githubPost(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}/comments`,
      {
        body: text,
        commit_id: commitId,
        path,
        line: Number(line),
        side: side === 'LEFT' ? 'LEFT' : 'RIGHT'
      },
      accessToken
    );
    return { kind: 'review_comment', id: created.id, htmlUrl: created.html_url };
  }

  const created = await githubPost(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${number}/comments`,
    { body: text },
    accessToken
  );
  return { kind: 'issue_comment', id: created.id, htmlUrl: created.html_url };
}

const VERDICT_TO_EVENT = {
  approved: 'APPROVE',
  changes_requested: 'REQUEST_CHANGES',
  comment: 'COMMENT'
};

/**
 * Submit a PR review from an in-app verdict.
 */
export async function submitPullRequestReview({
  owner,
  repo,
  number,
  verdict,
  notes,
  accessToken
}) {
  const event = VERDICT_TO_EVENT[verdict] || 'COMMENT';
  const body = (notes || '').trim() || `[PR Quest] Review verdict: ${verdict}`;
  const created = await githubPost(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}/reviews`,
    { event, body: body.startsWith('[PR Quest]') ? body : `[PR Quest] ${body}` },
    accessToken
  );
  return {
    id: created.id,
    htmlUrl: created.html_url,
    state: created.state,
    event
  };
}
