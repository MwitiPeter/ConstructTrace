/**
 * Extraction pipeline: provider output -> verified constructs stored in MongoDB.
 *
 * Verification guarantees the AI requirements:
 *  - a construct is kept only if its name really appears in the paper;
 *  - definitions, quotations and measurement items must be verbatim substrings
 *    of the uploaded paper text, otherwise they are dropped or flagged;
 *  - page numbers are always re-located from the extracted page text, never
 *    trusted from the model;
 *  - missing evidence is explicitly recorded on the construct.
 */
import { Construct } from '../models/Construct.js';
import { getProvider } from './ai/index.js';
import { HttpError } from '../middleware/error.js';
import { logEvent } from '../utils/scope.js';
import { locatePage, normalizeName, normalizeWs, splitSentences } from '../utils/text.js';

function locateNamePage(pages, nameKey) {
  for (const p of pages) {
    const hay = ` ${normalizeName(p.text)} `;
    if (hay.includes(` ${nameKey} `)) return p.page;
  }
  return null;
}

function firstMentionSentence(pages, nameKey) {
  for (const p of pages) {
    for (const s of splitSentences(p.text)) {
      const hay = ` ${normalizeName(s)} `;
      if (hay.includes(` ${nameKey} `)) return { text: normalizeWs(s), page: p.page };
    }
  }
  return null;
}

/**
 * Verify raw provider items against the actual paper text.
 * @returns {{ constructs: Array, dropped: number }} constructs ready for persistence
 *         (without projectId/paperId — added by the caller).
 */
export function verifyAgainstPaper(rawItems, paper) {
  const pages = paper.pages || [];
  const byName = new Map();
  let dropped = 0;

  for (const item of rawItems || []) {
    const name = normalizeWs(item.name || '');
    if (name.length < 3 || name.length > 200) {
      dropped += 1;
      continue;
    }
    const nameKey = normalizeName(name);
    if (!nameKey) {
      dropped += 1;
      continue;
    }

    // Guard 1: the construct name must exist in the paper.
    const namePage = locateNamePage(pages, nameKey);
    if (namePage === null) {
      dropped += 1;
      continue;
    }

    const missing = [];

    // Guard 2: definition must be verbatim in the paper; page re-located locally.
    let definition = null;
    const proposedDef = item.definition?.text ? normalizeWs(item.definition.text) : '';
    if (proposedDef) {
      const page = locatePage(pages, proposedDef);
      if (page !== null) definition = { text: proposedDef, page };
      else missing.push('AI-proposed definition could not be verified in the source text.');
    } else {
      missing.push('No explicit definition found in the paper.');
    }

    // Guard 3: quotations must be verbatim; at least one real quote is required.
    const quotes = [];
    for (const q of item.evidenceQuotes || []) {
      const text = normalizeWs(q?.text || '');
      if (!text) continue;
      const page = locatePage(pages, text);
      if (page !== null) pushUnique(quotes, { text, page });
      if (quotes.length >= 5) break;
    }
    if (!quotes.length) {
      const fallbackQuote = firstMentionSentence(pages, nameKey);
      if (fallbackQuote) quotes.push(fallbackQuote);
    }
    if (!quotes.length) {
      dropped += 1; // nothing verifiable at all
      continue;
    }

    // Guard 4: measurement items must be verbatim too.
    const items = [];
    for (const m of item.measurementItems || []) {
      const text = normalizeWs(m?.text || '');
      if (!text) continue;
      const page = locatePage(pages, text);
      if (page !== null) pushUnique(items, { text, page });
      if (items.length >= 8) break;
    }
    if (!items.length) missing.push('No measurement items extracted.');

    const confidence = Number.isFinite(item.confidence)
      ? Math.max(0, Math.min(1, item.confidence))
      : definition
        ? 0.8
        : 0.5;

    const existing = byName.get(nameKey);
    const record = {
      name,
      normalizedName: nameKey,
      definition,
      measurementItems: items,
      evidenceQuotes: quotes,
      confidence,
      provider: item.provider || 'rule',
      source: 'ai',
      status: 'extracted',
      missingEvidence: missing,
      researcherNote: '',
      _namePage: namePage,
    };
    if (!existing || record.confidence > existing.confidence) byName.set(nameKey, record);
    else dropped += 1;
  }

  return { constructs: [...byName.values()], dropped };
}

function pushUnique(list, item) {
  const key = item.text.toLowerCase();
  if (!list.some((x) => x.text.toLowerCase() === key)) list.push(item);
}

/**
 * Run AI extraction for a paper, verify the results, persist constructs and
 * update the paper status. Human-verified/edited constructs are preserved.
 */
export async function extractPaperConstructs(paper) {
  const provider = getProvider();

  let raw;
  try {
    raw = await provider.extractConstructs({ pages: paper.pages, title: paper.title });
  } catch (err) {
    paper.status = 'failed';
    paper.error = err.message;
    await paper.save();
    await logEvent({
      projectId: paper.projectId,
      paperId: paper._id,
      actorType: 'ai',
      label: provider.name,
      action: 'ai.extract.failed',
      message: `AI extraction failed: ${err.message}`,
    });
    throw new HttpError(502, `AI extraction failed: ${err.message}`);
  }

  const { constructs, dropped } = verifyAgainstPaper(raw, paper);

  await Construct.deleteMany({ paperId: paper._id, status: 'extracted' });
  if (constructs.length) {
    await Construct.insertMany(
      constructs.map(({ _namePage, ...c }) => ({
        ...c,
        projectId: paper.projectId,
        paperId: paper._id,
      }))
    );
  }

  paper.status = 'analyzed';
  paper.error = '';
  paper.extractedAt = new Date();
  await paper.save();

  const warnings = constructs.filter((c) => c.missingEvidence.length).length;
  await logEvent({
    projectId: paper.projectId,
    paperId: paper._id,
    actorType: 'ai',
    label: provider.name,
    action: 'ai.extract',
    message: `Extracted ${constructs.length} construct(s) from "${paper.title}"${dropped ? `, dropped ${dropped} unverifiable item(s)` : ''}.`,
    details: { provider: provider.name, dropped, withMissingEvidence: warnings },
  });

  return { provider: provider.name, created: constructs.length, dropped, constructs };
}
