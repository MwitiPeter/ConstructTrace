import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import { Project } from '../models/Project.js';
import { Paper } from '../models/Paper.js';
import { Construct } from '../models/Construct.js';
import { Suggestion } from '../models/Suggestion.js';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { upload, removeStoredFile } from '../middleware/upload.js';
import { ownedProject, ownedPaper, logEvent } from '../utils/scope.js';
import { extractPdfPages } from '../services/pdf.js';
import { extractPaperConstructs } from '../services/extraction.js';
import { compareProject } from '../services/compare.js';
import {
  downloadPdf,
  removeStoredObject,
  uploadPdf,
  isSupabaseObject,
  usesSupabaseStorage,
} from '../services/storage.js';
import { normalizeWs, splitPages } from '../utils/text.js';

const router = Router();
router.use(requireAuth);

const MAX_TEXT_CHARS = 400000;

async function cleanupUpload(localName, objectName = '') {
  try {
    await removeStoredFile(localName);
    if (isSupabaseObject(objectName)) await removeStoredObject(objectName);
  } catch (cleanupError) {
    // eslint-disable-next-line no-console
    console.error('[upload cleanup] Failed to remove an incomplete PDF upload:', cleanupError.message);
  }
}

/** Auto-run comparison once a project has at least two analyzed papers. */
async function maybeAutoCompare(project) {
  try {
    const analyzed = await Paper.countDocuments({ projectId: project._id, status: 'analyzed' });
    if (analyzed < 2) return null;
    return await compareProject(project);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[autoCompare]', err.message);
    return { error: err.message };
  }
}

const paperSummary = (p, constructCount = 0) => ({
  id: p._id,
  title: p.title,
  authors: p.authors,
  year: p.year,
  sourceType: p.sourceType,
  status: p.status,
  error: p.error,
  pageCount: p.pageCount,
  hasFile: Boolean(p.file?.storedName),
  fileName: p.file?.originalName || '',
  extractedAt: p.extractedAt,
  createdAt: p.createdAt,
  constructCount,
});

/** GET /api/projects/:projectId/papers */
router.get(
  '/projects/:projectId/papers',
  asyncHandler(async (req, res) => {
    const project = await ownedProject(req.user.id, req.params.projectId);
    const papers = await Paper.find({ projectId: project._id }).sort({ createdAt: -1 }).lean();
    const counts = await Construct.aggregate([
      { $match: { paperId: { $in: papers.map((p) => p._id) } } },
      { $group: { _id: '$paperId', n: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.n]));
    res.json({ papers: papers.map((p) => paperSummary(p, countMap.get(String(p._id)) || 0)) });
  })
);

/** POST /api/projects/:projectId/papers — PDF upload (multipart, field "file"). */
router.post(
  '/projects/:projectId/papers',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Attach a PDF file in the "file" field.');

    let project;
    try {
      project = await ownedProject(req.user.id, req.params.projectId);
    } catch (err) {
      await cleanupUpload(req.file.filename);
      throw err;
    }

    let pages = [];
    let buffer;
    try {
      buffer = await fs.promises.readFile(req.file.path);
      const result = await extractPdfPages(buffer);
      pages = result.pages;
      if (!pages.length) throw new Error('no extractable text');
    } catch (err) {
      await cleanupUpload(req.file.filename);
      throw new HttpError(
        422,
        `Could not read text from this PDF (${err.message}). Image-only/scanned PDFs are not supported — use "paste text" instead.`
      );
    }

    const fallbackName = path.basename(req.file.originalname, path.extname(req.file.originalname));
    const title = (normalizeWs(req.body?.title) || fallbackName || 'Untitled paper').slice(0, 300);
    const storedName = usesSupabaseStorage
      ? `papers/${req.user.id}/${Date.now()}-${req.file.filename}`
      : req.file.filename;

    try {
      await uploadPdf(storedName, buffer);
      if (usesSupabaseStorage) await removeStoredFile(req.file.filename);
    } catch (err) {
      await cleanupUpload(req.file.filename, storedName);
      throw new HttpError(502, `Could not store this PDF: ${err.message}`);
    }

    let paper;
    try {
      paper = await Paper.create({
        projectId: project._id,
        userId: req.user.id,
        title,
        authors: String(req.body?.authors || '').slice(0, 500),
        year: String(req.body?.year || '').slice(0, 20),
        sourceType: 'pdf',
        status: 'parsed',
        pageCount: pages.length,
        pages,
        file: {
          originalName: req.file.originalname,
          storedName,
          sizeBytes: req.file.size,
        },
      });
    } catch (err) {
      await cleanupUpload(req.file.filename, storedName);
      throw err;
    }

    await logEvent({
      projectId: project._id,
      paperId: paper._id,
      actorType: 'user',
      userId: req.user.id,
      label: req.user.name,
      action: 'paper.upload',
      message: `${req.user.name} uploaded "${title}" (${pages.length} page${pages.length === 1 ? '' : 's'}).`,
    });

    const extraction = await extractPaperConstructs(paper);
    const comparison = await maybeAutoCompare(project);

    res.status(201).json({
      paper: paperSummary(paper, extraction.created),
      extraction: { provider: extraction.provider, created: extraction.created, dropped: extraction.dropped },
      comparison,
    });
  })
);

