# ConstructTrace

**Evidence-based detection of jingle and jangle fallacies in academic research.**

ConstructTrace helps researchers audit the *constructs* (latent variables) used across papers:

- **Jingle fallacy** — the **same construct name** carries **different meanings** across papers.
- **Jangle fallacy** — **different construct names** carry **similar / equivalent meanings** across papers.

The AI extracts constructs, definitions, measurement items and supporting quotations **from your
uploaded papers**, suggests possible jingle/jangle relationships with **verifiable evidence
(quotation + paper + page number)**, and then **stops**. Nothing is classified automatically:
a researcher must accept, reject, edit, or mark every suggestion as uncertain. Every AI action and
every human decision is recorded in a project history.

Built entirely on **free, self-hostable tools** — no paid APIs, no premium services.

---

## Features

**Authentication & security**
- Register / login / logout with JWT in **http-only cookies** and **bcrypt** password hashing (cost 12)
- Protected API routes, per-user data scoping (other users' projects return 404)
- Rate-limited auth endpoints, input validation, secure PDF upload validation (type + size)
- Security headers, JSON error handling, `.env`-based configuration

**Projects & papers**
- Create, edit, archive and delete research projects
- Upload academic PDFs **or paste plain text** (supports `--- Page N ---` markers)
- PDF text extraction **preserving real page numbers**
- Local file storage with authenticated PDF download

**AI-assisted analysis (modular provider)**
- Extracts construct names, definitions, measurement items and supporting quotations
- **Never invents**: every quote/definition/item must exist verbatim in the uploaded paper, page
  numbers are re-located from the actual extracted pages, invented items are dropped and logged
- Missing or unverifiable evidence is explicitly flagged on each construct
- Extracted facts (blue, verbatim, with page chips) are visually separated from AI
  interpretations (amber, dashed, labelled *"AI interpretation — requires your review"*)
- Providers are swappable via one env var:
  - `rule` (default) — 100% local rule-based extraction + lexical similarity, works offline
  - `hf` — free Hugging Face Inference API (needs `HF_TOKEN`), **auto-falls back to `rule`**
    on any failure (no token, rate limit, model cold-start, offline)

**Comparison & review workflow**
- Jingle detection: same normalized name + dissimilar definitions (or missing definitions)
- Jangle detection: different names + highly similar definitions (synonym groups lower the bar)
- Every suggestion includes: type, confidence meter, similarity score, AI rationale, and two
  verifiable evidence quotations with paper titles and page numbers
- Accept / Reject / Mark uncertain / Edit (corrected label + rationale + note)
- Re-running comparison is **idempotent** and **never overwrites human decisions**
- Full history timeline of AI actions and researcher decisions
- Export to **JSON** and **CSV** (constructs or suggestions), CSV-injection-safe

**Dashboard & UI**
- Stats: projects, papers, analyzed papers, constructs, pending reviews
- Recharts visualizations: papers & constructs per project, suggestions by status and type
- Recent activity feed, responsive layout (mobile drawer + desktop sidebar), loading/empty/error
  states throughout, Lucide icons

---

## Tech stack

| Layer     | Technology |
|-----------|------------|
| Frontend  | React 18, JavaScript, Vite, Tailwind CSS, React Router, Recharts, Lucide React |
| Backend   | Node.js, Express.js, JWT + http-only cookies, bcryptjs, multer, express-rate-limit |
| Database  | MongoDB (Community locally, or free MongoDB Atlas M0) via Mongoose |
| AI        | Local rule-based engine (default) / free Hugging Face Inference API (optional) |
| PDF       | `pdfjs-dist` (Mozilla PDF.js, modern build) with per-page text extraction |
| Tests     | Node built-in test runner (`node --test`), `mongodb-memory-server` for e2e, `puppeteer-core` browser smoke test |

---

## Project structure

```
ConstructTrace/
├── package.json               # root scripts (dev / install:all / seed / test / build)
├── scripts/
│   ├── smoke.mjs             # browser smoke test (real Chrome, screenshots)
│   └── mongo.ps1             # Windows helper: project-local MongoDB start/stop
├── samples/
│   └── ConstructTrace-Sample-Paper.pdf   # generated test paper (npm run make:sample)
├── screenshots/              # smoke-test screenshots
├── README.md
├── server/                    # Express API
│   ├── .env.example           # configuration template
│   ├── src/
│   │   ├── index.js           # bootstrap: connect DB + listen
│   │   ├── app.js             # Express app factory (used by tests too)
│   │   ├── config/            # env + Mongo connection
│   │   ├── models/            # User, Project, Paper, Construct, Suggestion, EventLog
│   │   ├── middleware/        # auth (JWT), validation, upload (multer), errors
│   │   ├── routes/            # auth, projects, papers, constructs, analysis, dashboard
│   │   ├── services/
│   │   │   ├── pdf.js         # PDF → pages with page numbers
│   │   │   ├── extraction.js  # verification pipeline (anti-hallucination guards)
│   │   │   ├── compare.js     # jingle/jangle engine + idempotent persistence
│   │   │   ├── export.js      # CSV / JSON builders
│   │   │   └── ai/            # provider registry, rule provider, HF provider, lexicon
│   │   ├── utils/             # text/similarity helpers, ownership scoping
│   │   ├── sampleData.js      # sample research corpus (seed + tests)
│   │   └── seed.js            # demo user, projects, papers, full pipeline run
│   └── test/                  # unit tests + end-to-end API tests
└── client/                    # React SPA
    ├── vite.config.js         # dev proxy /api → :5000
    └── src/
        ├── api.js             # fetch wrapper (cookies, JSON, friendly errors)
        ├── context/           # AuthContext
        ├── components/        # Layout, UI kit, tabs (Papers/Constructs/Suggestions/History)
        └── pages/             # Login, Dashboard, Projects, ProjectDetail, PaperDetail
```

---

## Quick start

### 1. Prerequisites

- **Node.js 18+** (tested on Node 24)
- **MongoDB** — one of:
  - MongoDB Community Edition running locally, or
  - a free **MongoDB Atlas M0** cluster (any free tier)

### 2. Install

```bash
npm run install:all     # installs server/, client/ and root dependencies
```

### 3. Start MongoDB

Use any MongoDB (Community locally, or a free Atlas cluster — see step 3).

**Windows without a MongoDB service?** A helper uses the binary cached by the test
suite and stores data in `.data/` (no admin rights required):

```bash
npm run mongo:start     # also: mongo:status, mongo:stop
```

### 4. Configure the backend

```bash
cd server
cp .env.example .env
```

Edit `.env`:

```ini
# Local MongoDB
MONGODB_URI=mongodb://127.0.0.1:27017/constructtrace

# — or free MongoDB Atlas —
MONGODB_URI=mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/constructtrace?retryWrites=true&w=majority

JWT_SECRET=put-a-long-random-string-here
```

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 5. Seed sample research data (recommended the first time)

```bash
npm run seed
```

This creates:

- demo user — **demo@constructtrace.app** / **demo1234**
- project *Remote Work & Employee Wellbeing* with 3 sample papers (2 pages each)
- the full AI pipeline run: extraction → verification → comparison, producing a real
  **jingle** suggestion (*Job satisfaction* defined two different ways) and a real **jangle**
  suggestion (*Job satisfaction* ≈ *Employee satisfaction*)
- an empty second project to demonstrate empty states

### 6. Run everything

```bash
npm run dev             # starts API on :5000 and the client on :5173 together
```

Open **http://localhost:5173**, sign in with the demo account (or register), and explore.

Run the pieces separately if you prefer:

```bash
npm run dev --prefix server
npm run dev --prefix client
```

---

## Using the application

1. **Create a project** with a name, description and research question.
2. **Add papers** — upload PDFs or use *Paste text instead* (page markers supported). Text is
   extracted per page; constructs are extracted and verified automatically.
3. **Open the Constructs tab** — inspect every construct's definition, quotations, measurement
   items, page numbers, confidence and flagged evidence gaps. Verify constructs you confirm.
4. **Run comparison** (Suggestions tab) — happens automatically once ≥ 2 papers are analysed.
5. **Review each suggestion** — read the verbatim evidence, then *Accept*, *Reject*, *Edit*, or
   mark it *Uncertain*. Decisions are yours; re-running comparison never overwrites them.
6. **Check the History tab** — every AI action and decision with timestamps.
7. **Export** — JSON (full project) or CSV (constructs / suggestions) from the project header.

---

## AI configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `AI_PROVIDER` | `rule` | `rule` = local, offline, no external calls. `hf` = free Hugging Face API. |
| `HF_TOKEN` | *(empty)* | Hugging Face access token (free tier) — required for `hf`. |
| `HF_MODEL` | `google/gemma-2-2b-it` | Chat model used for extraction. |
| `HF_API_URL` | HF router endpoint | OpenAI-compatible chat completions endpoint. |
| `HF_EMBEDDING_URL` | `all-MiniLM-L6-v2` | Embedding endpoint for definition similarity. |

**Guarantees that hold for every provider**

- Provider output is treated as *candidates only*. The shared verification pipeline
  (`services/extraction.js`) re-checks that the construct name, definition, quotations and items
  exist **verbatim** in the uploaded paper before anything is stored.
- Page numbers are always re-derived from the extracted page text — model-claimed pages are
  ignored.
- Items that cannot be verified are dropped and counted; constructs with gaps get an explicit
  `missingEvidence` list shown in the UI.
- Suggestions are labelled *"AI interpretation — requires your review"* and always require human
  approval. Nothing is auto-classified as equivalent.

---

## Testing

```bash
npm test                # runs server tests
```

- `server/test/analysis.test.js` — unit tests for extraction, verification (anti-hallucination),
  similarity, page locating and jingle/jangle detection over the sample corpus.
- `server/test/api.test.js` — end-to-end tests against the real Express app with an in-memory
  MongoDB (`mongodb-memory-server`): auth, cookies, project/paper creation, extraction,
  comparison, decisions, history, exports and cross-user authorization.
- `scripts/smoke.mjs` — drives the running app in real Chrome (`puppeteer-core`): login, dashboard,
  suggestion review (accept flow), **PDF upload through the UI**, comparison — and captures
  screenshots to `screenshots/`. Requires the app running + `npm run mongo:start`.

```bash
npm test                # 20 unit + e2e API tests
npm run smoke           # browser smoke test (app must be running)
npm run make:sample     # regenerate samples/ConstructTrace-Sample-Paper.pdf
```

> **Windows note:** the in-memory MongoDB needs the
> [VC++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170).
> If it is missing, the e2e tests **skip automatically** (unit tests still run). Alternatively,
> copy `vcruntime140.dll`, `vcruntime140_1.dll`, `msvcp140.dll` and `msvcp140_1.dll` next to the
> cached `mongod-*.exe` (Microsoft's supported *app-local* CRT deployment) — this is exactly what
> `npm run mongo:start` relies on.

---

## API overview

All routes are prefixed with `/api` and require the auth cookie unless noted.

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/auth/register` · `/auth/login` · `/auth/logout` | Session handling (http-only cookie) |
| GET | `/auth/me` | Current user |
| GET/POST | `/projects` | List / create projects (with counts) |
| GET/PATCH/DELETE | `/projects/:id` | Project detail / edit / cascade delete |
| GET | `/projects/:id/export?format=json\|csv&entity=constructs\|suggestions` | Export |
| GET/POST | `/projects/:id/papers` | List / upload PDF (`multipart/form-data`, field `file`) |
| POST | `/projects/:id/papers/text` | Add pasted text with optional page markers |
| GET | `/papers/:id` | Paper + pages + extracted constructs |
| GET | `/papers/:id/pdf` | Download the stored PDF |
| POST | `/papers/:id/extract` | Re-run AI extraction |
| DELETE | `/papers/:id` | Delete paper + dependent constructs/suggestions |
| GET | `/projects/:id/constructs` | Constructs with paper titles |
| PATCH | `/constructs/:id` | Verify / rename / correct definition / note (human source) |
| POST | `/projects/:id/compare` | Run jingle/jangle comparison (idempotent) |
| GET | `/projects/:id/suggestions?status=&type=` | Filter suggestions |
| POST | `/suggestions/:id/decision` | `accept` / `reject` / `uncertain` / `edit` |
| GET | `/projects/:id/history` | Decision + AI action log |
| GET | `/dashboard` | Aggregated stats for the signed-in user |
| GET | `/health` | Liveness check |

---

## Data model

- **User** → owns **Projects**
- **Project** → has **Papers** (pages[] of extracted text), **Constructs**, **Suggestions**,
  **EventLog** entries
- **Construct** — name, normalized name, definition (+page), measurement items (+pages),
  evidence quotes (+pages), confidence, provider, `source: ai|human`, missing-evidence flags
- **Suggestion** — type (`jingle|jangle`), construct pair, similarity score, confidence,
  AI rationale, evidence array, `fingerprint` (unique per project → idempotent runs), status
  (`pending|accepted|rejected|uncertain|edited`) + decision record
- **EventLog** — actor (`ai|user|system`), action, message, details, timestamp

---

## Security notes

- Passwords hashed with bcrypt (12 rounds); generic login error prevents user enumeration
- JWT (7 d) stored only in an http-only, SameSite=Lax cookie; never in localStorage
- Every project/paper/suggestion lookup is scoped to the authenticated owner (404 otherwise)
- Uploads: PDF MIME/extension check, 15 MB limit (configurable), random stored filenames,
  served only through an authenticated route
- Auth rate limiting (30 attempts / 15 min / IP), request size limits, input length validation
- CSV export neutralizes spreadsheet formula injection
- No secrets in code — everything via `.env` (`JWT_SECRET` is the only required one)

## Vercel + Render deployment

Deploy `client/` as a Vite project on Vercel and `server/` as a Node web service on
Render. Use MongoDB Atlas for `MONGODB_URI`.

### Vercel

- Root directory: `client`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_URL=https://<your-render-service>.onrender.com`

`VITE_API_URL` is embedded at build time. Redeploy Vercel after changing it. Keep it
empty for local development, where Vite proxies `/api` to the local server.

### Render

- Root directory: `server`
- Build command: `npm ci`
- Start command: `npm start`
- Health check path: `/api/health`
- Required environment variables: `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`,
  and `CLIENT_ORIGIN=https://<your-vercel-app>.vercel.app`
- For persistent PDF uploads with Supabase Storage, set `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET=papers` in Render.
- If Supabase variables are absent, the backend falls back to local disk storage. On
  Render that storage is ephemeral, so use Supabase for deployed uploads.
- Optional AI variables: `AI_PROVIDER=hf`, `HF_TOKEN`, `HF_MODEL`, `HF_API_URL`, and
  `HF_EMBEDDING_URL`; `AI_PROVIDER=rule` is the default and needs no external token.

Production authentication uses secure cross-site cookies because the frontend and API
are hosted on different domains. Supabase bucket access remains private: the backend
checks paper ownership before downloading or deleting a PDF. Keep
`SUPABASE_SERVICE_ROLE_KEY` only in Render environment variables; never expose it to
the frontend.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `[db] Could not connect to MongoDB` on start | Start local MongoDB (`npm run mongo:start` on Windows without a service) or fix `MONGODB_URI` in `server/.env` (check Atlas IP allowlist `0.0.0.0/0` for free clusters). |
| `Could not read text from this PDF` | The PDF is scanned/image-only (no text layer). Use *Paste text instead* or OCR the PDF first. |
| Port already in use | Change `PORT` in `server/.env` or run client with `npm run dev --prefix client -- --port 5174`. |
| E2E tests skipped on Windows | Install the VC++ Redistributable (see Testing), or use the app-local DLL workaround described there. |
| Hugging Face suggestions not appearing | Check `AI_PROVIDER=hf` **and** `HF_TOKEN` set in `server/.env`; logs show when it falls back to the local provider. |
| Fresh start | `npm run seed` wipes and reseeds the demo project. |

---

## Roadmap / optional extensions

- Optional **Cloudinary** integration for cloud file storage (local storage is the default)
- OCR support for scanned PDFs (e.g. free Tesseract.js)
- Embedded synonym expansion using free sentence embeddings
- Team collaboration and per-project reviewer assignment

---

*All AI output is advisory. Evidence quotations and page numbers are verified against your
uploaded papers; interpretations require researcher approval — ConstructTrace keeps you in
control of every final decision.*
