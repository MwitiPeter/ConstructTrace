import { Router } from 'express';
import { Construct } from '../models/Construct.js';
import { Paper } from '../models/Paper.js';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { ownedProject, logEvent } from '../utils/scope.js';
import { locatePage, normalizeName, normalizeWs } from '../utils/text.js';

const router = Router();
router.use(requireAuth);

/** GET /api/projects/:projectId/constructs — constructs with their paper titles. */
router.get(
  '/projects/:projectId/constructs',
  asyncHandler(async (req, res) => {
    const project = await ownedProject(req.user.id, req.params.projectId);
    const [constructs, papers] = await Promise.all([
      Construct.find({ projectId: project._id }).sort({ confidence: -1, name: 1 }).lean(),
      Paper.find({ projectId: project._id }).select('title').lean(),
    ]);
    const titleById = new Map(papers.map((p) => [String(p._id), p.title]));
    res.json({
      constructs: constructs.map((c) => ({ ...c, paperTitle: titleById.get(String(c.paperId)) || 'Unknown paper' })),
      paperTitles: [...titleById.entries()].map(([id, title]) => ({ id, title })),
    });
  })
);

/**
 * PATCH /api/constructs/:constructId — researcher annotation:
 * verify, rename, correct the definition, or add a note.
 * Human edits are marked source:"human" so AI output and human decisions
 * stay distinguishable.
 */
router.patch(
  '/constructs/:constructId',
  asyncHandler(async (req, res) => {
    const construct = await Construct.findById(req.params.constructId);
    if (!construct) throw new HttpError(404, 'Construct not found.');
    await ownedProject(req.user.id, construct.projectId); // authorization

    const body = req.body || {};
    let changed = [];

    if (body.name !== undefined) {
      const name = normalizeWs(body.name);
      if (name.length < 3 || name.length > 200) throw new HttpError(400, 'Name must be 3-200 characters.');
      if (name !== construct.name) {
        construct.name = name;
        construct.normalizedName = normalizeName(name);
        changed.push('name');
      }
    }

    if (body.definitionText !== undefined) {
      const text = normalizeWs(body.definitionText);
      if (!text) {
        construct.definition = null;
        changed.push('definition removed');
      } else {
        if (text.length > 2000) throw new HttpError(400, 'Definition is too long (max 2000 characters).');
        const paper = await Paper.findById(construct.paperId).lean();
        const page = paper ? locatePage(paper.pages || [], text) : null;
        construct.definition = { text, page };
        if (page === null) {
          const note = 'Definition was entered by the researcher and could not be located verbatim in the paper.';
          if (!construct.missingEvidence.includes(note)) construct.missingEvidence.push(note);
        }
        construct.source = 'human';
        changed.push('definition');
      }
    }

    if (body.researcherNote !== undefined) {
      construct.researcherNote = String(body.researcherNote).slice(0, 1000);
      changed.push('note');
    }

    if (body.status !== undefined) {
      if (!['extracted', 'verified', 'edited'].includes(body.status)) throw new HttpError(400, 'Invalid status.');
      construct.status = body.status;
      changed.push('status');
    }

    if (!changed.length) throw new HttpError(400, 'Nothing to update.');

    await construct.save();
    await logEvent({
      projectId: construct.projectId,
      constructId: construct._id,
      actorType: 'user',
      userId: req.user.id,
      label: req.user.name,
      action: 'construct.edit',
      message: `${req.user.name} updated the construct "${construct.name}" (${changed.join(', ')}).`,
    });

    res.json({ construct: construct.toObject() });
  })
);

export default router;