/** POST /api/projects/:projectId/papers/text — paste raw text (page markers optional). */
router.post(
  '/projects/:projectId/papers/text',
  asyncHandler(async (req, res) => {
    const project = await ownedProject(req.user.id, req.params.projectId);
    const title = normalizeWs(req.body?.title);
    const text = String(req.body?.text || '');
    if (!title) throw new HttpError(400, 'Missing required field(s): title');
    if (title.length > 300) throw new HttpError(400, 'Title must be at most 300 characters.');
    if (!text.trim()) throw new HttpError(400, 'Missing required field(s): text');
    if (text.length > MAX_TEXT_CHARS) {
      throw new HttpError(400, `Text is too long (max ${MAX_TEXT_CHARS.toLocaleString()} characters).`);
    }

    const pages = splitPages(text);
    if (!pages.length) throw new HttpError(422, 'No text could be read from the supplied content.');

    const paper = await Paper.create({
      projectId: project._id,
      userId: req.user.id,
      title,
      authors: String(req.body?.authors || '').slice(0, 500),
      year: String(req.body?.year || '').slice(0, 20),
      sourceType: 'text',
      status: 'parsed',
      pageCount: pages.length,
      pages,
      file: { originalName: '', storedName: '', sizeBytes: 0 },
    });

    await logEvent({
      projectId: project._id,
      paperId: paper._id,
      actorType: 'user',
      userId: req.user.id,
      label: req.user.name,
      action: 'paper.create',
      message: `${req.user.name} added the text of "${title}" (${pages.length} page${pages.length === 1 ? '' : 's'}).`,
    });

    const extraction = await extractPaperConstructs(paper);
    const comparison = await maybeAutoCompare(project);

    res.status(201).json({
      paper: paperSummary(paper, extraction.created),
      extraction: { provider: extraction.provider, created: extraction.created, dropped: extraction.dropped },
      comparison,
    });
  })
);

/** GET /api/papers/:paperId — full detail including extracted page text. */
router.get(
  '/papers/:paperId',
  asyncHandler(async (req, res) => {
    const paper = await ownedPaper(req.user.id, req.params.paperId);
    const constructs = await Construct.find({ paperId: paper._id }).sort({ confidence: -1 }).lean();
    res.json({ paper: paper.toObject(), constructs });
  })
);

/** GET /api/papers/:paperId/pdf — download the stored PDF (authenticated). */
router.get(
  '/papers/:paperId/pdf',
  asyncHandler(async (req, res) => {
    const paper = await ownedPaper(req.user.id, req.params.paperId);
    if (!paper.file?.storedName) throw new HttpError(404, 'This paper has no stored PDF file.');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${(paper.file.originalName || 'paper.pdf').replace(/["\\]/g, '')}"`
    );
    if (isSupabaseObject(paper.file.storedName)) {
      try {
        const buffer = await downloadPdf(paper.file.storedName);
        res.end(buffer);
      } catch (err) {
        throw new HttpError(404, `Stored PDF file is unavailable: ${err.message}`);
      }
      return;
    }
    const filePath = path.join(env.uploadsDir, path.basename(paper.file.storedName));
    if (!fs.existsSync(filePath)) throw new HttpError(404, 'Stored PDF file is missing.');
    fs.createReadStream(filePath).pipe(res);
  })
);

/** POST /api/papers/:paperId/extract — re-run AI extraction. */
router.post(
  '/papers/:paperId/extract',
  asyncHandler(async (req, res) => {
    const paper = await ownedPaper(req.user.id, req.params.paperId);
    const extraction = await extractPaperConstructs(paper);
    const project = await Project.findById(paper.projectId);
    const comparison = await maybeAutoCompare(project);
    res.json({
      paper: paperSummary(paper, extraction.created),
      extraction: { provider: extraction.provider, created: extraction.created, dropped: extraction.dropped },
      comparison,
    });
  })
);

/** DELETE /api/papers/:paperId — removes paper, its constructs and stale suggestions. */
router.delete(
  '/papers/:paperId',
  asyncHandler(async (req, res) => {
    const paper = await ownedPaper(req.user.id, req.params.paperId);
    const constructIds = await Construct.find({ paperId: paper._id }).select('_id').lean();
    const idList = constructIds.map((c) => c._id);

    if (idList.length) {
      await Suggestion.deleteMany({ constructIds: { $in: idList } });
      await Construct.deleteMany({ paperId: paper._id });
    }
    if (isSupabaseObject(paper.file?.storedName)) {
      await removeStoredObject(paper.file?.storedName);
    } else {
      await removeStoredFile(paper.file?.storedName);
    }
    await Paper.deleteOne({ _id: paper._id });

    await logEvent({
      projectId: paper.projectId,
      actorType: 'user',
      userId: req.user.id,
      label: req.user.name,
      action: 'paper.delete',
      message: `${req.user.name} deleted "${paper.title}" and its extracted constructs.`,
    });

    res.json({ ok: true, deleted: paper.title });
  })
);

export default router;
