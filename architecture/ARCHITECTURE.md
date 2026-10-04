# Architecture Specification: Local-First Citation & DOI Resolver

## 1. System Overview
The Citation & DOI Auto-Resolver integrates into `apps/desktop_app_local_first_resear` as an offline-first modular subsystem. It allows academic readers to parse BibTeX entries, resolve DOIs via the CrossRef API, and manage saved paper citations with zero cloud backend storage.

---

## 2. Module Tiering & File Hierarchy

```text
apps/desktop_app_local_first_resear/
├── src/
│   ├── services/                     # [Tier 1: Core Logic]
│   │   ├── CitationEngine.js         # DOI validation, HTTP fetching with timeout, localStorage cache
│   │   └── BibtexParser.js           # Pure deterministic parser (BibTeX <-> JSON)
│   ├── hooks/                        # [Tier 2: Consumers]
│   │   └── useCitations.js           # React state wrapper with optimistic local cache sync
│   ├── components/                   # [Tier 2: UI Presentation]
│   │   └── CitationModal.jsx         # Notion-styled citation card, BibTeX copy shortcut
│   └── tests/                        # [Tier 3: Test Verification]
│       └── CitationEngine.test.js    # Unit tests for cache hits, timeout guards, and parsing