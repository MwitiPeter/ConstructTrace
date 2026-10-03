/**
 * Browser smoke test: drives the running app in real Chrome via puppeteer-core
 * and captures screenshots to ./screenshots.
 *
 * Prerequisites: MongoDB, API (:5000) and client (:5173) running, database seeded.
 *   npm run seed && npm run dev
 *
 * Run: npm run smoke
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:5173';
const API = 'http://localhost:5000';
const SHOTS = path.join(__dirname, '..', 'screenshots');
const PDF = path.join(__dirname, '..', 'samples', 'ConstructTrace-Sample-Paper.pdf');
fs.mkdirSync(SHOTS, { recursive: true });

const failures = [];
const log = (...a) => console.log('[smoke]', ...a);
const assert = (cond, msg) => {
  console.log(`[smoke] ${cond ? '✔' : '✖'} ${msg}`);
  if (!cond) failures.push(msg);
};

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
const executablePath = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!executablePath) {
  console.error('No Chrome/Edge found — cannot run smoke test.');
  process.exit(1);
}

const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name) });

const clickText = async (page, selector, text, { exact = false } = {}) => {
  const clicked = await page.evaluate(
    (sel, t, ex) => {
      const norm = (s) => s.replace(/\s+/g, ' ').trim();
      const el = [...document.querySelectorAll(sel)].find((e) =>
        ex ? norm(e.textContent) === t : norm(e.textContent).includes(t)
      );
      if (!el) return false;
      el.click();
      return true;
    },
    selector,
    text,
    exact
  );
  if (!clicked) throw new Error(`clickText: no ${selector} containing "${text}"`);
};

const waitForText = (page, text, timeout = 20000) =>
  page.waitForFunction(
    (t) => document.body.innerText.toLowerCase().includes(t.toLowerCase()),
    { timeout },
    text
  );

/** Case-insensitive innerText check (CSS text-transform affects innerText). */
const hasText = async (page, text) =>
  (await page.evaluate(() => document.body.innerText))
    .toLowerCase()
    .includes(text.toLowerCase());

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--window-size=1440,950'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 950 });
page.setDefaultTimeout(20000);

