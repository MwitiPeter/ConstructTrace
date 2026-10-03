/**
 * End-to-end API tests: real Express app + real MongoDB (in-memory).
 * Skips itself gracefully if the in-memory MongoDB binary is unavailable
 * (e.g. offline machine without the cached binary).
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { buildApp } from '../src/app.js';
import { SAMPLE_PAPERS } from '../src/sampleData.js';

let mongod = null;
let server = null;
let base = '';
let cookie = '';
let unavailable = false;
let projectId = '';
let suggestionId = '';

const guard = (t) => {
  if (unavailable) {
    t.skip('in-memory MongoDB unavailable');
    return true;
  }
  return false;
};

before(async () => {
  try {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri(), { dbName: 'ct-e2e' });
    const app = buildApp();
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve);
    });
    base = `http://127.0.0.1:${server.address().port}`;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[e2e] setup unavailable: ${err.message}`);
    unavailable = true;
  }
}, { timeout: 180000 });

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState) await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

async function req(path, { method = 'GET', body, headers = {}, formData, useCookie = true } = {}) {
  const h = { ...headers };
  if (useCookie && cookie) h.Cookie = cookie;
  if (body) h['Content-Type'] = 'application/json';
  const res = await fetch(base + path, {
    method,
    headers: h,
    body: formData || (body ? JSON.stringify(body) : undefined),
  });
  const raw = await res.text();
  let data = raw;
  try {
    data = JSON.parse(raw);
  } catch {
    /* keep text (CSV) */
  }
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  return { status: res.status, data, headers: res.headers, raw };
}

const asPages = (p) => p.pages.map((pg) => `--- Page ${pg.page} ---\n${pg.text}`).join('\n\n');

