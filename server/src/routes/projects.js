import { Router } from 'express';
import { Project } from '../models/Project.js';
import { Paper } from '../models/Paper.js';
import { Construct } from '../models/Construct.js';
import { Suggestion } from '../models/Suggestion.js';
import { EventLog } from '../models/EventLog.js';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { requireBody, assertLength } from '../middleware/validate.js';
import { ownedProject, logEvent } from '../utils/scope.js';
import { removeStoredFile } from '../middleware/upload.js';
import { isSupabaseObject, removeStoredObject } from '../services/storage.js';
import { constructsToCsv, suggestionsToCsv, buildExportJson } from '../services/export.js';

const router = Router();
router.use(requireAuth);

/** GET /api/projects — list with per-project counts. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const projects = await Project.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean();
    const ids = projects.map((p) => p._id);

    const [paperRows, constructRows, suggRows] = await Promise.all([
      Paper.aggregate([{ $match: { projectId: { $in: ids } } }, { $group: { _id: '$projectId', n: { $sum: 1 } } }]),
      Construct.aggregate([
        { $match: { projectId: { $in: ids } } },
        { $group: { _id: '$projectId', n: { $sum: 1 } } },
      ]),
      Suggestion.aggregate([
        { $match: { projectId: { $in: ids } } },
        { $group: { _id: { projectId: '$projectId', status: '$status' }, n: { $sum: 1 } } },
      ]),
    ]);

    const paperMap = new Map(paperRows.map((r) => [String(r._id), r.n]));
    const constructMap = new Map(constructRows.map((r) => [String(r._id), r.n]));
    const suggMap = new Map();
    for (const r of suggRows) {
      const pid = String(r._id.projectId);
      if (!suggMap.has(pid)) suggMap.set(pid, {});
      suggMap.get(pid)[r._id.status] = r.n;
    }

    res.json({
      projects: projects.map((p) => {
        const byStatus = suggMap.get(String(p._id)) || {};
        const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
        return {
          ...p,
          counts: {
            papers: paperMap.get(String(p._id)) || 0,
            constructs: constructMap.get(String(p._id)) || 0,
            suggestions: {
              ...byStatus,
              pending: byStatus.pending || 0,
              total,
            },
          },
        };
      }),
    });
  })
);

/** POST /api/projects */
router.post(
  '/',
  requireBody(['name']),
  asyncHandler(async (req, res) => {
    const name = assertLength(req.body.name, 'name', 2, 120);
    const description = String(req.body?.description || '').slice(0, 2000);
    const researchQuestion = String(req.body?.researchQuestion || '').slice(0, 2000);
    const project = await Project.create({
      userId: req.user.id,
      name,
      description,
      researchQuestion,
    });
    await logEvent({
      projectId: project._id,
      actorType: 'user',
      userId: req.user.id,
      label: req.user.name,
      action: 'project.create',
      message: `${req.user.name} created the project "${name}".`,
    });
    res.status(201).json({ project: { ...project.toObject(), counts: { papers: 0, constructs: 0, suggestions: { pending: 0, total: 0 } } } });
  })
);

/** GET /api/projects/:id — detail with counts. */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const project = await ownedProject(req.user.id, req.params.id);
    const [papers, constructs, suggRows] = await Promise.all([
      Paper.countDocuments({ projectId: project._id }),
      Construct.countDocuments({ projectId: project._id }),
      Suggestion.aggregate([
        { $match: { projectId: project._id } },
        { $group: { _id: '$status', n: { $sum: 1 } } },
      ]),
    ]);
    const byStatus = {};
    let total = 0;
    for (const r of suggRows) {
      byStatus[r._id] = r.n;
      total += r.n;
    }
    res.json({
      project: project.toObject(),
      counts: {
        papers,
        constructs,
        suggestions: { ...byStatus, pending: byStatus.pending || 0, total },
      },
    });
  })
);

/** PATCH /api/projects/:id */
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const project = await ownedProject(req.user.id, req.params.id);
    if (req.body?.name !== undefined) project.name = assertLength(req.body.name, 'name', 2, 120);
    if (req.body?.description !== undefined) project.description = String(req.body.description).slice(0, 2000);
    if (req.body?.researchQuestion !== undefined)
      project.researchQuestion = String(req.body.researchQuestion).slice(0, 2000);
    if (req.body?.status !== undefined) {
      if (!['active', 'archived'].includes(req.body.status)) throw new HttpError(400, 'Invalid status.');
      project.status = req.body.status;
    }
    await project.save();
    res.json({ project: project.toObject() });
  })
);

/** DELETE /api/projects/:id — cascades to papers, constructs, suggestions, history. */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const project = await ownedProject(req.user.id, req.params.id);
    const papers = await Paper.find({ projectId: project._id }).select('file.storedName').lean();
    for (const p of papers) {
      if (isSupabaseObject(p.file?.storedName)) {
        await removeStoredObject(p.file?.storedName);
      } else {
        await removeStoredFile(p.file?.storedName);
      }
    }

    await Promise.all([
      Paper.deleteMany({ projectId: project._id }),
      Construct.deleteMany({ projectId: project._id }),
      Suggestion.deleteMany({ projectId: project._id }),
      EventLog.deleteMany({ projectId: project._id }),
      Project.deleteOne({ _id: project._id }),
    ]);
    res.json({ ok: true, deleted: project.name });
  })
);

/** GET /api/projects/:id/export?format=json|csv&entity=constructs|suggestions */
router.get(
  '/:id/export',
  asyncHandler(async (req, res) => {
    const project = await ownedProject(req.user.id, req.params.id);
    const format = String(req.query.format || 'json').toLowerCase();
    const entity = String(req.query.entity || 'suggestions').toLowerCase();
    if (!['json', 'csv'].includes(format)) throw new HttpError(400, 'format must be json or csv.');
    if (!['constructs', 'suggestions'].includes(entity))
      throw new HttpError(400, 'entity must be constructs or suggestions.');

    const [constructs, suggestions, events, papers] = await Promise.all([
      Construct.find({ projectId: project._id }).sort({ createdAt: 1 }).lean(),
      Suggestion.find({ projectId: project._id }).sort({ createdAt: 1 }).lean(),
      EventLog.find({ projectId: project._id }).sort({ createdAt: 1 }).limit(500).lean(),
      Paper.find({ projectId: project._id }).select('title createdAt').lean(),
    ]);
    const titleById = new Map(papers.map((p) => [String(p._id), p.title]));
    const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project';

    if (format === 'csv') {
      const csv = entity === 'constructs' ? constructsToCsv(constructs, titleById) : suggestionsToCsv(suggestions);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${slug}-${entity}.csv"`);
      return res.send(csv);
    }
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${slug}-constructtrace-export.json"`
    );
    res.json(
      buildExportJson({
        project,
        constructs,
        suggestions,
        events,
        paperTitles: papers.map((p) => ({ id: p._id, title: p.title, uploadedAt: p.createdAt })),
      })
    );
  })
);

export default router;
