import test from 'node:test';
import assert from 'node:assert/strict';
import { extractWithRules } from '../src/services/ai/ruleProvider.js';
import { verifyAgainstPaper } from '../src/services/extraction.js';
import { detectSuggestions } from '../src/services/compare.js';
import { diceSimilarity, locatePage, normalizeName, splitPages } from '../src/utils/text.js';
import { SAMPLE_PAPERS } from '../src/sampleData.js';

// ---------------------------------------------------------------------------
// Text utilities
// ---------------------------------------------------------------------------

test('diceSimilarity: identical text = 1, disjoint text = 0', () => {
  const a = 'an emotional state arising from appraisal of the job';
  assert.equal(diceSimilarity(a, a), 1);
  assert.equal(diceSimilarity('quantum chromodynamics lattice', 'banana mango pineapple'), 0);
});

test('normalizeName groups case, hyphen and punctuation variants', () => {
  assert.equal(normalizeName('Job Satisfaction'), normalizeName('job satisfaction'));
  assert.equal(normalizeName('self-efficacy'), normalizeName('Self Efficacy!'));
});

test('splitPages supports markers, form feeds and plain text', () => {
  assert.deepEqual(
    splitPages('--- Page 1 ---\nAlpha\n--- Page 2 ---\nBeta').map((p) => p.page),
    [1, 2]
  );
  assert.equal(splitPages('one page only').length, 1);
  assert.equal(splitPages('A\fB\fC').length, 3);
});

// ---------------------------------------------------------------------------
// Rule-based extraction from real sample papers
// ---------------------------------------------------------------------------

