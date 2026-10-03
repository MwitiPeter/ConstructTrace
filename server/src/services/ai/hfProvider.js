/**
 * Free Hugging Face provider.
 *
 * Uses the free Inference API (chat completions + embeddings). Every model
 * output is treated as a *candidate* only: the shared verification step in
 * services/extraction.js re-locates all definitions, quotes and items inside
 * the actual uploaded paper text and drops anything that cannot be found, so
 * the model can never invent quotations, page numbers or definitions.
 *
 * Any API failure (no token, rate limit, model cold-start, offline) falls back
 * transparently to the local rule-based provider.
 */
import { env } from '../../config/env.js';
import { diceSimilarity, normalizeWs } from '../../utils/text.js';

const SYSTEM_PROMPT =
  'You are a meticulous academic research assistant. You only report information that is literally present in the supplied text. You never invent quotations, definitions, page numbers or citations. When information is absent you answer NONE.';

const USER_PROMPT = (text) => `Extract the research constructs (latent variables / measured concepts) from the paper below.

Return one line per construct, exactly in this format:
NAME | DEFINITION | MEASUREMENT ITEM

Rules:
- NAME: the construct name as written in the paper.
- DEFINITION: the paper's own definition sentence, copied verbatim from the text, or NONE.
- MEASUREMENT ITEM: measurement items explicitly listed in the text, separated by semicolons, or NONE.
- Use NONE whenever something is not present. Do not paraphrase definitions.

PAPER TEXT:
${text}`;

async function fetchWithTimeout(url, options, ms = 25000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

const NONE = /^(none|n\/?a|-|not\s+found|unknown)$/i;

async function chatCompletion(userPrompt) {
  const res = await fetchWithTimeout(env.hfApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(env.hfToken ? { Authorization: `Bearer ${env.hfToken}` } : {}),
    },
    body: JSON.stringify({
      model: env.hfModel,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0,
      max_tokens: 1200,
    }),
  });
  if (!res.ok) throw new Error(`Hugging Face API responded ${res.status}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || !content.trim()) throw new Error('Empty model response');
  return content;
}

function parseExtraction(content) {
  const out = [];
  for (const rawLine of content.split('\n')) {
    const line = rawLine.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim();
    if (!line || /^\s*(?:name|construct)\s*\|/i.test(line)) continue;
    const parts = line.split('|').map((p) => normalizeWs(p));
    const [name, definition, measurement] = parts;
    if (!name || NONE.test(name) || name.length > 200) continue;
    out.push({
      name,
      definition: definition && !NONE.test(definition) && definition.length > 15 ? { text: definition } : null,
      measurementItems:
        measurement && !NONE.test(measurement)
          ? measurement
              .split(/[;•]/)
              .map((s) => normalizeWs(s))
              .filter((s) => s.length >= 5)
              .map((text) => ({ text }))
          : [],
      evidenceQuotes: [], // verification step supplies real quotes from the paper
      confidence: definition ? 0.85 : 0.7,
      provider: 'hf',
    });
  }
  return out;
}

async function embedPair(a, b) {
  const res = await fetchWithTimeout(env.hfEmbeddingUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(env.hfToken ? { Authorization: `Bearer ${env.hfToken}` } : {}),
    },
    body: JSON.stringify({ inputs: [a, b] }),
  });
  if (!res.ok) throw new Error(`Embedding API responded ${res.status}`);
  const data = await res.json();
  const vecs = Array.isArray(data) ? data.map((d) => (Array.isArray(d) ? d : d.embedding)) : [data.embedding];
  if (vecs.length < 2 || !vecs.every(Array.isArray)) throw new Error('Unexpected embedding payload');
  return vecs;
}

function cosine(u, v) {
  let dot = 0;
  let nu = 0;
  let nv = 0;
  for (let i = 0; i < u.length; i += 1) {
    dot += u[i] * v[i];
    nu += u[i] * u[i];
    nv += v[i] * v[i];
  }
  if (!nu || !nv) return 0;
  return Math.max(0, Math.min(1, dot / (Math.sqrt(nu) * Math.sqrt(nv))));
}

/**
 * @param {{name:string, extractConstructs:Function, similarity:Function}} fallback local provider
 */
export function createHfProvider(fallback) {
  return {
    name: 'hf',
    async extractConstructs(input) {
      try {
        const marker = (input.pages || [])
          .map((p) => `[Page ${p.page}]\n${p.text}`)
          .join('\n\n')
          .slice(0, 14000);
        const content = await chatCompletion(USER_PROMPT(marker));
        const parsed = parseExtraction(content);
        if (!parsed.length) throw new Error('Model returned no usable constructs');
        return parsed;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[ai] Hugging Face unavailable (${err.message}); using local rule-based extraction.`);
        const out = await fallback.extractConstructs(input);
        return out.map((item) => ({ ...item, fallback: true }));
      }
    },
    async similarity(a, b) {
      try {
        const [va, vb] = await embedPair(a, b);
        return cosine(va, vb);
      } catch {
        return diceSimilarity(a, b);
      }
    },
  };
}
