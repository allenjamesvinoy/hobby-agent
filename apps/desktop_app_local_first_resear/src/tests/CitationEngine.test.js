import { describe, it, expect, beforeEach, vi } from 'vitest';
import CitationEngine from '../services/CitationEngine';

describe('CitationEngine Services', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('normalizeDoi', () => {
    it('cleans DOI URLs and prefixes correctly', () => {
      expect(CitationEngine.normalizeDoi('https://doi.org/10.1145/3290605.3300508')).toBe('10.1145/3290605.3300508');
      expect(CitationEngine.normalizeDoi('doi:10.1000/182')).toBe('10.1000/182');
      expect(CitationEngine.normalizeDoi(' 10.1016/j.cell.2020.01.001 ')).toBe('10.1016/j.cell.2020.01.001');
    });
  });

  describe('parseBibTeX', () => {
    it('parses valid BibTeX string correctly', () => {
      const bibtex = `@article{vaswani2017attention,
        title = {Attention Is All You Need},
        author = {Vaswani, Ashish and Shazeer, Noam},
        year = {2017},
        journal = {Advances in Neural Information Processing Systems},
        doi = {10.5555/3295222.3295349}
      }`;

      const parsed = CitationEngine.parseBibTeX(bibtex);
      expect(parsed.citeKey).toBe('vaswani2017attention');
      expect(parsed.title).toBe('Attention Is All You Need');
      expect(parsed.authors).toBe('Vaswani, Ashish and Shazeer, Noam');
      expect(parsed.year).toBe('2017');
      expect(parsed.journal).toBe('Advances in Neural Information Processing Systems');
      expect(parsed.doi).toBe('10.5555/3295222.3295349');
    });

    it('gracefully handles malformed or incomplete BibTeX input', () => {
      const malformed = 'This is not valid BibTeX content!';
      const parsed = CitationEngine.parseBibTeX(malformed);
      expect(parsed.title).toBe('');
      expect(parsed.authors).toBe('');
      expect(parsed.citeKey).toBe('');
    });
  });

  describe('formatBibTeX & generateCiteKey', () => {
    it('generates citation key correctly', () => {
      const key = CitationEngine.generateCiteKey('Vaswani, Ashish and Shazeer, Noam', '2017', 'Attention Is All You Need');
      expect(key).toBe('vaswani2017attention');
    });

    it('formats citation object to raw BibTeX format', () => {
      const cit = {
        type: 'article',
        citeKey: 'test2025',
        title: 'Test Title',
        authors: 'Author, One',
        year: '2025',
        journal: 'Journal of Testing',
        doi: '10.1234/test'
      };
      const raw = CitationEngine.formatBibTeX(cit);
      expect(raw).toContain('@article{test2025,');
      expect(raw).toContain('title = {Test Title}');
      expect(raw).toContain('doi = {10.1234/test}');
    });
  });

  describe('localStorage Cache Retrieval', () => {
    it('saves citation to paper_citations_cache_v1 and retrieves it', () => {
      const testCitation = {
        title: 'Local First Research Tools',
        authors: 'Agent, AI',
        year: '2025',
        journal: 'Journal of Autonomous Software',
        doi: '10.1234/jar.2025.01'
      };

      CitationEngine.saveToCache('10.1234/jar.2025.01', testCitation);
      const cache = CitationEngine.getCachedCitations();
      expect(cache['10.1234/jar.2025.01']).toBeDefined();
      expect(cache['10.1234/jar.2025.01'].title).toBe('Local First Research Tools');
    });

    it('returns cached citation instantly in fetchByDoi without network call', async () => {
      const cachedData = {
        title: 'Cached Paper Title',
        authors: 'Doe, Jane',
        year: '2024',
        journal: 'Cached Journal',
        doi: '10.1000/cached.doi'
      };

      CitationEngine.saveToCache('10.1000/cached.doi', cachedData);

      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const result = await CitationEngine.fetchByDoi('10.1000/cached.doi');

      expect(result.isCached).toBe(true);
      expect(result.title).toBe('Cached Paper Title');
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
"
  },
  "review_summary": "### ð¤ Autonomous Agent PR Summary

#### ð What was built
- **Local-First BibTeX & DOI Resolver Service (`CitationEngine.js`)**: Includes DOI normalization (`https://doi.org/`, `doi:` prefix removal), raw BibTeX extraction/parsing, cite key generator, formatted BibTeX exporter, and local storage caching (`paper_citations_cache_v1`) with automatic 3000ms network timeout fallback to offline mode.
- **Citation Modal UI (`CitationModal.jsx`)**: Tabbed interface switching between DOI Auto-Resolve (fetching via CrossRef API / local cache) and Raw BibTeX parser. Allows copying cite keys, raw formatted BibTeX, and persisting entries directly to the local workspace.
- **App Integration (`App.jsx` & `PaperDetail.jsx`)**: Added workspace sync via `onSaveCitation`, updating currently active papers with resolved DOI, BibTeX strings, and metadata. Cleaned up UTF-8 character encoding artifacts and syntax trailing characters.
- **Vitest Unit Suite (`CitationEngine.test.js`)**: Comprehensive test suite covering DOI normalization, BibTeX parsing, key generation, string formatting, and offline local cache retrieval.

#### ð ï¸ Files Updated & Added
- `apps/desktop_app_local_first_resear/src/services/CitationEngine.js`
- `apps/desktop_app_local_first_resear/src/components/CitationModal.jsx`
- `apps/desktop_app_local_first_resear/src/components/PaperDetail.jsx`
- `apps/desktop_app_local_first_resear/src/App.jsx`
- `apps/desktop_app_local_first_resear/src/tests/CitationEngine.test.js`

#### ð Reviewer Fixes & Verification Notes
- **Encoding & Syntax Fixes**: Corrected escaped UTF-8 artifacts (`\u00e2\u0080\u00a2` -> `â¢`) and eliminated malformed quotes in `PaperDetail.jsx`.
- **BibTeX Parsing Extraction**: Enhanced multiline regex support in `parseBibTeX` field extraction to cleanly capture nested spaces and multiline value definitions.
- **Paper Sync Handler**: Connected `onSaveCitation` in `App.jsx` to synchronize resolved DOI and raw BibTeX entries back to active paper entities.