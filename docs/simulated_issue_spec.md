# [Feature] Local-First BibTeX Citation & DOI Auto-Resolver

## Summary
Add an offline-first Citation & DOI metadata resolution engine to `apps/desktop_app_local_first_resear`. Researchers reading papers in the app should be able to click on a citation tag or enter a DOI (e.g. `10.1145/3290605.3300508`) to instantly view formatted BibTeX entries, copy citation keys, and save them directly to their local workspace citations with zero cloud backend dependency.

---

## User Stories & Context
- As an academic researcher, I want to quickly grab clean BibTeX citations for papers I'm reading without leaving the reader canvas.
- When working offline, I want previously resolved citations to load instantly from browser storage without network latency or timeout errors.
- As a security and privacy-focused user, all citation notes and workspace metadata must stay on my device using client-side `localStorage`.

---

## Acceptance Criteria Checklist (PR Quest Level 1 Spec)
- [ ] **AC-1**: Implement `CitationEngine.js` in `apps/desktop_app_local_first_resear/src/services/` that parses raw BibTeX strings into structured citation objects (`title`, `authors`, `year`, `journal`, `doi`).
- [ ] **AC-2**: Support DOI auto-resolution via the public CrossRef REST API (`https://api.crossref.org/works/{doi}`) with an `AbortController` timeout guard (3000ms) and graceful offline fallback.
- [ ] **AC-3**: Implement local-first caching in `localStorage` (`paper_citations_cache_v1`) such that cached DOIs resolve immediately without network requests.
- [ ] **AC-4**: Build `CitationModal.jsx` in `apps/desktop_app_local_first_resear/src/components/` providing a 1-click "Copy BibTeX" button and formatted citation card with Notion-style typography (`#FBFBFA` canvas).
- [ ] **AC-5**: Add unit tests in `apps/desktop_app_local_first_resear/src/tests/CitationEngine.test.js` validating valid DOI parsing, malformed BibTeX handling, and offline cache retrieval.

---

## Technical Constraints & Boundaries
1. **Target Directory**: `apps/desktop_app_local_first_resear/`
2. **Architecture Standard**: UI components must never call `fetch()` directly; all resolution must pass through `CitationEngine.js`.
3. **Module Length**: Keep individual files modular and under 200 lines of code.
4. **Zero Cloud Dependencies**: Pure client-side React / Vite execution with no external backend requirement.
