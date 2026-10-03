import { toCsv } from '../utils/text.js';

export function constructsToCsv(constructs, titleById = new Map()) {
  const headers = [
    'construct_name',
    'paper',
    'definition',
    'definition_page',
    'measurement_items',
    'measurement_pages',
    'evidence_pages',
    'confidence',
    'source',
    'provider',
    'status',
    'missing_evidence',
    'researcher_note',
  ];
  const rows = constructs.map((c) => [
    c.name,
    titleById.get(String(c.paperId)) || '',
    c.definition?.text || '',
    c.definition?.page ?? '',
    (c.measurementItems || []).map((i) => i.text).join(' | '),
    [...new Set((c.measurementItems || []).map((i) => i.page))].join(' '),
    [...new Set((c.evidenceQuotes || []).map((q) => q.page))].join(' '),
    c.confidence,
    c.source,
    c.provider,
    c.status,
    (c.missingEvidence || []).join(' | '),
    c.researcherNote || '',
  ]);
  return toCsv(headers, rows);
}

export function suggestionsToCsv(suggestions) {
  const headers = [
    'type',
    'status',
    'construct_a',
    'construct_b',
    'paper_a',
    'paper_b',
    'page_a',
    'page_b',
    'similarity_score',
    'confidence',
    'evidence_complete',
    'ai_provider',
    'ai_interpretation',
    'evidence_quotes',
    'decision_note',
    'decided_by',
    'decided_at',
  ];
  const rows = suggestions.map((s) => {
    const [evA, evB] = s.evidence || [];
    return [
      s.type,
      s.status,
      s.names?.[0] || '',
      s.names?.[1] || '',
      evA?.paperTitle || '',
      evB?.paperTitle || '',
      evA?.page ?? '',
      evB?.page ?? '',
      s.score,
      s.confidence,
      s.evidenceComplete ? 'yes' : 'no',
      s.aiProvider,
      s.rationale,
      (s.evidence || []).map((e) => `[p.${e.page ?? '?'}] ${e.quote}`).join(' || '),
      s.decision?.note || '',
      s.decision?.userName || '',
      s.decision?.decidedAt ? new Date(s.decision.decidedAt).toISOString() : '',
    ];
  });
  return toCsv(headers, rows);
}

export function buildExportJson({ project, constructs, suggestions, events, paperTitles }) {
  return {
    exportedAt: new Date().toISOString(),
    application: 'ConstructTrace',
    project: {
      id: project._id,
      name: project.name,
      description: project.description,
      researchQuestion: project.researchQuestion,
      createdAt: project.createdAt,
    },
    papers: paperTitles,
    constructs: constructs.map((c) => ({
      id: c._id,
      name: c.name,
      paper: paperTitles.find((p) => String(p.id) === String(c.paperId))?.title || '',
      definition: c.definition,
      measurementItems: c.measurementItems,
      evidenceQuotes: c.evidenceQuotes,
      confidence: c.confidence,
      source: c.source,
      provider: c.provider,
      status: c.status,
      missingEvidence: c.missingEvidence,
      researcherNote: c.researcherNote,
    })),
    suggestions: suggestions.map((s) => ({
      id: s._id,
      type: s.type,
      status: s.status,
      names: s.names,
      score: s.score,
      confidence: s.confidence,
      evidenceComplete: s.evidenceComplete,
      aiProvider: s.aiProvider,
      aiInterpretation: s.rationale,
      evidence: s.evidence,
      decision: s.decision?.action
        ? {
            action: s.decision.action,
            note: s.decision.note,
            label: s.decision.label,
            decidedBy: s.decision.userName,
            decidedAt: s.decision.decidedAt,
          }
        : null,
      createdAt: s.createdAt,
    })),
    history: (events || []).map((e) => ({
      at: e.createdAt,
      actor: e.actorType,
      label: e.label,
      action: e.action,
      message: e.message,
    })),
    disclaimer:
      'All AI output is advisory. Evidence quotations and page numbers are verified against the uploaded papers; interpretations are marked as AI interpretation and require researcher approval.',
  };
}