const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e}`));
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(`console: ${m.text()}`);
});

try {
  // ---------------------------------------------------------------- health
  const health = await fetch(`${API}/api/health`).then((r) => r.json());
  assert(health.ok === true, 'API health endpoint responds');

  // Reset demo data so the run is repeatable (fresh pending suggestions).
  log('re-seeding demo data for a repeatable run...');
  execSync('npm run seed', { cwd: path.join(__dirname, '..'), stdio: 'pipe' });
  assert(true, 'database reseeded');

  // ---------------------------------------------------------------- login
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]');
  await shot(page, '01-login.png');

  await page.type('input[type="email"]', 'demo@constructtrace.app');
  await page.type('input[type="password"]', 'demo1234');
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForFunction(() => location.pathname === '/', { timeout: 20000 }),
  ]);
  await waitForText(page, 'Pending reviews');
  await shot(page, '02-dashboard.png');
  assert(true, 'login with seeded demo account reaches the dashboard');
  assert(await hasText(page, 'Constructs'), 'dashboard shows construct statistics');

  // ------------------------------------------------------- seeded project
  await page.goto(`${BASE}/projects`, { waitUntil: 'domcontentloaded' });
  await waitForText(page, 'Remote Work');
  await shot(page, '03-projects.png');

  await clickText(page, 'button', 'Remote Work & Employee Wellbeing');
  await waitForText(page, 'Upload a paper (PDF)');
  await shot(page, '04-project-papers.png');
  assert(true, 'opens seeded project with papers listed');

  await clickText(page, 'button', 'Constructs');
  await waitForText(page, 'Job satisfaction');
  await shot(page, '05-constructs.png');
  assert(await hasText(page, 'p. 1'), 'constructs show verified page numbers');
  assert(
    (await hasText(page, 'missing definition')) || (await hasText(page, 'Definition')),
    'definition column rendered'
  );

  await clickText(page, 'button', 'Suggestions');
  await waitForText(page, 'fallacy');
  await shot(page, '06-suggestions.png');
  assert(await hasText(page, 'Jingle fallacy'), 'jingle suggestion present with evidence');
  assert(await hasText(page, 'Source evidence'), 'evidence quotations rendered');
  assert(await hasText(page, 'AI interpretation'), 'AI interpretation clearly labelled');

  // Researcher decision flow
  await clickText(page, 'button', 'Accept', { exact: true });
  await page.waitForFunction(
    () => {
      const card = document.querySelector('article');
      return card && /accepted/i.test(card.innerText);
    },
    { timeout: 20000 }
  );
  await shot(page, '07-suggestion-accepted.png');
  assert(true, 'accept decision recorded in the UI');

  // ------------------------------------------------------------ PDF upload
  await page.goto(`${BASE}/projects`, { waitUntil: 'domcontentloaded' });
  await waitForText(page, 'New project');
  await clickText(page, 'button', 'New project');
  await page.waitForSelector('input[placeholder*="Remote Work"]');
  await page.type('input[placeholder*="Remote Work"]', 'PDF Pipeline Check');
  await clickText(page, 'button', 'Create project');
  await waitForText(page, 'PDF Pipeline Check');
  await clickText(page, 'button', 'PDF Pipeline Check');
  await waitForText(page, 'Upload a paper (PDF)');

  const fileInput = await page.$('input[type="file"]');
  await fileInput.uploadFile(PDF);
  await clickText(page, 'button', 'Upload & analyse');
  // Wait for the success notice ("Extracted N construct(s) ..."), not the static hint text.
  await page.waitForFunction(
    () => /extracted\s+\d+\s+construct/i.test(document.body.innerText.replace(/\s+/g, ' ')),
    { timeout: 60000 }
  );
  await waitForText(page, 'ConstructTrace-Sample-Paper'); // uploaded paper card
  await shot(page, '08-pdf-uploaded.png');
  assert(await hasText(page, 'ConstructTrace-Sample-Paper'), 'PDF upload extracted constructs automatically');

  await clickText(page, 'button', 'Constructs');
  await waitForText(page, 'Knowledge sharing');
  await shot(page, '09-pdf-constructs.png');
  assert(await hasText(page, 'Team cohesion'), 'PDF constructs include team cohesion');
  assert(
    (await hasText(page, 'p. 2')) || (await hasText(page, 'p. 3')),
    'PDF extraction preserved page numbers'
  );

  await clickText(page, 'button', 'Suggestions');
  await waitForText(page, 'Run comparison');
  await clickText(page, 'button', 'Run comparison');
  await waitForText(page, 'fallacy', 30000);
  await shot(page, '10-pdf-suggestions.png');
  assert(
    (await hasText(page, 'Knowledge sharing')) && (await hasText(page, 'Knowledge exchange')),
    'jangle detected between knowledge sharing and knowledge exchange'
  );

  // ------------------------------------------------------ console hygiene
  // Expected: /api/auth/me returns 401 before login (StrictMode probes twice).
  const relevant = consoleErrors.filter(
    (e) =>
      !/favicon|DevTools|Download the React DevTools/i.test(e) &&
      !/status of 401 \(Unauthorized\)/.test(e)
  );
  assert(relevant.length === 0, `no browser console errors (${relevant.length})`);
  if (relevant.length) console.log(relevant.join('\n'));
} catch (err) {
  failures.push(`exception: ${err.message}`);
  console.error('[smoke] EXCEPTION:', err);
  try {
    console.log('[smoke] page text at failure:',
      (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 600));
    await shot(page, '99-failure.png');
  } catch {
    /* ignore */
  }
} finally {
  await browser.close();
}

console.log('\n[smoke] ------------------------------');
console.log(`[smoke] ${failures.length === 0 ? 'ALL CHECKS PASSED' : `${failures.length} FAILURE(S)`}`);
for (const f of failures) console.log(`[smoke]   - ${f}`);
console.log(`[smoke] screenshots in ${SHOTS}`);
process.exit(failures.length ? 1 : 0);
