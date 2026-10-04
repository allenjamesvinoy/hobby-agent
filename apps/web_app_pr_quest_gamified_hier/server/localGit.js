import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function readGit(repoDir, args) {
  return execFileSync('git', args, {
    cwd: repoDir, encoding: 'utf8', timeout: 15000, maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' }
  });
}

export function findLocalGitRepo(owner, repo, candidates = [
  process.cwd(), path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
]) {
  const expected = `${owner}/${repo}`.toLowerCase();
  for (const candidate of candidates) {
    try {
      const root = readGit(candidate, ['rev-parse', '--show-toplevel']).trim();
      const remotes = readGit(root, ['remote', '-v']).split('\n');
      if (remotes.some(line => {
        const url = line.split(/\s+/)[1] || '';
        const match = url.match(/^(?:https?:\/\/github\.com\/|(?:ssh:\/\/)?git@github\.com[:/])(.+?)(?:\.git)?$/i);
        return match?.[1].toLowerCase() === expected;
      })) return root;
    } catch (_) {}
  }
  return null;
}

export function resolveCommit(repoDir, branch) {
  if (!branch || branch.startsWith('-')) return null;
  for (const ref of [`refs/remotes/origin/${branch}`, `refs/heads/${branch}`, branch]) {
    try { return readGit(repoDir, ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]).trim(); } catch (_) {}
  }
  return null;
}

export function resolveLocalGitBranch(repoDir, number, head) {
  // Issue numbers do not identify PRs. Only use an explicit head or PR ref.
  const candidates = head ? [head] : [`refs/pull/${number}/head`, `pr-${number}`];
  return candidates.find(ref => resolveCommit(repoDir, ref)) || null;
}

export function readGitDocument(repoDir, commit, file) {
  try { return readGit(repoDir, ['show', `${commit}:${file}`]).trim(); } catch (_) { return ''; }
}
