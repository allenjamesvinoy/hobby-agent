import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mergeGithubWorkspace } from '../src/utils/mergeGithubWorkspace.js';
import { findLocalGitRepo, readGit, resolveCommit, resolveLocalGitBranch, readGitDocument } from '../server/localGit.js';

const file = (path, content) => ({ id: path, path, diffChunks: [{ lines: [{ type: 'add', content }] }] });
test('fresh changes replace stale files and keep reviews only on unchanged diffs', () => {
  const saved = { files: [
    { ...file('changed.js', 'old'), status: 'approved', comments: [{ text: 'review' }], reviewerStatuses: { a: { status: 'approved' } } },
    { ...file('same.js', 'same'), status: 'approved', reviewerStatuses: { a: { status: 'approved' } } },
    file('removed.js', 'removed')
  ], repoDocs: [{ path: 'architecture.md', uploaded: true, content: 'custom' }] };
  const result = mergeGithubWorkspace({ files: [file('changed.js', 'new'), file('same.js', 'same'), file('new.js', 'new')] }, saved);
  assert.deepEqual(result.files.map(f => f.path), ['changed.js', 'same.js', 'new.js']);
  assert.equal(result.files[0].diffChunks[0].lines[0].content, 'new');
  assert.equal(result.files[0].status, 'pending');
  assert.deepEqual(result.files[0].reviewerStatuses, {});
  assert.equal(result.files[0].comments[0].text, 'review');
  assert.equal(result.files[1].status, 'approved');
  assert.equal(result.repoDocs[0].content, 'custom');
});

test('progress belongs to the loaded PR revision', () => {
  const saved = { meta: { githubMeta: { headSha: 'old' } }, userProgress: { criteria: [{ id: 'AC1', completed: true }], auditedSymbols: ['oldSymbol'] } };
  const fresh = { meta: { headSha: 'new' }, jiraTicket: { criteria: [{ id: 'AC1', text: 'new criterion' }] } };
  assert.equal(mergeGithubWorkspace(fresh, saved).userProgress.criteria[0].completed, false);
  fresh.meta.headSha = 'old';
  assert.equal(mergeGithubWorkspace(fresh, saved).userProgress.criteria[0].completed, true);
});

test('local fallback uses exact repository and branch, and reads docs from the target commit', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-quest-git-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  readGit(dir, ['init', '-b', 'main']);
  readGit(dir, ['config', 'user.name', 'Test']);
  readGit(dir, ['config', 'user.email', 'test@example.invalid']);
  readGit(dir, ['remote', 'add', 'origin', 'git@github.com:owner/project.git']);
  fs.writeFileSync(path.join(dir, 'README.md'), 'base documentation');
  readGit(dir, ['add', '.']); readGit(dir, ['commit', '-m', 'base']);
  readGit(dir, ['checkout', '-b', 'idea-issue-56']);
  fs.writeFileSync(path.join(dir, 'README.md'), 'PR documentation');
  readGit(dir, ['add', '.']); readGit(dir, ['commit', '-m', 'PR']);
  const head = resolveCommit(dir, 'idea-issue-56');
  readGit(dir, ['checkout', 'main']);
  assert.equal(findLocalGitRepo('owner', 'project', [dir]), fs.realpathSync(dir));
  assert.equal(findLocalGitRepo('other', 'project', [dir]), null);
  assert.equal(resolveLocalGitBranch(dir, 57), null);
  assert.equal(resolveLocalGitBranch(dir, 5), null);
  assert.equal(resolveLocalGitBranch(dir, 57, 'idea-issue-56'), 'idea-issue-56');
  assert.equal(resolveLocalGitBranch(dir, 57, 'missing'), null);
  assert.equal(readGitDocument(dir, head, 'README.md'), 'PR documentation');
  assert.equal(fs.readFileSync(path.join(dir, 'README.md'), 'utf8'), 'base documentation');
});

test('offline workspace save and reload use the same per-reviewer cache', async t => {
  const entries = new Map();
  const originalFetch = globalThis.fetch;
  globalThis.localStorage = { getItem: key => entries.get(key) || null, setItem: (key, value) => entries.set(key, value) };
  globalThis.fetch = async () => { throw new Error('offline'); };
  t.after(() => { globalThis.fetch = originalFetch; delete globalThis.localStorage; });
  const { api } = await import('../src/services/apiClient.js');
  const state = { files: [file('a.js', 'hello')], githubMeta: { headSha: '123' } };
  await api.saveQueryState('GH-owner/repo#1', 'One', state, { xp: 5 }, 'reviewer_1');
  const loaded = await api.getQueryState('GH-owner/repo#1', 'reviewer_1');
  assert.equal(loaded.success, true);
  assert.deepEqual(loaded.data.files, state.files);
  assert.equal(loaded.data.userProgress.xp, 5);
  assert.equal((await api.getQueryState('GH-owner/repo#1', 'reviewer_2')).success, false);
});
