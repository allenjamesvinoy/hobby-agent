/**
 * Build an architecture diagram model from PR files + product architecture knowledge
 * extracted from ARCHITECTURE.md (and similar). Docs inform the product map;
 * they are not diagrammed as outline/section nodes.
 */

const TIER_RANK = {
  'Tier 1: Core Logic': 0,
  'Tier 2: Consumer': 1,
  'Tier 3: Tests': 2
};

const MAX_CHANGED = 6;
const MAX_CONTEXT = 6;

/** Doc outline / meta headings — never product architecture nodes */
const DOC_OUTLINE_RE =
  /^(table of contents|toc|contents|high-?level overview|overview|system overview|introduction|intro|getting started|background|motivation|goals?|non-?goals?|design principles|principles|repository layout|directory layout|folder structure|project structure|architecture overview|summary|conclusion|appendix|references?|related docs?|changelog|faq|rules for ai agents|agent guidelines|contracts|contributing|license|status|roadmap)$/i;

const COMPONENT_SUFFIX_RE =
  /(service|client|manager|engine|server|worker|gateway|controller|provider|repository|store|queue|pipeline|runtime|executor|orchestrator|api|sdk|cli|app|module|layer|adapter|handler)$/i;

function extractMermaidBlocks(markdown) {
  if (!markdown) return [];
  const blocks = [];
  const re = /```(?:mermaid)?\s*([\s\S]*?)```/gi;
  let match;
  while ((match = re.exec(markdown)) !== null) {
    const body = match[1].trim();
    if (/^(graph|flowchart|sequenceDiagram|classDiagram|erDiagram|stateDiagram)/i.test(body)) {
      blocks.push(body);
    }
  }
  return blocks;
}

