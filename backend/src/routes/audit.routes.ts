import { Router } from 'express';
import { AuditLog } from '../models';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';

export const auditRouter = Router();
auditRouter.use(requireAuth);

auditRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { caseId, event } = req.query;
    const limit = Math.min(Number(req.query.limit ?? 200), 500);
    const filter: Record<string, unknown> = {};
    if (typeof caseId === 'string' && caseId) filter.caseId = caseId;
    if (typeof event === 'string' && event) filter.event = event;

    const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ logs });
  })
);
