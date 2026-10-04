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
```

---

## 3. Architectural Standards Checklist (PR Quest Level 2)

### STD-01: Decoupled Data Access
UI components (`CitationModal.jsx`, `App.jsx`) must never call `fetch()` or `localStorage` directly. All network access, cache reading, and mutations must strictly route through `CitationEngine.js`.

### STD-02: Offline-First Cache Precedence
The application must check the local browser cache (`paper_citations_cache_v1`) before initiating any outbound network request. If a DOI is already cached, it must return immediately with 0ms network latency.

### STD-03: Network Resilience & Timeout Guard
All outbound DOI resolution requests to `api.crossref.org` must enforce an `AbortController` timeout of no greater than 3000ms. If the request times out or is offline, it must fail gracefully with a typed fallback rather than hanging the UI.

### STD-04: Modularity & LOC Boundary (<= 200 Lines)
In adherence to the incubator's architectural rules, no single file may exceed 200 lines of code. Parsing logic (`BibtexParser.js`) and network/cache operations (`CitationEngine.js`) must be separated.

### STD-05: Deterministic Error Contracts
Functions in Tier 1 must return typed result objects (`{ success: true, citation }` or `{ success: false, error: 'TIMEOUT' | 'NOT_FOUND' | 'OFFLINE' }`) rather than unhandled promise rejections.

---

## 4. Architectural Dataflow Diagram

```mermaid
graph TD
  UI["CitationModal.jsx<br/>(Tier 2: UI Component)"] -->|Subscribes to citations| HOOK["useCitations.js<br/>(Tier 2: React Hook)"]
  HOOK -->|Invokes resolveDoi()| ENG["CitationEngine.js<br/>(Tier 1: Core Engine)"]
  ENG -->|1. Check Cache First| CACHE[("localStorage Cache<br/>(Local-First Store)")]
  ENG -->|2. Format Strings| PARSE["BibtexParser.js<br/>(Tier 1: Pure Parser)"]
  ENG -->|3. On Cache Miss (<= 3s Timeout)| API["CrossRef REST API<br/>(External Service)"]
  TEST["CitationEngine.test.js<br/>(Tier 3: Test Suite)"] -->|Verifies contracts & mock failures| ENG

  classDef core fill:#FBEFEF,stroke:#C35832,stroke-width:2px,color:#242220;
  classDef consumer fill:#FFFDF9,stroke:#D08A29,stroke-width:2px,color:#242220;
  classDef support fill:#F4F8F5,stroke:#4F6D56,stroke-width:2px,color:#242220;
  classDef external fill:#F1ECE4,stroke:#6B635A,stroke-width:1.5px,color:#6B635A;
  class ENG,PARSE core;
  class UI,HOOK consumer;
  class TEST support;
  class CACHE,API external;
```
