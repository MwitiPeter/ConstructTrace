import crypto from 'node:crypto';

export const STOPWORDS = new Set(
  `a about above after again against all am an and any are aren't as at be because been before being below between both but by can cannot could couldn't did didn't do does doesn't doing don't down during each few for from further had hadn't has hasn't have haven't having he her here hers herself him himself his how i if in into is isn't it its itself let's me more most mustn't my myself no nor not of off on once only or other ought our ours ourselves out over own same shan't she should shouldn't so some such than that the their theirs them themselves then there these they this those through to too under until up very was wasn't we were weren't what when where which while who whom why with won't would wouldn't you your yours yourself yourselves
  also et al ie eg fig figure table section chapter page pp approx thus however therefore moreover whereas within across among via per plus two three one first second third
  new use used using study studies paper papers research findings results result analyzed analysis based show shows shown suggests suggested`.split(/\s+/)
);

/** Collapse whitespace and trim. */
export function normalizeWs(s = '') {
  return String(s).replace(/\s+/g, ' ').trim();
}

/** Lowercased, whitespace-collapsed text used for containment searches. */
export function normalizeForSearch(s = '') {
  return normalizeWs(s).toLowerCase();
}

/** Canonical form used to group construct names (case, punctuation and hyphens ignored). */
export function normalizeName(name = '') {
  return normalizeForSearch(name)
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split a text block into sentences (keeps trailing punctuation). */
export function splitSentences(text = '') {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const matches = clean.match(/[^.!?]+[.!?]+["'”’)\]]*\s*|[^.!?]+$/g) || [];
  return matches.map((s) => s.trim()).filter((s) => s.replace(/[^a-z]/gi, '').length >= 3);
}

/** [{ text, page }] from [{ page, text }]. */
export function sentencesFromPages(pages = []) {
  const out = [];
  for (const p of pages) {
    for (const s of splitSentences(p.text)) out.push({ text: s, page: p.page });
  }
  return out;
}

/** Very light singularization / gerund stripping so related word forms match. */
export function lightStem(w) {
  let x = w.toLowerCase();
  if (x.length > 4 && x.endsWith('ies')) return `${x.slice(0, -3)}y`;
  if (x.length > 6 && x.endsWith('ing')) return x.slice(0, -3);
  if (x.length > 4 && x.endsWith('es')) return x.slice(0, -2);
  if (x.length > 3 && x.endsWith('s') && !x.endsWith('ss')) return x.slice(0, -1);
  return x;
}

/** Lowercased content-word tokens with stopwords removed and light stemming. */
export function tokenize(s = '') {
  return normalizeForSearch(s)
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w && w.length > 1 && !STOPWORDS.has(w))
    .map(lightStem);
}

/** Dice coefficient over content-word tokens: 2|A∩B| / (|A|+|B|). Range 0..1. */
export function diceSimilarity(a = '', b = '') {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (!ta.length || !tb.length) return 0;
  const setB = new Set(tb);
  let shared = 0;
  const seen = new Set();
  for (const t of ta) {
    if (setB.has(t) && !seen.has(t)) {
      shared += 1;
      seen.add(t);
    }
  }
  return (2 * shared) / (ta.length + tb.length);
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/** Stable fingerprint used to keep comparison runs idempotent. */
export function fingerprint(...parts) {
  return crypto.createHash('sha1').update(parts.join('|')).digest('hex');
}

/** Locate the real page number for a quote inside the paper; null when not present. */
export function locatePage(pages = [], text = '') {
  const needle = normalizeForSearch(text);
  if (!needle) return null;
  for (const p of pages) {
    if (normalizeForSearch(p.text).includes(needle)) return p.page;
  }
  const head = needle.slice(0, 48); // tolerate small formatting differences
  for (const p of pages) {
    if (head.length > 12 && normalizeForSearch(p.text).includes(head)) return p.page;
  }
  return null;
}

/** Does the paper text contain this exact (normalized) string? */
export function containsText(pages = [], text = '') {
  return locatePage(pages, text) !== null;
}

/**
 * Split pasted text into pages. Supports form-feed (\f) and marker lines such as
 * "--- Page 2 ---", "[Page 2]" or "Page 2 of 10". Falls back to a single page.
 */
export function splitPages(text = '') {
  const src = String(text).replace(/\r\n/g, '\n');
  if (src.includes('\f')) {
    return src
      .split('\f')
      .map((t, i) => ({ page: i + 1, text: t.trim() }))
      .filter((p) => p.text);
  }
  const marker = /(?:^|\n)[ \t]*(?:---\s*Page\s+(\d+)\s*---|\[Page\s+(\d+)\]|Page\s+(\d+)(?:\s+of\s+\d+)?)[ \t]*(?=\n|$)/gi;
  const matches = [...src.matchAll(marker)];
  if (matches.length) {
    const pages = [];
    matches.forEach((m, i) => {
      const start = m.index + m[0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index : src.length;
      const body = src.slice(start, end).trim();
      const num = Number(m[1] || m[2] || m[3] || i + 1);
      if (body) pages.push({ page: num, text: body });
    });
    if (pages.length) return pages;
  }
  const flat = src.trim();
  return flat ? [{ page: 1, text: flat }] : [];
}

/** CSV cell escaping, also neutralizing spreadsheet formula injection. */
export function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(headers, rows) {
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) lines.push(row.map(csvCell).join(','));
  return `${lines.join('\r\n')}\r\n`;
}
