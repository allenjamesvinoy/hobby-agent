const CACHE_KEY = 'paper_citations_cache_v1';

export function getCachedCitations() {
  try {
    const data = localStorage.getItem(CACHE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    console.warn('Failed to read citation cache from localStorage', e);
    return {};
  }
}

export function saveToCache(doi, citation) {
  try {
    const cache = getCachedCitations();
    const cleanDoiKey = normalizeDoi(doi);
    cache[cleanDoiKey] = {
      ...citation,
      cachedAt: new Date().toISOString()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('Failed to save citation to localStorage cache', e);
  }
}

export function normalizeDoi(doi) {
  if (!doi) return '';
  let clean = doi.trim();
  clean = clean.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  clean = clean.replace(/^doi:/i, '');
  return clean.trim();
}

export function parseBibTeX(bibtexString) {
  if (!bibtexString || typeof bibtexString !== 'string') {
    return {
      citeKey: '',
      type: 'article',
      title: '',
      authors: '',
      year: '',
      journal: '',
      doi: '',
      raw: ''
    };
  }

  const raw = bibtexString.trim();
  const typeMatch = raw.match(/@(\w+)\s*\{\s*([^,\s]+)\s*,/i);
  const type = typeMatch ? typeMatch[1].toLowerCase() : 'article';
  const citeKey = typeMatch ? typeMatch[2] : '';

  const extractField = (fieldName) => {
    const regex = new RegExp(`${fieldName}\\s*=\\s*(?:[{"]([\\s\\S]*?)[}"]|([^{"\\s,]+))`, 'i');
    const match = raw.match(regex);
    if (match) {
      return (match[1] || match[2] || '').replace(/\s+/g, ' ').trim();
    }
    return '';
  };

  const title = extractField('title');
  const authors = extractField('author') || extractField('authors');
  const year = extractField('year');
  const journal = extractField('journal') || extractField('booktitle') || extractField('publisher');
  const doi = extractField('doi');

  return {
    type,
    citeKey,
    title,
    authors,
    year,
    journal,
    doi: normalizeDoi(doi),
    raw
  };
}

export function generateCiteKey(authors, year, title) {
  let authorPart = 'Anon';
  if (authors) {
    const firstAuthor = authors.split(/and|,/i)[0].trim();
    const parts = firstAuthor.split(/\s+/);
    authorPart = parts[parts.length - 1].replace(/[^a-zA-Z]/g, '') || 'Author';
  }
  const yearPart = year ? String(year).trim() : 'ND';
  let titlePart = '';
  if (title) {
    const words = title.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    if (words.length > 0) {
      titlePart = words[0];
    }
  }
  return `${authorPart.toLowerCase()}${yearPart}${titlePart ? titlePart.toLowerCase() : ''}`;
}

export function formatBibTeX(citation) {
  const {
    type = 'article',
    citeKey,
    title,
    authors,
    year,
    journal,
    doi
  } = citation;

  const key = citeKey || generateCiteKey(authors, year, title);
  const fields = [];

  if (title) fields.push(`  title = {${title}}`);
  if (authors) fields.push(`  author = {${authors}}`);
  if (journal) fields.push(`  journal = {${journal}}`);
  if (year) fields.push(`  year = {${year}}`);
  if (doi) fields.push(`  doi = {${normalizeDoi(doi)}}`);

  return `@${type}{${key},\n${fields.join(',\n')}\n}`;
}

export async function fetchByDoi(doi) {
  const cleanDoi = normalizeDoi(doi);
  if (!cleanDoi) {
    throw new Error('Invalid DOI provided.');
  }

  // Check local cache first
  const cache = getCachedCitations();
  if (cache[cleanDoi]) {
    return {
      ...cache[cleanDoi],
      isCached: true
    };
  }

  // Fetch via CrossRef REST API with AbortController timeout guard (3000ms)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`CrossRef API returned status ${res.status}`);
    }

    const data = await res.json();
    const work = data?.message;

    if (!work) {
      throw new Error('No metadata found for DOI');
    }

    const title = Array.isArray(work.title) ? work.title[0] : (work.title || '');
    let authors = '';
    if (Array.isArray(work.author)) {
      authors = work.author
        .map((a) => {
          if (a.given && a.family) return `${a.family}, ${a.given}`;
          return a.family || a.given || a.name || '';
        })
        .filter(Boolean)
        .join(' and ');
    }

    let year = '';
    const dateParts = work['published-print']?.['date-parts'] || work['published-online']?.['date-parts'] || work['created']?.['date-parts'];
    if (dateParts && dateParts[0] && dateParts[0][0]) {
      year = String(dateParts[0][0]);
    }

    const journal = Array.isArray(work['container-title']) ? work['container-title'][0] : (work['container-title'] || work.publisher || '');
    const citeKey = generateCiteKey(authors, year, title);

    const citationObj = {
      type: 'article',
      citeKey,
      title,
      authors,
      year,
      journal,
      doi: cleanDoi,
      isCached: false
    };

    citationObj.raw = formatBibTeX(citationObj);

    // Cache locally
    saveToCache(cleanDoi, citationObj);
    return citationObj;
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';
    const fallbackCitation = {
      type: 'article',
      citeKey: `doi_${cleanDoi.replace(/[^a-zA-Z0-9]/g, '_')}`,
      title: `Publication ${cleanDoi}`,
      authors: 'Unknown Authors',
      year: new Date().getFullYear().toString(),
      journal: 'CrossRef Direct (Offline Fallback)',
      doi: cleanDoi,
      isCached: false,
      isOfflineFallback: true,
      errorMsg: isTimeout ? 'Network request timed out (3000ms guard)' : err.message
    };
    fallbackCitation.raw = formatBibTeX(fallbackCitation);
    return fallbackCitation;
  }
}

export default {
  parseBibTeX,
  formatBibTeX,
  fetchByDoi,
  getCachedCitations,
  saveToCache,
  normalizeDoi,
  generateCiteKey
};
