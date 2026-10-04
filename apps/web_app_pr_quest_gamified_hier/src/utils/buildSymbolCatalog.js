/**
 * Build a Level 3 blast-radius symbol catalog from PR file diffs.
 * Used for GitHub-loaded PRs that don't have the demo mock catalog.
 */

const FN_PATTERNS = [
  /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_][\w]*)\s*\(/,
  /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_][\w]*)\s*=\s*(?:async\s*)?\(/,
  /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_][\w]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/,
  /(?:async\s+)?([A-Za-z_][\w]*)\s*\([^)]*\)\s*\{/,
  /^\s*(?:public|private|protected|static|async)?\s*(?:async\s+)?([A-Za-z_][\w]*)\s*\([^)]*\)\s*(?:\{|:)/,
  /(?:def|fn|func)\s+([A-Za-z_][\w]*)\s*\(/
];

const SKIP_NAMES = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'await', 'import', 'from',
  'class', 'new', 'typeof', 'function', 'const', 'let', 'var', 'export', 'default'
]);

function lineContent(line) {
  return typeof line === 'string' ? line : (line?.content || '');
}

function extractAddedLines(file) {
  const out = [];
  for (const chunk of file.diffChunks || []) {
    (chunk.lines || []).forEach((line, idx) => {
      if (line?.type === 'add' || line?.type === 'normal') {
        out.push({
          content: lineContent(line),
          type: line?.type || 'normal',
          approxLine: idx + 1
        });
      }
    });
  }
  return out;
}

function findFunctionName(content) {
  const trimmed = content.trim();
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) {
    return null;
  }
  for (const re of FN_PATTERNS) {
    const m = trimmed.match(re);
    if (m && m[1] && !SKIP_NAMES.has(m[1])) {
      return m[1];
    }
  }
  return null;
}

function collectSnippet(lines, startIdx, maxLines = 18) {
  const buf = [];
  for (let i = startIdx; i < Math.min(lines.length, startIdx + maxLines); i++) {
    buf.push(lines[i].content);
    if (buf.length > 4 && /^\s*\}/.test(lines[i].content)) break;
  }
  return buf.join('\n') || '// Symbol body not available in diff hunk';
}

function findCallers(symbolName, files, definitionFile) {
  const callers = [];
  const needle = symbolName;
  for (const file of files) {
    if (file.path === definitionFile) continue;
    for (const chunk of file.diffChunks || []) {
      (chunk.lines || []).forEach((line, idx) => {
        const content = lineContent(line);
        if (
          content.includes(`${needle}(`) ||
          content.includes(`${needle}.`) ||
          content.includes(`'${needle}'`) ||
          content.includes(`"${needle}"`)
        ) {
          callers.push({
            file: file.path,
            line: idx + 1,
            context: content.trim().slice(0, 120)
          });
        }
      });
    }
  }
  return callers.slice(0, 8);
}

/**
 * @param {Array} files - review workspace files with diffChunks
 * @returns {{ catalog: Record<string, object>, defaultKey: string|null }}
 */
export function buildSymbolCatalogFromFiles(files = []) {
  const catalog = {};
  const list = Array.isArray(files) ? files : [];

  for (const file of list) {
    const lines = extractAddedLines(file);
    lines.forEach((row, idx) => {
      if (row.type !== 'add') return;
      const name = findFunctionName(row.content);
      if (!name || catalog[name]) return;

      const modifiedCode = collectSnippet(lines, idx);
      const callers = findCallers(name, list, file.path);
      const matches = [
        {
          id: `match-def-${name}`,
          label: `Definition: ${shortPath(file.path)}`,
          role: 'Primary Definition (Modified in PR)',
          file: file.path,
          line: row.approxLine,
          isDefinition: true
        },
        ...callers.slice(0, 3).map((c, i) => ({
          id: `match-call-${name}-${i}`,
          label: `Call-Site: ${shortPath(c.file)}`,
          role: 'Consumer in PR diff',
          file: c.file,
          line: c.line,
          isDefinition: false
        }))
      ];

      catalog[name] = {
        name,
        signature: `${name}()`,
        type: 'Symbol',
        file: file.path,
        tier: file.tier || 'Tier 1: Core Logic',
        isModified: true,
        modifiedCode,
        originalCode: `// Prior implementation not fully available in this PR hunk.\n// Review call sites and surrounding diff for ${name}().`,
        matches,
        callers
      };
    });
  }

  // Fallback: if no functions parsed, create file-level symbols so Level 3 is usable
  if (Object.keys(catalog).length === 0) {
    list.slice(0, 6).forEach((file, i) => {
      const key = `fileChange_${i + 1}`;
      const name = shortPath(file.path).replace(/[^\w.-]/g, '_');
      const added = [];
      for (const chunk of file.diffChunks || []) {
        for (const line of chunk.lines || []) {
          if (line?.type === 'add') added.push(lineContent(line));
          if (added.length >= 20) break;
        }
        if (added.length >= 20) break;
      }
      catalog[key] = {
        name,
        signature: name,
        type: 'File Change',
        file: file.path,
        tier: file.tier || 'Tier 2: Consumer',
        isModified: true,
        modifiedCode: added.join('\n') || '// No added lines in diff',
        originalCode: '// Deleted / prior lines not reconstructed for this file-level symbol.',
        matches: [{
          id: `match-file-${i}`,
          label: `File: ${file.path}`,
          role: 'Changed file in PR',
          file: file.path,
          line: 1,
          isDefinition: true
        }],
        callers: []
      };
    });
  }

  const keys = Object.keys(catalog);
  return {
    catalog,
    defaultKey: keys[0] || null
  };
}

function shortPath(path) {
  if (!path) return 'unknown';
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

export function isGithubWorkspaceFiles(files = []) {
  return (files || []).some(
    (f) => String(f.id || '').startsWith('gh-') || Boolean(f.status_github)
  );
}
