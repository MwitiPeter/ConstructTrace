import { Router } from 'express';
import { Project } from '../models/Project.js';
import { Paper } from '../models/Paper.js';
import { Construct } from '../models/Construct.js';
import { Suggestion } from '../models/Suggestion.js';
import { EventLog } from '../models/EventLog.js';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

/** GET /api/dashboard — aggregates across all of the user's projects. */
router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const projects = await Project.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean();
    const ids = projects.map((p) => p._id);

    const [paperRows, constructRows, statusRows, typeRows, recent] = ids.length
      ? await Promise.all([
          Paper.aggregate([
            { $match: { projectId: { $in: ids } } },
            {
              $group: {
                _id: '$projectId',
                total: { $sum: 1 },
                analyzed: { $sum: { $cond: [{ $eq: ['$status', 'analyzed'] }, 1, 0] } },
              },
            },
          ]),
          Construct.aggregate([
            { $match: { projectId: { $in: ids } } },
            { $group: { _id: '$projectId', total: { $sum: 1 } } },
          ]),
          Suggestion.aggregate([
            { $match: { projectId: { $in: ids } } },
            { $group: { _id: '$status', total: { $sum: 1 } } },
          ]),
          Suggestion.aggregate([
            { $match: { projectId: { $in: ids } } },
            { $group: { _id: '$type', total: { $sum: 1 } } },
          ]),
          EventLog.find({ projectId: { $in: ids } }).sort({ createdAt: -1 }).limit(8).lean(),
        ])
      : [[], [], [], [], []];

    const paperMap = new Map(paperRows.map((r) => [String(r._id), r]));
    const constructMap = new Map(constructRows.map((r) => [String(r._id), r.total]));

    const perProject = projects.map((p) => {
      const papers = paperMap.get(String(p._id));
      return {
        id: p._id,
        name: p.name,
        status: p.status,
        papers: papers?.total || 0,
        analyzedPapers: papers?.analyzed || 0,
        constructs: constructMap.get(String(p._id)) || 0,
      };
    });

    const byStatus = Object.fromEntries(statusRows.map((r) => [r._id, r.total]));
    const totals = {
      projects: projects.length,
      papers: perProject.reduce((s, p) => s + p.papers, 0),
      analyzedPapers: perProject.reduce((s, p) => s + p.analyzedPapers, 0),
      constructs: perProject.reduce((s, p) => s + p.constructs, 0),
      pending: byStatus.pending || 0,
      accepted: byStatus.accepted || 0,
      rejected: byStatus.rejected || 0,
      uncertain: byStatus.uncertain || 0,
      edited: byStatus.edited || 0,
      suggestions: Object.values(byStatus).reduce((s, n) => s + n, 0),
    };

    res.json({
      totals,
      perProject: perProject.slice(0, 6),
      suggestionStatus: ['pending', 'uncertain', 'edited', 'accepted', 'rejected'].map((status) => ({
        status,
        count: byStatus[status] || 0,
      })),
      suggestionType: ['jingle', 'jangle'].map((type) => ({
        type,
        count: typeRows.find((r) => r._id === type)?.total || 0,
      })),
      recentActivity: recent,
    });
  })
);

export default router;
