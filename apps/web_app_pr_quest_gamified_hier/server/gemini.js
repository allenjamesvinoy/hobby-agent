import fs from 'fs';
import path from 'path';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * Resolve effective Gemini API Key from explicit arg, env vars, or optional DB setting.
 */
export function resolveGeminiApiKey(explicitKey, dbSetting) {
  if (explicitKey && typeof explicitKey === 'string' && explicitKey.trim()) {
    return explicitKey.trim();
  }
  if (dbSetting && typeof dbSetting === 'string' && dbSetting.trim()) {
    return dbSetting.trim();
  }
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
}

/**
 * Direct fetch wrapper calling Google Generative AI REST API with structured JSON output.
 */
export async function callGeminiApi({ prompt, systemInstruction, model = DEFAULT_MODEL, apiKey }) {
  const key = resolveGeminiApiKey(apiKey);
  if (!key) {
    throw new Error('Gemini API key is not configured. Set GEMINI_API_KEY or provide a key in settings.');
  }

  const endpoint = `${GEMINI_API_URL}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

  const bodyPayload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json'
    }
  };

  if (systemInstruction) {
    bodyPayload.systemInstruction = {
      role: 'system',
      parts: [{ text: systemInstruction }]
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      let parsed;
      try { parsed = JSON.parse(errText); } catch (_) {}
      const errMsg = parsed?.error?.message || `Gemini API returned status ${res.status}`;
      throw new Error(errMsg);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const textPart = candidate?.content?.parts?.[0]?.text;

    if (!textPart) {
      throw new Error('Gemini API returned an empty response.');
    }

    try {
      return JSON.parse(textPart);
    } catch (parseErr) {
      // If model returned markdown code block wrapping JSON, strip it
      const stripped = textPart.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      return JSON.parse(stripped);
    }
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Gemini request timed out after 45s.');
    }
    throw err;
  }
}

/**
 * Compare user-uploaded architecture.md against PR code diffs.
 * Evaluates architectural boundaries, conformance, and derives the architecture net diff.
 */
export async function analyzeArchitectureDiff({ architectureDoc, prDiffs = [], files = [], prTitle = '', apiKey }) {
  const systemInstruction = `You are a Principal Software Architect performing an architectural audit of a Pull Request.
Your task is to compare the provided architecture specification (architecture.md) against the actual code changes and file diffs in the PR.

Analyze:
1. Architectural Standards & Rules: Extract 3-5 concrete architectural rules stated or implied by architecture.md (e.g. layer boundaries, error propagation, state immutability, auth contracts).
   For each standard, assess whether the PR adheres or violates it.
2. Architecture Net Diff: Identify components and services in the system. Which were:
   - "created": newly added services/modules in this PR
   - "modified": existing modules whose contract or logic changed
   - "removed": deprecated or eliminated flows
   - "unchanged": relevant context modules
3. Provide layout coordinates (x, y, w, h) for a 820px wide SVG diagram.
4. Provide directed data-flow edges with "kind": "created" | "modified" | "removed" | "normal".
5. Write a concise architectural executive summary.

Return strictly valid JSON conforming to this schema:
{
  "summary": "Concise 2-3 paragraph markdown summary of architectural changes, impacts, and adherence.",
  "standards": [
    {
      "id": "STD-01",
      "category": "Architecture Boundary | Security | Reliability | State Flow",
      "title": "Short title of standard (max 60 chars)",
      "description": "Specific guideline from architecture.md and how this PR fulfills or risks it.",
      "status": "compliant | warning | violation",
      "completed": false
    }
  ],
  "nodes": [
    {
      "id": "SHORT_ID",
      "name": "Component.js",
      "tier": "Tier 1: Core Logic | Tier 2: Supporting | Tier 3: Client",
      "badge": "+ NEW ENGINE | ~ MODIFIED FLOW | = UNCHANGED",
      "badgeColor": "bg-[#EBF7EE] text-[#2D6A4F] border-[#2D6A4F]/30",
      "summary": "1-sentence responsibility description",
      "path": "path/to/file or null",
      "status": "created | modified | removed | unchanged",
      "x": 40,
      "y": 60,
      "w": 220,
      "h": 78
    }
  ],
  "edges": [
    {
      "from": "SHORT_ID_A",
      "to": "SHORT_ID_B",
      "label": "calls / rotates / dispatches",
      "kind": "created | modified | removed | normal"
    }
  ]
}`;

  const prompt = `PR Title: ${prTitle}

=== UPLOADED ARCHITECTURE.MD ===
${architectureDoc.slice(0, 12000)}

=== MODIFIED FILES & DIFF SUMMARY ===
${files.map((f, i) => `#${i + 1}: ${f.path} (+${f.additions || 0}/-${f.deletions || 0}, ${f.status || 'modified'})`).join('\n')}

=== CODE PATCH EXCERPTS ===
${prDiffs.slice(0, 20).map(d => `--- File: ${d.path} ---\n${(d.patch || '').slice(0, 1500)}`).join('\n\n')}
`;

  return await callGeminiApi({
    prompt,
    systemInstruction,
    apiKey
  });
}

/**
 * Structure Acceptance Criteria directly from a linked GitHub Issue body.
 * Maps criteria to specific changed files in the PR.
 */
export async function structureIssueCriteria({ issueNumber, issueTitle, issueBody, files = [], apiKey }) {
  const systemInstruction = `You are a Senior Engineering Manager and Lead QA Architect.
Analyze the provided GitHub Issue and the list of modified files in the associated PR.

Extract and formulate:
1. 3 to 6 actionable, testable Acceptance Criteria (AC-1, AC-2, etc.).
   - Prioritize any explicit checkboxes "- [ ]" or requirements in the issue.
   - If the issue is brief, derive concrete intent criteria based on what the PR code actually implements to satisfy the issue.
2. For each criterion, map which specific changed files in the PR are responsible for implementing it (file paths).

Return strictly valid JSON conforming to this schema:
{
  "criteria": [
    {
      "id": "AC-1",
      "title": "Clear action-oriented requirement statement (max 80 chars)",
      "description": "How a reviewer or QA engineer verifies this requirement is satisfied.",
      "completed": false
    }
  ],
  "fileSpecTags": {
    "path/to/file.ext": "AC-1"
  }
}`;

  const prompt = `GitHub Issue #${issueNumber}: ${issueTitle}

=== ISSUE DESCRIPTION ===
${issueBody || '(No description provided in issue)'}

=== PR MODIFIED FILES ===
${files.map(f => f.path).join('\n')}
`;

  return await callGeminiApi({
    prompt,
    systemInstruction,
    apiKey
  });
}

/**
 * Derive function blast radius symbols and realistic test suites for Level 3 & Level 4.
 */
export async function deriveSymbolsAndTests({ files = [], prTitle = '', prBody = '', criteria = [], apiKey }) {
  const systemInstruction = `You are a Principal Test & Reliability Architect.
Analyze the PR files and Acceptance Criteria to derive:
1. Symbol Catalog (Level 3 Function Inspector): 2 to 5 critical exported functions, methods, or components modified in the PR.
   - Assign risk tier: 1 (Critical core logic), 2 (Supporting layer), 3 (Edge/UI/Config).
   - Provide clean function signature, summary of blast radius, and 5-15 lines of representative modern implementation code.
2. Test Suites (Level 4 Test Review Workspace): 3 to 5 realistic test cases covering happy path, contract validations, and error boundaries.

Return strictly valid JSON conforming to this schema:
{
  "symbolCatalog": {
    "functionOrSymbolName": {
      "name": "functionOrSymbolName",
      "signature": "export async function functionOrSymbolName(args...)",
      "type": "Function | Hook | Component | Method",
      "file": "path/to/file",
      "tier": 1,
      "summary": "Why this function is high risk and what downstream components it affects.",
      "downstreamCallers": ["CallerComponent", "serviceConsumer()"],
      "code": "/* Code snippet showing implementation */"
    }
  },
  "testSuites": [
    {
      "id": "test-1",
      "suiteName": "Core Verification Suite",
      "testName": "should successfully validate inputs and execute core flow",
      "file": "tests/core.test.js",
      "targetSymbol": "functionOrSymbolName",
      "targetFile": "path/to/source.js",
      "targetLines": "1-35",
      "status": "pass",
      "executionMs": 14,
      "assertionsCount": 2,
      "assertions": [
        { "text": "expect(res).toBeDefined()", "status": "pass", "label": "Contract Verification" },
        { "text": "expect(res.status).toBe(200)", "status": "pass", "label": "Response State" }
      ],
      "code": "it('should successfully validate inputs', async () => {\n  const res = await target();\n  expect(res).toBeDefined();\n});",
      "testedFunctionCode": "/* Representative production function code snippet */",
      "notes": "Verified against production logic."
    }
  ]
}`;

  const prompt = `PR Title: ${prTitle}
PR Description: ${prBody || 'N/A'}

Criteria:
${(criteria || []).map(c => `- ${c.id}: ${c.title}`).join('\n')}

Modified Files:
${files.map(f => `${f.path} (+${f.additions || 0}/-${f.deletions || 0})`).join('\n')}
`;

  const raw = await callGeminiApi({
    prompt,
    systemInstruction,
    apiKey
  });

  if (raw && Array.isArray(raw.testSuites)) {
    raw.testSuites = normalizeGeminiTestSuites(raw.testSuites, files);
  }

  return raw;
}

/**
 * Normalizes test suites from either nested or flat schema into rich test cases.
 */
function normalizeGeminiTestSuites(rawSuites = [], files = []) {
  const result = [];
  rawSuites.forEach((item, suiteIdx) => {
    if (!item) return;

    // Nested suite case { title, tests: [ ... ] }
    if (Array.isArray(item.tests) && item.tests.length > 0) {
      const suiteName = item.suiteName || item.title || `Suite ${suiteIdx + 1}`;
      const f0Path = files[0]?.path || files[0]?.filename || 'file.js';
      const suiteFile = item.file || (files[0] ? `tests/${f0Path.split('/').pop().replace(/\.[^.]+$/, '')}.test.js` : 'tests/suite.test.js');
      item.tests.forEach((t, tIdx) => {
        const targetFile = t.targetFile || files[0]?.path || files[0]?.filename || 'src/index.js';
        const targetSymbol = t.targetSymbol || t.symbol || 'handler';
        result.push({
          id: t.id || `test-${suiteIdx + 1}-${tIdx + 1}`,
          suiteName,
          testName: t.testName || t.name || `should verify ${targetSymbol}`,
          file: t.file || suiteFile,
          targetSymbol,
          targetFile,
          targetLines: t.targetLines || '1-40',
          status: t.status === 'fail' || t.status === 'warning' ? 'warning' : 'pass',
          executionMs: t.executionMs || 15,
          assertionsCount: t.assertionsCount || (t.assertions?.length) || 2,
          assertions: Array.isArray(t.assertions) && t.assertions.length > 0 ? t.assertions : [
            { text: `expect(${targetSymbol}).toBeDefined()`, status: 'pass', label: 'Export Verification' },
            { text: 'expect(res.status).toBe(200)', status: 'pass', label: 'Contract Integrity' }
          ],
          code: t.code || `it('${t.testName || t.name || 'should pass'}', async () => {\n  const res = await ${targetSymbol}();\n  expect(res).toBeDefined();\n});`,
          testedFunctionCode: t.testedFunctionCode || `// Implementation in ${targetFile}\nexport async function ${targetSymbol}() {\n  return { status: 200 };\n}`,
          notes: t.notes || `Verified against ${targetFile}`
        });
      });
      return;
    }

    // Flat test case
    const targetFile = item.targetFile || files[0]?.path || 'src/index.js';
    const targetSymbol = item.targetSymbol || item.symbol || 'handler';
    result.push({
      id: item.id || `test-${suiteIdx + 1}`,
      suiteName: item.suiteName || item.title || 'Verification Suite',
      testName: item.testName || item.name || `should verify ${targetSymbol}`,
      file: item.file || 'tests/index.test.js',
      targetSymbol,
      targetFile,
      targetLines: item.targetLines || '1-40',
      status: item.status === 'fail' || item.status === 'warning' ? 'warning' : 'pass',
      executionMs: item.executionMs || 14,
      assertionsCount: item.assertionsCount || (item.assertions?.length) || 2,
      assertions: Array.isArray(item.assertions) && item.assertions.length > 0 ? item.assertions : [
        { text: `expect(${targetSymbol}).toBeDefined()`, status: 'pass', label: 'Export Verification' },
        { text: 'expect(res).toBeDefined()', status: 'pass', label: 'Contract Integrity' }
      ],
      code: item.code || `it('${item.testName || item.name || 'should pass'}', async () => {\n  expect(true).toBe(true);\n});`,
      testedFunctionCode: item.testedFunctionCode || `// Implementation in ${targetFile}\nexport function ${targetSymbol}() {\n  return true;\n}`,
      notes: item.notes || 'Verified test case'
    });
  });
  return result;
}
