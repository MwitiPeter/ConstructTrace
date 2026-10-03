import { Router } from 'express';
import { Suggestion } from '../models/Suggestion.js';
import { EventLog } from '../models/EventLog.js';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { assertOneOf } from '../middleware/validate.js';
import { ownedProject, ownedSuggestion, logEvent } from '../utils/scope.js';
import { compareProject } from '../services/compare.js';

const router = Router();
router.use(requireAuth);

const STATUS_BY_ACTION = { accept: 'accepted', reject: 'rejected', uncertain: 'uncertain', edit: 'edited' };
const VERB_BY_ACTION = { accept: 'accepted', reject: 'rejected', uncertain: 'marked as uncertain', edit: 'edited' };

/** POST /api/projects/:projectId/compare — run jingle/jangle comparison. */
router.post(
  '/projects/:projectId/compare',
  asyncHandler(async (req, res) => {
    const project = await ownedProject(req.user.id, req.params.projectId);
    const result = await compareProject(project);
    res.json(result);
  })
);

/** GET /api/projects/:projectId/suggestions?status=pending,accepted&type=jingle */
router.get(
  '/projects/:projectId/suggestions',
  asyncHandler(async (req, res) => {
    const project = await ownedProject(req.user.id, req.params.projectId);
    const query = { projectId: project._id };

    if (req.query.status) {
      const statuses = String(req.query.status).split(',').map((s) => s.trim()).filter(Boolean);
      const allowed = ['pending', 'accepted', 'rejected', 'uncertain', 'edited'];
      if (statuses.some((s) => !allowed.includes(s))) throw new HttpError(400, 'Invalid status filter.');
      query.status = { $in: statuses };
    }
    if (req.query.type) {
      const types = String(req.query.type).split(',').map((s) => s.trim()).filter(Boolean);
      if (types.some((t) => !['jingle', 'jangle'].includes(t))) throw new HttpError(400, 'Invalid type filter.');
      query.type = { $in: types };
    }

    const suggestions = await Suggestion.find(query).lean();

    // Pending first, then most recent.
    const order = { pending: 0, uncertain: 1, edited: 2, accepted: 3, rejected: 4 };
    suggestions.sort(
      (a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) ||
        new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json({ suggestions });
  })
);

/** POST /api/suggestions/:suggestionId/decision — accept | reject | uncertain | edit. */
router.post(
  '/suggestions/:suggestionId/decision',
  asyncHandler(async (req, res) => {
    const suggestion = await ownedSuggestion(req.user.id, req.params.suggestionId);
    const action = assertOneOf(req.body?.action, 'action', ['accept', 'reject', 'uncertain', 'edit']);

    const note = String(req.body?.note || '').slice(0, 1000);
    const label = String(req.body?.label || '').slice(0, 200);
    const rationale = String(req.body?.rationale || '').slice(0, 1000);
    if (action === 'edit' && !note && !label && !rationale) {
      throw new HttpError(400, 'Provide a note, label or rationale when editing a suggestion.');
    }

    suggestion.status = STATUS_BY_ACTION[action];
    suggestion.decision = {
      action,
      note,
      label,
      rationale,
      userId: suggestion.decision?.userId ?? undefined,
      userName: req.user.name,
      decidedAt: new Date(),
    };
    suggestion.decision.userId = req.user.id;
    await suggestion.save();

    await logEvent({
      projectId: suggestion.projectId,
      suggestionId: suggestion._id,
      actorType: 'user',
      userId: req.user.id,
      label: req.user.name,
      action: `decision.${action}`,
      message: `${req.user.name} ${VERB_BY_ACTION[action]} the ${suggestion.type} suggestion between "${suggestion.names[0]}" and "${suggestion.names[1]}".`,
      details: { note, label, rationale },
    });

    res.json({ suggestion: suggestion.toObject() });
  })
);

/** GET /api/projects/:projectId/history — full decision + AI action log. */
router.get(
  '/projects/:projectId/history',
  asyncHandler(async (req, res) => {
    const project = await ownedProject(req.user.id, req.params.projectId);
    const events = await EventLog.find({ projectId: project._id }).sort({ createdAt: -1 }).limit(300).lean();
    res.json({ events });
  })
);

export default router;