test('rule extraction finds definitions with the real page number', () => {
  const paper = SAMPLE_PAPERS[0];
  const items = extractWithRules({ pages: paper.pages });

  const jobSat = items.find((i) => normalizeName(i.name) === 'job satisfaction');
  assert.ok(jobSat, 'job satisfaction should be extracted');
  assert.ok(jobSat.definition, 'a definition should be captured');
  assert.equal(jobSat.definition.page, 1);
  assert.match(jobSat.definition.text, /emotional state that arises from an individual's appraisal/i);
  assert.ok(jobSat.evidenceQuotes.length >= 1, 'supporting quotations are required');
  // Every quotation must be verbatim from the source pages.
  const fullText = paper.pages.map((p) => p.text).join('\n').replace(/\s+/g, ' ');
  for (const q of jobSat.evidenceQuotes) {
    assert.ok(fullText.includes(q.text.replace(/\s+/g, ' ')), `quote must exist in source: ${q.text}`);
  }
  // Measurement items must also be verbatim.
  assert.ok(jobSat.measurementItems.length >= 1, 'measurement items extracted');
});

test('rule extraction captures the alternate job satisfaction definition (jingle raw material)', () => {
  const paper = SAMPLE_PAPERS[1];
  const items = extractWithRules({ pages: paper.pages });
  const jobSat = items.find((i) => normalizeName(i.name) === 'job satisfaction');
  assert.ok(jobSat?.definition, 'definition present');
  assert.match(jobSat.definition.text, /ratio of accumulated rewards/i);
  assert.equal(jobSat.definition.page, 1);
});

// ---------------------------------------------------------------------------
// Verification guards (anti-hallucination)
// ---------------------------------------------------------------------------

const fakePaper = {
  pages: [
    { page: 1, text: 'Trust in management is defined as a positive expectation of managerial conduct.' },
    { page: 7, text: 'Trust in management correlated with performance.' },
  ],
};

test('verification keeps real evidence and re-locates page numbers', () => {
  const { constructs, dropped } = verifyAgainstPaper(
    [
      {
        name: 'Trust in management',
        definition: { text: 'a positive expectation of managerial conduct', page: 99 },
        evidenceQuotes: [{ text: 'Trust in management correlated with performance.', page: 99 }],
        measurementItems: [{ text: 'I trust my manager to act fairly', page: 3 }],
        confidence: 0.9,
        provider: 'test',
      },
    ],
    fakePaper
  );
  assert.equal(dropped, 0);
  assert.equal(constructs.length, 1);
  const c = constructs[0];
  // Page numbers come from the actual pages, not the model's claim (99).
  assert.equal(c.definition.page, 1);
  assert.equal(c.evidenceQuotes[0].page, 7);
  // Unverifiable measurement item is dropped, and that is reported.
  assert.equal(c.measurementItems.length, 0);
  assert.ok(c.missingEvidence.some((m) => /measurement/i.test(m)));
});

test('verification drops invented constructs, definitions and quotations', () => {
  const { constructs, dropped } = verifyAgainstPaper(
    [
      {
        name: 'Quantum job satisfaction', // not in the paper
        definition: { text: 'a completely fabricated definition sentence' },
        evidenceQuotes: [{ text: 'Another fabricated quotation.' }],
        confidence: 0.9,
        provider: 'test',
      },
      {
        name: 'Trust in management',
        definition: { text: 'a fabricated definition attributed to a real construct' },
        evidenceQuotes: [{ text: 'Trust in management correlated with performance.' }],
        measurementItems: [],
        confidence: 0.9,
        provider: 'test',
      },
    ],
    fakePaper
  );
  // Invented construct name is dropped entirely.
  assert.equal(constructs.length, 1);
  assert.ok(dropped >= 1);
  const c = constructs[0];
  assert.equal(c.normalizedName, 'trust in management');
  // Fabricated definition is not stored; missing evidence is flagged instead.
  assert.equal(c.definition, null);
  assert.ok(c.missingEvidence.some((m) => /definition/i.test(m)));
  // Real quotation survives with its verified page.
  assert.equal(c.evidenceQuotes[0].page, 7);
});

test('locatePage returns null for text that is not in the paper', () => {
  assert.equal(locatePage(fakePaper.pages, 'not there at all'), null);
  assert.equal(locatePage(fakePaper.pages, 'Trust in management correlated with performance.'), 7);
});

// ---------------------------------------------------------------------------
// End-to-end jingle/jangle detection over the sample corpus
// ---------------------------------------------------------------------------

test('detectSuggestions finds the jingle and the jangle in the sample corpus', async () => {
  const enriched = [];
  let n = 0;
  for (const p of SAMPLE_PAPERS) {
    const raw = extractWithRules({ pages: p.pages });
    const { constructs } = verifyAgainstPaper(raw, { pages: p.pages });
    for (const c of constructs) {
      n += 1;
      enriched.push({ ...c, _id: `c${n}`, paperId: `p-${p.title}`, paperTitle: p.title });
    }
  }
  assert.ok(enriched.length >= 4, 'sample corpus should yield several constructs');

  const suggestions = await detectSuggestions(enriched);
  const jingle = suggestions.filter((s) => s.type === 'jingle');
  const jangle = suggestions.filter((s) => s.type === 'jangle');

  // Jingle: "Job satisfaction" defined differently in papers 1 and 2.
  assert.ok(
    jingle.some(
      (s) =>
        s.names.every((name) => normalizeName(name) === 'job satisfaction') &&
        s.evidenceComplete === true
    ),
    'expected a jingle suggestion for job satisfaction'
  );

  // Jangle: job satisfaction vs employee satisfaction.
  assert.ok(
    jangle.some(
      (s) =>
        s.names.map(normalizeName).sort().join('|') ===
        'employee satisfaction|job satisfaction'
    ),
    'expected a jangle suggestion between job satisfaction and employee satisfaction'
  );

  // Every suggestion carries verifiable evidence with real page numbers,
  // an explicit AI interpretation, and a confidence in [0, 1].
  const fullText = SAMPLE_PAPERS.map((p) =>
    p.pages.map((pg) => pg.text).join('\n').replace(/\s+/g, ' ')
  ).join('\n');
  for (const s of suggestions) {
    assert.ok(s.rationale.startsWith('AI interpretation:'), 'interpretations must be labelled');
    assert.ok(s.confidence >= 0 && s.confidence <= 1);
    assert.equal(s.evidence.length, 2);
    for (const ev of s.evidence) {
      assert.ok(ev.quote.length > 10, 'evidence quote present');
      assert.ok(typeof ev.page === 'number' && ev.page >= 1, 'evidence has a real page number');
      assert.ok(fullText.includes(ev.quote.replace(/\s+/g, ' ')), 'evidence quote exists in sources');
    }
  }
});

test('detectSuggestions never pairs constructs that share the same meaning', async () => {
  const constructs = [
    {
      _id: 'a',
      name: 'Team Cohesion',
      normalizedName: 'team cohesion',
      definition: { text: 'the degree of mutual commitment and bonding among team members', page: 1 },
      evidenceQuotes: [],
      paperId: 'p1',
      paperTitle: 'One',
    },
    {
      _id: 'b',
      name: 'Team Cohesion',
      normalizedName: 'team cohesion',
      definition: { text: 'the degree of mutual commitment and bonding among team members', page: 2 },
      evidenceQuotes: [],
      paperId: 'p2',
      paperTitle: 'Two',
    },
  ];
  const suggestions = await detectSuggestions(constructs);
  assert.equal(suggestions.length, 0, 'identical definitions under one name are not a fallacy');
});