function shortName(path) {
  if (!path) return 'Unknown';
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[`*_]/g, '')
    .replace(/\/+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isDocOutlineTitle(name) {
  const cleaned = String(name || '')
    .replace(/^\d+[\.\)]\s*/, '')
    .replace(/^#+\s*/, '')
    .trim();
  if (!cleaned) return true;
  if (DOC_OUTLINE_RE.test(cleaned)) return true;
  // Numbered outline titles: "1. High-Level Overview"
  if (/^\d+[\.\)]\s+/.test(String(name || '')) && DOC_OUTLINE_RE.test(cleaned.replace(/^\d+[\.\)]\s*/, ''))) {
    return true;
  }
  return false;
}

function looksLikeProductModule(name, { allowPath = true } = {}) {
  if (!name || isDocOutlineTitle(name)) return false;
  const n = name.trim();
  if (n.length < 2 || n.length > 56) return false;

  // Path / package style: src/core, apps/web, @org/pkg, foo/bar
  if (allowPath && (/[\\/]/.test(n) || n.startsWith('@') || /\.(js|ts|tsx|jsx|py|go|rs|json)$/i.test(n))) {
    return true;
  }

  // Single technical token: SessionManager, api-gateway, pricing_catalog
  if (/^[A-Za-z][A-Za-z0-9]+([A-Z][a-z0-9]+)+$/.test(n)) return true; // PascalCase compound
  if (/^[a-z][a-z0-9]*([_-][a-z0-9]+)+$/.test(n)) return true; // kebab/snake
  if (COMPONENT_SUFFIX_RE.test(n)) return true;

  // Reject long prose phrases
  if (n.includes(' ') && n.split(/\s+/).length > 4) return false;
  if (/^(the|a|an|this|our|how|what|why)\b/i.test(n)) return false;

  // Short CamelCase / Title Case product names (1–3 words, no punctuation spam)
  if (/^[A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,2}$/.test(n) && !isDocOutlineTitle(n)) {
    return true;
  }

  return false;
}

function statusKind(file) {
  const s = String(file.status_github || file.status || '').toLowerCase();
  if (s === 'added' || s === 'add') return 'added';
  if (s === 'removed' || s === 'deleted' || s === 'delete') return 'removed';
  if (s === 'renamed' || s === 'modified' || s === 'changed') return 'modified';
  if (s === 'pending' || s === 'approved' || s === 'flagged') {
    return file.status_github ? 'modified' : 'unchanged';
  }
  return 'modified';
}

function statusMeta(kind) {
  if (kind === 'added') {
    return {
      kind,
      badge: '+ ADDED',
      badgeColor: 'bg-[#EBF7EE] text-[#2D6A4F] border-[#2D6A4F]/30',
      fill: '#EBF7EE',
      stroke: '#2D6A4F'
    };
  }
  if (kind === 'removed') {
    return {
      kind,
      badge: '- REMOVED',
      badgeColor: 'bg-[#FEE2E2] text-[#DC2626] border-[#DC2626]/30',
      fill: '#FEE2E2',
      stroke: '#DC2626'
    };
  }
  if (kind === 'unchanged') {
    return {
      kind,
      badge: '= CONTEXT',
      badgeColor: 'bg-[#F3F4F6] text-[#4B5563] border-[#4B5563]/30',
      fill: '#FFFFFF',
      stroke: '#6B7280'
    };
  }
  return {
    kind: 'modified',
    badge: '~ MODIFIED',
    badgeColor: 'bg-[#FFF8E7] text-[#B45309] border-[#B45309]/30',
    fill: '#FFF8E7',
    stroke: '#D97706'
  };
}

/**
 * Parse product modules from embedded mermaid node labels.
 */
function extractMermaidNodes(mermaidSource) {
  if (!mermaidSource) return [];
  const nodes = [];
  const re = /^\s*([A-Za-z][\w]*)\s*(?:\[|\(|\{)["']?([^\]\)\}"'\n]+)["']?[\]\)\}]/gm;
  let match;
  while ((match = re.exec(mermaidSource)) !== null) {
    const label = match[2].replace(/<br\s*\/?>/gi, ' ').replace(/\\n/g, ' ').trim();
    const name = label.split(/[·|]/)[0].trim();
    if (looksLikeProductModule(name) || looksLikeProductModule(match[1])) {
      nodes.push({
        name: (looksLikeProductModule(name) ? name : match[1]).slice(0, 40),
        pathHint: null,
        summary: 'Product component from architecture diagram',
        source: 'mermaid',
        priority: 2
      });
    }
  }
  return nodes;
}

/**
 * Extract PRODUCT architecture entities from architecture markdown.
 * Uses docs as knowledge about the product — never doc outline sections.
 */
export function extractContextCandidates(architectureText) {
  if (!architectureText) return [];
  const candidates = [];
  const lines = architectureText.split('\n');
  let inLayoutSection = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const heading = line.match(/^#{1,4}\s+(.+)/);
    if (heading) {
      const title = heading[1].replace(/[*`#]/g, '').trim();
      inLayoutSection = /layout|directory|folder|structure|modules?|components?|packages?|services?/i.test(title);
      // Never add the heading itself as a node
      continue;
    }

    // Directory / package layout: - `src/core/`: description
    const dirBullet = line.match(/^[-*+]\s+`([^`]+)`\s*:?\s*(.*)$/);
    if (dirBullet) {
      const pathLike = dirBullet[1].trim().replace(/\/+$/, '');
      const desc = (dirBullet[2] || '').trim();
      if (looksLikeProductModule(pathLike) || /[\\/]/.test(pathLike) || inLayoutSection) {
        if (!isDocOutlineTitle(pathLike)) {
          candidates.push({
            name: pathLike,
            pathHint: pathLike,
            summary: desc || 'Product module from architecture layout',
            source: 'directory',
            priority: 1
          });
        }
      }
      continue;
    }

    // Bare path bullets: - src/features/ ...
    const pathBullet = line.match(/^[-*+]\s+([A-Za-z0-9_.@-]+(?:\/[A-Za-z0-9_.@-]+)+\/?)\s*:?\s*(.*)$/);
    if (pathBullet) {
      const pathLike = pathBullet[1].replace(/\/+$/, '');
      candidates.push({
        name: pathLike,
        pathHint: pathLike,
        summary: (pathBullet[2] || 'Product module').slice(0, 64),
        source: 'directory',
        priority: 1
      });
      continue;
    }

    // Inline code identifiers that look like modules/files
    const codeRefs = line.matchAll(/`([^`]+)`/g);
    for (const m of codeRefs) {
      const ref = m[1].trim();
      if (!looksLikeProductModule(ref)) continue;
      if (ref.length > 48) continue;
      candidates.push({
        name: ref.replace(/\/+$/, ''),
        pathHint: /[\\/]/.test(ref) ? ref.replace(/\/+$/, '') : null,
        summary: 'Module referenced in architecture doc',
        source: 'code',
        priority: 3
      });
    }

    // Bold product component names only (not prose)
    const bold = line.match(/\*\*([^*]{2,40})\*\*/);
    if (bold) {
      const name = bold[1].trim();
      if (looksLikeProductModule(name, { allowPath: true }) && !isDocOutlineTitle(name)) {
        candidates.push({
          name,
          pathHint: /[\\/]/.test(name) ? name : null,
          summary: 'Product component described in architecture doc',
          source: 'component',
          priority: 4
        });
      }
    }
  }

  // Mermaid-defined product nodes
  for (const block of extractMermaidBlocks(architectureText)) {
    candidates.push(...extractMermaidNodes(block));
  }

  // Prefer directory/mermaid; drop weaker duplicates
  candidates.sort((a, b) => (a.priority || 9) - (b.priority || 9));

  const seen = new Set();
  return candidates.filter((c) => {
    if (isDocOutlineTitle(c.name)) return false;
    if (!looksLikeProductModule(c.name) && c.source !== 'directory' && c.source !== 'mermaid') {
      return false;
    }
    const key = normalizeKey(c.pathHint || c.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function changedOverlapKeys(changedNodes) {
  const keys = new Set();
  for (const n of changedNodes) {
    keys.add(normalizeKey(n.name));
    if (n.path) {
      keys.add(normalizeKey(n.path));
      const parts = n.path.split('/').filter(Boolean);
      for (let i = 0; i < parts.length; i++) {
        keys.add(normalizeKey(parts[i]));
        keys.add(normalizeKey(parts.slice(0, i + 1).join('/')));
      }
    }
  }
  return keys;
}

function overlapsChanged(candidate, changedKeys) {
  const nameKey = normalizeKey(candidate.name);
  const pathKey = normalizeKey(candidate.pathHint || '');
  if (changedKeys.has(nameKey)) return true;
  if (pathKey && changedKeys.has(pathKey)) return true;
  for (const key of changedKeys) {
    if (!key || key.length < 3) continue;
    if (pathKey && pathKey.length >= 3 && (key.includes(pathKey) || pathKey.includes(key))) return true;
    if (nameKey.length >= 4 && (key.includes(nameKey) || nameKey.includes(key))) return true;
  }
  return false;
}

function layoutTwoZone(contextNodes, changedNodes) {
  const nodeW = 220;
  const nodeH = 78;
  const rowH = 110;
  const startY = 36;

  if (contextNodes.length === 0) return layoutFlat(changedNodes);
  if (changedNodes.length === 0) return layoutFlat(contextNodes);

  const leftX = 28;
  const rightCols = [300, 560];
  const laidContext = contextNodes.map((node, idx) => ({
    ...node,
    zone: 'context',
    x: leftX,
    y: startY + idx * rowH,
    w: nodeW,
    h: nodeH
  }));

  const laidChanged = changedNodes.map((node, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    return {
      ...node,
      zone: 'changed',
      x: rightCols[col],
      y: startY + row * rowH,
      w: nodeW,
      h: nodeH
    };
  });

  return [...laidContext, ...laidChanged];
}

function layoutFlat(nodes) {
  const colW = 250;
  const rowH = 120;
  const startX = 40;
  const startY = 40;
  return nodes.map((node, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    return {
      ...node,
      zone: node.kind === 'unchanged' ? 'context' : 'changed',
      x: startX + col * colW,
      y: startY + row * rowH,
      w: 220,
      h: 78
    };
  });
}

function folderKeyword(pathOrName) {
  const s = normalizeKey(pathOrName);
  if (!s) return null;
  if (s.includes('apps') || s.includes('web') || s.includes('frontend')) return 'apps';
  if (s.includes('features') || s.includes('cli')) return 'features';
  if (s.includes('src/core') || s === 'core' || /(^|\/)core(\/|$)/.test(s)) return 'core';
  if (s.includes('pipeline') || s.includes('orchestr')) return 'pipeline';
  if (s.includes('pric') || s.includes('catalog') || s.includes('billing')) return 'pricing';
  if (s.includes('test')) return 'tests';
  if (s.includes('.github') || s.includes('workflow')) return 'github';
  const first = s.split(/[\\/]/)[0];
  return first || null;
}

function buildEdges(laidOut) {
  const edges = [];
  const context = laidOut.filter((n) => n.zone === 'context' || n.kind === 'unchanged');
  const changed = laidOut.filter((n) => n.zone === 'changed' && n.kind !== 'unchanged');

  for (const ch of changed) {
    const chKey = folderKeyword(ch.path || ch.name);
    let linked = false;
    for (const ctx of context) {
      const ctxKey = folderKeyword(ctx.pathHint || ctx.path || ctx.name);
      const path = normalizeKey(ch.path || '');
      const ctxPath = normalizeKey(ctx.pathHint || ctx.name);
      const nameHit = (ctxPath && path.includes(ctxPath)) || (ctxPath && path.split('/').includes(ctxPath));
      if ((chKey && ctxKey && chKey === ctxKey) || nameHit) {
        edges.push({ from: ch.id, to: ctx.id, label: 'in', kind: 'unchanged' });
        linked = true;
        break;
      }
    }
    if (!linked && context.length > 0) {
      let best = context[0];
      let bestDist = Math.abs((ch.y || 0) - (best.y || 0));
      for (const ctx of context) {
        const d = Math.abs((ch.y || 0) - (ctx.y || 0));
        if (d < bestDist) {
          best = ctx;
          bestDist = d;
        }
      }
      edges.push({ from: ch.id, to: best.id, label: 'in', kind: 'unchanged' });
    }
  }

  for (let i = 0; i < context.length - 1 && edges.length < 14; i++) {
    edges.push({
      from: context[i].id,
      to: context[i + 1].id,
      label: 'layer',
      kind: 'unchanged'
    });
  }

  if (context.length === 0) {
    for (let i = 0; i < laidOut.length - 1; i++) {
      const a = laidOut[i];
      const b = laidOut[i + 1];
      if (Math.floor(i / 3) === Math.floor((i + 1) / 3)) {
        edges.push({
          from: a.id,
          to: b.id,
          label: 'related',
          kind: a.kind === 'added' || b.kind === 'added' ? 'added' : 'modified'
        });
      }
    }
  }

  return edges.slice(0, 16);
}

function toMermaid(nodes, edges, title) {
  const lines = ['flowchart LR'];
  if (title) lines.push(`  %% ${title.replace(/\n/g, ' ').slice(0, 80)}`);

  const contextNodes = nodes.filter((n) => n.kind === 'unchanged');
  const changedNodes = nodes.filter((n) => n.kind !== 'unchanged');

  if (contextNodes.length > 0) {
    lines.push('  subgraph context [Product Architecture]');
    for (const n of contextNodes) {
      const safe = n.id.replace(/[^A-Za-z0-9_]/g, '_');
      lines.push(`    ${safe}["${n.name.replace(/"/g, "'")}"]`);
    }
    lines.push('  end');
  }
  if (changedNodes.length > 0) {
    lines.push('  subgraph changed [PR Changes]');
    for (const n of changedNodes) {
      const safe = n.id.replace(/[^A-Za-z0-9_]/g, '_');
      const tier = (n.tier || '').replace('Tier ', 'T');
      lines.push(`    ${safe}["${n.name.replace(/"/g, "'")}\\n${tier}"]`);
    }
    lines.push('  end');
  }
  for (const e of edges) {
    const a = e.from.replace(/[^A-Za-z0-9_]/g, '_');
    const b = e.to.replace(/[^A-Za-z0-9_]/g, '_');
    const marker = e.kind === 'removed' ? '-.->' : '-->';
    lines.push(`  ${a} ${marker}|${e.label}| ${b}`);
  }
  lines.push('  classDef added fill:#EBF7EE,stroke:#2D6A4F,color:#1B4332;');
  lines.push('  classDef modified fill:#FFF8E7,stroke:#D97706,color:#78350F;');
  lines.push('  classDef removed fill:#FEE2E2,stroke:#DC2626,color:#991B1B;');
  lines.push('  classDef context fill:#FFFFFF,stroke:#6B7280,color:#374151;');
  for (const n of nodes) {
    const safe = n.id.replace(/[^A-Za-z0-9_]/g, '_');
    if (n.kind === 'added') lines.push(`  class ${safe} added;`);
    else if (n.kind === 'removed') lines.push(`  class ${safe} removed;`);
    else if (n.kind === 'modified') lines.push(`  class ${safe} modified;`);
    else lines.push(`  class ${safe} context;`);
  }
  return lines.join('\n');
}

/**
 * @returns {{ mode: 'dynamic'|'demo', nodes, edges, mermaid, title, sourceDoc, docComponents, hasContextNodes }}
 */
export function buildArchitectureDiagram({
  files = [],
  architectureText = '',
  repoDocs = [],
  title = 'Architecture'
} = {}) {
  const archDoc = repoDocs.find((d) => d.role === 'architecture');
  const contextDoc = repoDocs.find((d) => d.role === 'context');
  const docText = architectureText || archDoc?.content || contextDoc?.content || '';
  const hasDocs = Boolean(docText.trim()) || repoDocs.length > 0;
  const embeddedMermaid = extractMermaidBlocks(docText);
  const allContextCandidates = extractContextCandidates(docText);
  const productNames = allContextCandidates.map((c) => c.name);

  const ghFiles = (files || []).filter((f) => String(f.id || '').startsWith('gh-') || f.status_github);
  const useDynamic = ghFiles.length > 0 || repoDocs.length > 0 || Boolean(docText.trim());

  if (!useDynamic) {
    return {
      mode: 'demo',
      nodes: [],
      edges: [],
      mermaid: embeddedMermaid[0] || '',
      title,
      sourceDoc: archDoc?.path || null,
      docComponents: productNames,
      hasContextNodes: false,
      changedInPr: false
    };
  }

  const ranked = [...ghFiles]
    .sort((a, b) => {
      const tr = (TIER_RANK[a.tier] ?? 9) - (TIER_RANK[b.tier] ?? 9);
      if (tr !== 0) return tr;
      return (b.importance || 0) - (a.importance || 0);
    })
    .slice(0, MAX_CHANGED);

  const changedNodes = ranked.map((f, idx) => {
    const kind = statusKind(f);
    const meta = statusMeta(kind);
    return {
      id: `N${idx + 1}`,
      name: shortName(f.path),
      path: f.path,
      pathHint: f.path,
      tier: f.tier || 'Tier 2: Consumer',
      summary: `${f.additions || 0}+ / ${f.deletions || 0}- · ${f.tier || 'file'}`,
      zone: 'changed',
      ...meta
    };
  });

  const changedKeys = changedOverlapKeys(changedNodes);
  const sourceLabel = archDoc?.path || contextDoc?.path || 'ARCHITECTURE.md';

  let contextNodes = [];
  if (hasDocs && allContextCandidates.length > 0) {
    const surviving = allContextCandidates
      .filter((c) => !overlapsChanged(c, changedKeys))
      .slice(0, MAX_CONTEXT);

    contextNodes = surviving.map((c, i) => {
      const meta = statusMeta('unchanged');
      const tier =
        c.source === 'directory' ? 'Product Module' :
        c.source === 'mermaid' ? 'Architecture Node' :
        'Product Component';
      return {
        id: `C${i + 1}`,
        name: c.name.slice(0, 28),
        path: null,
        pathHint: c.pathHint,
        tier,
        summary: (c.summary || `Product architecture · ${sourceLabel}`).slice(0, 52),
        zone: 'context',
        ...meta
      };
    });
  }

  const nodes = layoutTwoZone(contextNodes, changedNodes);
  const edges = buildEdges(nodes);
  // Prefer generating mermaid from product+delta map; only use embedded if it exists
  // AND we have no structured nodes (rare). When we have product modules, show our map.
  const mermaid =
    nodes.length > 0
      ? toMermaid(nodes, edges, title)
      : (embeddedMermaid[0] || toMermaid(nodes, edges, title));

  const shownKeys = new Set(contextNodes.map((n) => normalizeKey(n.pathHint || n.name)));
  const chipExtras = productNames.filter((name) => !shownKeys.has(normalizeKey(name)));

  return {
    mode: 'dynamic',
    nodes,
    edges,
    mermaid,
    title,
    sourceDoc: archDoc?.path || contextDoc?.path || repoDocs[0]?.path || null,
    docComponents: [...contextNodes.map((n) => n.name), ...chipExtras].slice(0, 12),
    hasContextNodes: contextNodes.length > 0,
    changedInPr: Boolean(archDoc?.changedInPr)
  };
}