test('health endpoint responds', async (t) => {
  if (guard(t)) return;
  const r = await req('/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
});

test('register + login work and set an http-only cookie', async (t) => {
  if (guard(t)) return;
  const r = await req('/api/auth/register', {
    method: 'POST',
    body: { name: 'E2E Tester', email: 'e2e@constructtrace.test', password: 'password123' },
    useCookie: false,
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.user.email, 'e2e@constructtrace.test');
  assert.ok(cookie.startsWith('ct_token='), 'auth cookie set');
  assert.match(r.headers.get('set-cookie') || '', /HttpOnly/i);

  // duplicate email rejected
  const dup = await req('/api/auth/register', {
    method: 'POST',
    body: { name: 'Copy', email: 'e2e@constructtrace.test', password: 'password123' },
    useCookie: false,
  });
  assert.equal(dup.status, 409);

  // bad password rejected (generic message)
  cookie = '';
  const bad = await req('/api/auth/login', {
    method: 'POST',
    body: { email: 'e2e@constructtrace.test', password: 'wrong-password' },
    useCookie: false,
  });
  assert.equal(bad.status, 401);
  assert.match(bad.data.error, /Invalid email or password/);

  const ok = await req('/api/auth/login', {
    method: 'POST',
    body: { email: 'e2e@constructtrace.test', password: 'password123' },
    useCookie: false,
  });
  assert.equal(ok.status, 200);
});

test('protected routes reject unauthenticated requests', async (t) => {
  if (guard(t)) return;
  const r = await req('/api/projects', { useCookie: false });
  assert.equal(r.status, 401);
});

test('create project and paste two sample papers (extraction runs)', async (t) => {
  if (guard(t)) return;
  const p = await req('/api/projects', {
    method: 'POST',
    body: { name: 'E2E Review', description: 'end to end', researchQuestion: 'Same names, same meanings?' },
  });
  assert.equal(p.status, 201);
  projectId = p.data.project._id;

  // Paper 1 — job satisfaction (definition A)
  const first = await req(`/api/projects/${projectId}/papers/text`, {
    method: 'POST',
    body: {
      title: SAMPLE_PAPERS[0].title,
      authors: SAMPLE_PAPERS[0].authors,
      year: SAMPLE_PAPERS[0].year,
      text: asPages(SAMPLE_PAPERS[0]),
    },
  });
  assert.equal(first.status, 201);
  assert.ok(first.data.extraction.created >= 1, 'constructs extracted from paper 1');
  assert.equal(first.data.paper.status, 'analyzed');

  // Paper 2 — job satisfaction (definition B) triggers auto-comparison
  const second = await req(`/api/projects/${projectId}/papers/text`, {
    method: 'POST',
    body: {
      title: SAMPLE_PAPERS[1].title,
      authors: SAMPLE_PAPERS[1].authors,
      year: SAMPLE_PAPERS[1].year,
      text: asPages(SAMPLE_PAPERS[1]),
    },
  });
  assert.equal(second.status, 201);
  assert.ok(second.data.extraction.created >= 1, 'constructs extracted from paper 2');
  assert.ok(second.data.comparison, 'auto-comparison ran after the second paper');
  assert.ok(second.data.comparison.created >= 1, 'a jingle suggestion was created');
});

test('suggestions carry verified evidence, pages and confidence', async (t) => {
  if (guard(t)) return;
  const r = await req(`/api/projects/${projectId}/suggestions?status=pending`);
  assert.equal(r.status, 200);
  assert.ok(r.data.suggestions.length >= 1, 'at least one pending suggestion');

  const s = r.data.suggestions[0];
  suggestionId = s._id;
  assert.ok(['jingle', 'jangle'].includes(s.type));
  assert.ok(s.confidence >= 0 && s.confidence <= 1);
  assert.match(s.rationale, /^AI interpretation:/);
  assert.equal(s.evidence.length, 2);
  for (const ev of s.evidence) {
    assert.ok(ev.quote.length > 10);
    assert.equal(typeof ev.page, 'number');
    assert.ok(ev.page >= 1);
    assert.ok(ev.paperTitle);
  }
});

test('researcher decision updates status, history and survives re-comparison', async (t) => {
  if (guard(t)) return;
  const d = await req(`/api/suggestions/${suggestionId}/decision`, {
    method: 'POST',
    body: { action: 'accept', note: 'Definitions clearly differ.' },
  });
  assert.equal(d.status, 200);
  assert.equal(d.data.suggestion.status, 'accepted');
  assert.equal(d.data.suggestion.decision.userName, 'E2E Tester');

  // Invalid action rejected
  const bad = await req(`/api/suggestions/${suggestionId}/decision`, {
    method: 'POST',
    body: { action: 'obliterate' },
  });
  assert.equal(bad.status, 400);

  // Re-running comparison must not reset the human decision.
  const again = await req(`/api/projects/${projectId}/compare`, { method: 'POST' });
  assert.equal(again.status, 200);
  assert.equal(again.data.created, 0, 'no duplicate suggestions created');

  const accepted = await req(`/api/projects/${projectId}/suggestions?status=accepted`);
  assert.equal(accepted.data.suggestions.length, 1, 'decision persisted across re-comparison');
});

test('history records both AI actions and researcher decisions', async (t) => {
  if (guard(t)) return;
  const r = await req(`/api/projects/${projectId}/history`);
  assert.equal(r.status, 200);
  const actions = r.data.events.map((e) => e.action);
  assert.ok(actions.includes('ai.extract'), 'AI extraction logged');
  assert.ok(actions.includes('ai.compare'), 'AI comparison logged');
  assert.ok(actions.includes('decision.accept'), 'researcher decision logged');
  const ai = r.data.events.find((e) => e.action === 'ai.extract');
  assert.ok(ai.label, 'AI provider label recorded');
});

test('dashboard reports totals', async (t) => {
  if (guard(t)) return;
  const r = await req('/api/dashboard');
  assert.equal(r.status, 200);
  assert.equal(r.data.totals.projects, 1);
  assert.ok(r.data.totals.papers >= 2);
  assert.ok(r.data.totals.constructs >= 2);
  assert.equal(r.data.totals.accepted, 1);
  assert.ok(r.data.recentActivity.length >= 1);
});

test('CSV and JSON exports include real evidence', async (t) => {
  if (guard(t)) return;
  const csv = await req(`/api/projects/${projectId}/export?format=csv&entity=suggestions`);
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type') || '', /text\/csv/);
  assert.match(csv.raw, /jingle|jangle/);
  assert.match(csv.raw, /job satisfaction/i);

  const json = await req(`/api/projects/${projectId}/export?format=json`);
  assert.equal(json.status, 200);
  assert.ok(Array.isArray(json.data.constructs));
  assert.ok(json.data.suggestions.length >= 1);
  assert.ok(json.data.history.length >= 1);
  assert.match(json.data.disclaimer, /advisory/i);
});

test("other users cannot see or touch someone else's project", async (t) => {
  if (guard(t)) return;
  const mainCookie = cookie;

  const r = await req('/api/auth/register', {
    method: 'POST',
    body: { name: 'Other User', email: 'other@constructtrace.test', password: 'password123' },
    useCookie: false,
  });
  assert.equal(r.status, 201); // cookie now set to the other user

  const forbidden = await req(`/api/projects/${projectId}`);
  assert.equal(forbidden.status, 404, 'foreign project is invisible');

  const del = await req(`/api/projects/${projectId}`, { method: 'DELETE' });
  assert.equal(del.status, 404, 'foreign project cannot be deleted');

  cookie = mainCookie;
  const mine = await req(`/api/projects/${projectId}`);
  assert.equal(mine.status, 200, 'original owner still has access');
});
