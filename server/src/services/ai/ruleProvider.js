/**
 * Local rule-based extraction provider (default AI provider).
 *
 * Extracts construct names, definitions, measurement items and supporting
 * quotations directly from the paper text, always carrying the real page
 * number where each piece of evidence was found. It never invents text:
 * every quote it returns is a verbatim sentence from the source pages.
 */
import { normalizeWs, normalizeName, sentencesFromPages } from '../../utils/text.js';
import { CONSTRUCT_LEXICON, GENERIC_NAMES } from './lexicon.js';

const DEF_CUES = [
  /\b(?:is|are|was|were)\s+(?:[^.]{0,60}?\s)?(?:defined|conceptualized|conceptualised|understood|characterized|characterised|considered|operationalized|operationalised|taken to mean)\s+(?:here\s+|often\s+|generally\s+|typically\s+)?as\b/i,
  /\bwe\s+(?:also\s+)?define\s+/i,
  /\brefers?\s+to\b/i,
  /\bdenotes\b/i,
  /\bstands for\b/i,
];

const MEASURE_CUE =
  /\b(?:measured|assessed|evaluated|gauged|captured|operationalized|operationalised)\s+(?:using|with|by|through|via)\b|\bitems?\s+such\s+as\b|\bLikert\b|\bCronbach\b|\bscale (?:of|developed|adapted|comprised)\b|\bitems?\s+were\b|\brespondents\s+(?:were\s+)?rated\b/i;

const QUOTE_RE = /["“]([^"”]{4,160})["”]/g;
const TITLECASE_RE = /\b([A-Z][a-z]+(?:[\s-][A-Z][a-z]+){1,3})\b/g;

const PREFIX_STOP = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'that', 'which', 'as', 'to', 'in', 'for', 'with', 'by',
  'on', 'is', 'are', 'was', 'were', 'be', 'been', 'it', 'its', 'this', 'these', 'those', 'we',
  'our', 'their', 'his', 'her', 'from', 'at', 'when', 'where', 'how', 'what', 'who', 'why',
  'not', 'can', 'may', 'more', 'such', 'into', 'there', 'here', 'also', 'both', 'each', 'other',
  'another', 'those', 'they', 'them', 'his', 'all', 'any', 'if', 'then', 'than', 'but', 'while',
  'because', 'since', 'after', 'before', 'between', 'within', 'across', 'about', 'over', 'under',
]);

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function lexiconRegex(phrase) {
  return new RegExp(`\\b${escapeRe(phrase).replace(/-/g, '[-\\s]')}\\b`, 'i');
}

/** Extract a plausible construct name from the text preceding a definition cue. */
function nameFromPrefix(prefix) {
  const words = normalizeWs(prefix).split(' ');
  const picked = [];
  for (let i = words.length - 1; i >= 0 && picked.length < 4; i -= 1) {
    const bare = words[i].replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
    if (!bare || PREFIX_STOP.has(bare.toLowerCase())) break;
    picked.unshift(words[i]);
  }
  let name = picked.join(' ').trim();
  name = name.replace(/^[^A-Za-z]+/, '').replace(/[^A-Za-z0-9-]+$/, '');
  return name || null;
}

function plausibleName(name) {
  if (!name) return false;
  const key = normalizeName(name);
  if (key.length < 3 || key.length > 80) return false;
  if (GENERIC_NAMES.has(key)) return false;
  if (!/[a-z]/.test(key)) return false;
  return true;
}

/** Word-boundary-ish containment between a normalized name and a normalized sentence. */
function mentionsName(sentence, nameKey) {
  if (!nameKey) return false;
  const hay = ` ${normalizeName(sentence)} `;
  return hay.includes(` ${nameKey} `);
}

function extractQuoted(text) {
  const out = [];
  for (const m of text.matchAll(QUOTE_RE)) {
    const q = normalizeWs(m[1]);
    if (q.replace(/[^a-z]/gi, '').length >= 4) out.push(q);
  }
  return out;
}

/**
 * @param {{pages?: {page:number,text:string}[], researchQuestion?: string}} input
 * @returns {Array<{name:string, definition:{text:string,page?:number}|null,
 *   measurementItems:{text:string,page?:number}[], evidenceQuotes:{text:string,page?:number}[],
 *   confidence:number, provider:string}>}
 */
