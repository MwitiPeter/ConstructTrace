/**
 * Jingle / jangle comparison engine.
 *
 * - Jingle: the SAME construct name carries DIFFERENT definitions across papers.
 * - Jangle: DIFFERENT construct names carry SIMILAR definitions across papers.
 *
 * The engine only *suggests* possible relationships with a confidence value and
 * always attaches verifiable evidence (quotation, paper, page). Nothing is
 * finalized automatically — a researcher must accept/reject/edit every
 * suggestion. Re-running comparison is idempotent (fingerprinted) and never
 * overwrites previous human decisions.
 */
import { Construct } from '../models/Construct.js';
import { Paper } from '../models/Paper.js';
import { Suggestion } from '../models/Suggestion.js';
import { getProvider } from './ai/index.js';
import { areSynonyms } from './ai/lexicon.js';
import { logEvent } from '../utils/scope.js';
import { clamp, diceSimilarity, fingerprint, normalizeName } from '../utils/text.js';

const JINGLE_MAX = 0.55; // same name + definition similarity below this = jingle risk
const JANGLE_MIN = 0.62; // different names + similarity at/above this = jangle risk
const JANGLE_SYN_MIN = 0.3; // lower bar for known synonymous labels

function evidenceFor(c) {
  const base = {
    constructId: c._id ?? c.id ?? null,
    name: c.name,
    paperId: c.paperId ?? null,
    paperTitle: c.paperTitle || '',
  };
  if (c.definition?.text) return { ...base, quote: c.definition.text, page: c.definition.page ?? null };
  const q = (c.evidenceQuotes || [])[0];
  return { ...base, quote: q?.text || '', page: q?.page ?? null };
}

/**
 * Pure detection over verified constructs (no database access).
 * @param {Array} constructs enriched with `paperTitle`
 * @param {(a:string,b:string)=>Promise<number>|number} similarityFn
 * @returns {Promise<Array>} suggestion DTOs (without persistence fields)
 */
export async function detectSuggestions(constructs, similarityFn = (a, b) => diceSimilarity(a, b)) {
  const list = (constructs || []).map((c) => ({
    ...c,
    key: c.normalizedName || normalizeName(c.name),
  }));
  const out = [];

  // --- Jingle: same normalized name, different definitions -------------------
  const groups = new Map();
  for (const c of list) {
    if (!groups.has(c.key)) groups.set(c.key, []);
    groups.get(c.key).push(c);
  }
  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = group[i];
        const b = group[j];
        const defA = a.definition?.text || '';
        const defB = b.definition?.text || '';
        const hasBoth = Boolean(defA && defB);

        if (hasBoth) {
          const score = Number(await similarityFn(defA, defB));
          if (score >= JINGLE_MAX) continue; // same meaning under one name — consistent
          const confidence = clamp(0.55 + (JINGLE_MAX - score) * 0.9, 0.5, 0.95);
          out.push({
            type: 'jingle',
            constructIds: [a._id ?? a.id, b._id ?? b.id].filter(Boolean),
            names: [a.name, b.name],
            paperIds: [a.paperId, b.paperId].filter(Boolean),
            score: round2(score),
            confidence: round2(confidence),
            rationale: `AI interpretation: both constructs are named "${a.name}" / "${b.name}", but their definitions share only ${Math.round(score * 100)}% of their content wording. The same label may represent different meanings in these papers.`,
            evidence: [evidenceFor(a), evidenceFor(b)],
            evidenceComplete: true,
          });
        } else {
          const missing = [!defA ? a.name : null, !defB ? b.name : null].filter(Boolean);
          out.push({
            type: 'jingle',
            constructIds: [a._id ?? a.id, b._id ?? b.id].filter(Boolean),
            names: [a.name, b.name],
            paperIds: [a.paperId, b.paperId].filter(Boolean),
            score: 0,
            confidence: 0.4,
            rationale: `AI interpretation: both constructs use the name "${a.name}", but no definition could be located for ${missing.join(' and ')}. Evidence is incomplete — check the source pages before deciding.`,
            evidence: [evidenceFor(a), evidenceFor(b)],
            evidenceComplete: false,
          });
        }
      }
    }
  }

  // --- Jangle: different names, similar definitions --------------------------
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i];
      const b = list[j];
      if (a.key === b.key) continue; // handled by jingle
      const defA = a.definition?.text || '';
      const defB = b.definition?.text || '';
      if (!defA || !defB) continue; // similarity requires both definitions

      const score = Number(await similarityFn(defA, defB));
      const syn = areSynonyms(a.key, b.key);
      const threshold = syn ? JANGLE_SYN_MIN : JANGLE_MIN;
      if (score < threshold) continue;

      const confidence = clamp(0.5 + (score - threshold) * 1.1 + (syn ? 0.05 : 0), 0.5, 0.95);
      out.push({
        type: 'jangle',
        constructIds: [a._id ?? a.id, b._id ?? b.id].filter(Boolean),
        names: [a.name, b.name],
        paperIds: [a.paperId, b.paperId].filter(Boolean),
        score: round2(score),
        confidence: round2(confidence),
        rationale: `AI interpretation: "${a.name}" and "${b.name}" are named differently, but their definitions share ${Math.round(score * 100)}% of their content wording${syn ? ' and are known synonymous labels' : ''}. They may represent the same underlying construct.`,
        evidence: [evidenceFor(a), evidenceFor(b)],
        evidenceComplete: true,
      });
    }
  }

  return out;
}

const round2 = (n) => Math.round(n * 100) / 100;

/** Run (or re-run) comparison for a project and persist new suggestions. */
export async function compareProject(project) {
  const constructs = await Construct.find({ projectId: project._id }).lean();
  if (constructs.length < 2) {
    return { created: 0, skipped: 0, total: 0, reason: 'needs_at_least_two_constructs' };
  }

  const paperIds = [...new Set(constructs.map((c) => String(c.paperId)))];
  const papers = await Paper.find({ projectId: project._id, _id: { $in: paperIds } }).lean();
  const titleById = new Map(papers.map((p) => [String(p._id), p.title]));

  const enriched = constructs.map((c) => ({
    ...c,
    paperTitle: titleById.get(String(c.paperId)) || 'Unknown paper',
  }));

  const provider = getProvider();
  const dtos = await detectSuggestions(enriched, provider.similarity);

  let created = 0;
  let skipped = 0;
  for (const dto of dtos) {
    const ids = dto.constructIds.map(String).sort().join(',');
    const fp = fingerprint(project._id.toString(), dto.type, ids);
    try {
      const res = await Suggestion.updateOne(
        { projectId: project._id, fingerprint: fp },
        {
          $setOnInsert: {
            ...dto,
            projectId: project._id,
            fingerprint: fp,
            aiProvider: provider.name,
            status: 'pending',
            decision: null,
          },
        },
        { upsert: true }
      );
      if (res.upsertedCount) created += 1;
      else skipped += 1;
    } catch (err) {
      if (err?.code === 11000) skipped += 1;
      else throw err;
    }
  }

  const jingle = dtos.filter((d) => d.type === 'jingle').length;
  await logEvent({
    projectId: project._id,
    actorType: 'ai',
    label: provider.name,
    action: 'ai.compare',
    message: `Comparison finished: ${created} new suggestion(s) (${jingle} jingle, ${dtos.length - jingle} jangle), ${skipped} already known.`,
    details: { created, skipped, total: dtos.length, jingle, jangle: dtos.length - jingle },
  });

  return { created, skipped, total: dtos.length };
}