export function extractWithRules({ pages = [] } = {}) {
  const sentences = sentencesFromPages(pages);
  const candidates = new Map(); // normalizedName -> candidate

  const ensure = (surface) => {
    const key = normalizeName(surface);
    if (!plausibleName(surface)) return null;
    let c = candidates.get(key);
    if (!c) {
      c = {
        name: normalizeWs(surface),
        key,
        defs: [],
        quotes: [],
        items: [],
        mentions: 0,
        cueDef: false,
        cueMeasure: false,
        lexicon: false,
      };
      candidates.set(key, c);
    }
    return c;
  };

  const namesInSentence = (text, withCues) => {
    const found = [];
    for (const phrase of CONSTRUCT_LEXICON) {
      const re = lexiconRegex(phrase);
      const m = re.exec(text);
      if (m) found.push({ surface: m[0], lexicon: true });
    }
    if (withCues) {
      let m;
      TITLECASE_RE.lastIndex = 0;
      while ((m = TITLECASE_RE.exec(text)) !== null) {
        found.push({ surface: m[1], lexicon: false });
      }
    }
    return found;
  };

  // Pass 1: definition and measurement cues, sentence by sentence.
  sentences.forEach((s, idx) => {
    const text = s.text;

    // Lexicon hits anywhere in the sentence.
    for (const phrase of CONSTRUCT_LEXICON) {
      const m = lexiconRegex(phrase).exec(text);
      if (m) {
        const c = ensure(m[0]);
        if (c) {
          c.mentions += 1;
          c.lexicon = true;
        }
      }
    }

    // Definition sentences: name comes from the text before the cue.
    for (const cue of DEF_CUES) {
      const m = cue.exec(text);
      if (!m) continue;
      const surface = nameFromPrefix(text.slice(0, m.index));
      if (!surface) continue;
      const c = ensure(surface);
      if (!c) continue;
      c.cueDef = true;
      c.mentions += 1;
      if (!c.defs.some((d) => d.text === text)) c.defs.push({ text, page: s.page });
      break; // one definition capture per sentence is enough
    }

    // Measurement cues: attribute the sentence (and quoted items) to named constructs.
    if (MEASURE_CUE.test(text)) {
      const named = namesInSentence(text, true);
      for (const { surface, lexicon } of named) {
        const c = ensure(surface);
        if (!c) continue;
        c.cueMeasure = true;
        c.mentions += 1;
        if (lexicon) c.lexicon = true;
        for (const q of extractQuoted(text)) pushUnique(c.items, { text: q, page: s.page });
      }
      // Look ahead one sentence: "We measured X using a scale. Items such as "..." were rated."
      const next = sentences[idx + 1];
      if (next && next.text.length < 400) {
        const nextQuotes = extractQuoted(next.text);
        if (nextQuotes.length) {
          for (const { surface } of named) {
            const c = ensure(surface);
            if (!c) continue;
            for (const q of nextQuotes) pushUnique(c.items, { text: q, page: next.page });
          }
        }
      }
    }
  });

  // Pass 2: supporting quotations — real sentences that mention the construct.
  for (const c of candidates.values()) {
    for (const s of sentences) {
      if (!mentionsName(s.text, c.key)) continue;
      pushUnique(c.quotes, { text: s.text, page: s.page });
      if (c.quotes.length >= 5) break;
    }
  }

  // True mention counts (word-boundary aware) override cue-based counts.
  const allText = pages.map((p) => p.text).join('\n');
  for (const c of candidates.values()) {
    const re = new RegExp(`\\b${escapeRe(c.key).replace(/ /g, '[\\s-]+')}\\b`, 'gi');
    const raw = allText.match(re);
    c.mentions = Math.max(c.mentions, raw ? raw.length : 0);
  }

  // Build output.
  const out = [];
  for (const c of candidates.values()) {
    if (c.mentions === 0) continue;
    const definition = c.defs.length ? { text: c.defs[0].text, page: c.defs[0].page } : null;

    let confidence;
    if (definition && c.cueDef) confidence = 0.9;
    else if (definition) confidence = 0.85;
    else if (c.cueMeasure) confidence = 0.75;
    else if (c.lexicon && c.mentions >= 2) confidence = 0.65;
    else if (c.mentions >= 3) confidence = 0.6;
    else if (c.lexicon) confidence = 0.5;
    else confidence = 0.5;

    const quotes = prioritizeQuotes(c, definition);

    out.push({
      name: c.name,
      definition,
      measurementItems: c.items.slice(0, 8),
      evidenceQuotes: quotes,
      confidence,
      provider: 'rule',
      _mentions: c.mentions,
      _lexicon: c.lexicon,
      _cueMeasure: c.cueMeasure,
    });
  }

  out.sort((a, b) => b.confidence - a.confidence || b._mentions - a._mentions);
  return out.slice(0, 40);
}

function pushUnique(list, item) {
  const key = normalizeWs(item.text).toLowerCase();
  if (!list.some((x) => normalizeWs(x.text).toLowerCase() === key)) list.push(item);
}

/** Definition sentence first, then the strongest remaining sentences. */
function prioritizeQuotes(c, definition) {
  const quotes = [];
  if (definition) pushUnique(quotes, { text: definition.text, page: definition.page });
  const ordered = [
    ...c.defs,
    ...c.quotes,
  ];
  for (const q of ordered) {
    if (quotes.length >= 5) break;
    pushUnique(quotes, q);
  }
  return quotes;
}
