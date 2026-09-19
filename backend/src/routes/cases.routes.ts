import { Router } from 'express';
import { z } from 'zod';
import { AuditLog, Customer, Escalation, Notification, SupportCase, Transaction } from '../models';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/error';
import { newCaseId } from '../services/ids';
import { recordAudit } from '../services/audit.service';
import { runAutonomousCase } from '../services/workflow/runCase';
import { env, isCogneeConfigured, isGeminiConfigured, isN8nConfigured } from '../config/env';
import { collaborateOnCase } from '../services/ai/multiAgent';

export const casesRouter = Router();
casesRouter.use(requireAuth);

const createSchema = z.object({
  customerId: z.string().min(1),
  transactionId: z.string().min(1).optional(),
  caseName: z.string().min(3).max(160).optional(),
  issue: z.string().min(5).max(2000),
  source: z.enum(['EMAIL', 'CUSTOMER_PORTAL', 'AGENT', 'SYSTEM']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
});

casesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const cases = await SupportCase.find(status ? { status } : {})
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ cases });
  })
);

casesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);

    const customer = await Customer.findOne({ customerId: body.customerId }).lean();
    if (!customer) throw new HttpError(404, `No customer with id ${body.customerId}.`);

    let merchantId: string | undefined;
    if (body.transactionId) {
      const txn = await Transaction.findOne({ transactionId: body.transactionId }).lean();
      if (!txn) throw new HttpError(404, `No transaction with id ${body.transactionId}.`);
      if (txn.customerId !== body.customerId) {
        throw new HttpError(400, 'That transaction belongs to a different customer.');
      }
      merchantId = txn.merchantId;
    }

    const caseId = newCaseId();
    const created = await SupportCase.create({
      caseId,
      customerId: body.customerId,
      merchantId,
      transactionId: body.transactionId,
      caseName: body.caseName ?? body.issue.slice(0, 80),
      issue: body.issue,
      source: body.source ?? 'AGENT',
      aiTeammate: { id: 'payment-resolution', name: 'Payment Resolution Teammate', specialty: 'Payment & order resolution', status: 'IDLE' },
      lifecycle: [{ stage: 'UNDERSTAND', status: 'COMPLETED', title: 'Case understood', detail: 'Case accepted and ready for autonomous investigation.', actor: 'AI_ORCHESTRATOR' }],
      priority: body.priority ?? 'MEDIUM',
      status: 'OPEN',
      createdBy: req.user?.email ?? 'system',
    });

    await recordAudit({
      caseId,
      event: 'CASE_CREATED',
      actor: req.user?.email ?? 'system',
      actorType: 'HUMAN',
      summary: `Case opened: ${body.issue.slice(0, 120)}`,
      detail: { customerId: body.customerId, transactionId: body.transactionId },
      outcome: 'SUCCESS',
    });

    res.status(201).json({ case: created.toObject() });
  })
);

casesRouter.get(
  '/:caseId',
  asyncHandler(async (req, res) => {
    const caseId = String(req.params.caseId);
    const supportCase = await SupportCase.findOne({ caseId }).lean();
    if (!supportCase) throw new HttpError(404, `No case with id ${caseId}.`);

    const [customer, transaction, auditTrail, escalation, notifications] = await Promise.all([
      Customer.findOne({ customerId: supportCase.customerId }).lean(),
      supportCase.transactionId ? Transaction.findOne({ transactionId: supportCase.transactionId }).lean() : null,
      AuditLog.find({ caseId }).sort({ createdAt: 1 }).lean(),
      Escalation.findOne({ caseId }).sort({ createdAt: -1 }).lean(),
      Notification.find({ caseId }).sort({ createdAt: 1 }).lean(),
    ]);

    res.json({ case: supportCase, customer, transaction, auditTrail, escalation, notifications });
  })
);

/** Hands the case to the autonomous teammate. */
casesRouter.post(
  '/:caseId/resolve',
  asyncHandler(async (req, res) => {
    const caseId = String(req.params.caseId);
    const supportCase = await SupportCase.findOne({ caseId });
    if (!supportCase) throw new HttpError(404, `No case with id ${caseId}.`);
    if (['RESOLVED', 'CLOSED'].includes(String(supportCase.status))) {
      throw new HttpError(409, 'This case is already closed.');
    }

    const outcome = await runAutonomousCase({
      caseId,
      caller: { type: 'AI', identifier: 'AI_ORCHESTRATOR', role: 'AI' },
    });
    const updated = await SupportCase.findOne({ caseId }).lean();
    res.json({ outcome, case: updated });
  })
);

casesRouter.post('/:caseId/collaborate', asyncHandler(async (req, res) => {
  const caseId = String(req.params.caseId);
  const result = await collaborateOnCase(caseId);
  await SupportCase.updateOne({ caseId }, { $set: { collaboration: result } });
  res.json({ caseId, collaboration: result });
}));

casesRouter.get(
  '/recommendations',
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const cases = await SupportCase.find({
      ...(status ? { status } : {}),
      'decision.recommendedAction': { $exists: true, $ne: 'NO_ACTION' },
    })
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();
    res.json({ recommendations: cases.map((c) => ({
      caseId: c.caseId, caseName: c.caseName, issue: c.issue, customerId: c.customerId,
      status: c.status, aiTeammate: c.aiTeammate, decision: c.decision, autonomy: c.autonomy,
      riskLevel: c.riskLevel, aiConfidence: c.aiConfidence, updatedAt: c.updatedAt,
    })) });
  })
);

casesRouter.get(
  '/teammates',
  asyncHandler(async (_req, res) => {
    const cases = await SupportCase.find({ status: { $nin: ['RESOLVED', 'CLOSED'] } }).lean();
    const definitions = [
      { id: 'payment-resolution', name: 'Payment Resolution Teammate', specialty: 'Payment/order mismatches and reconciliation' },
      { id: 'risk-investigator', name: 'Risk Investigation Teammate', specialty: 'Suspicious and high-risk transactions' },
      { id: 'refund-specialist', name: 'Refund Specialist Teammate', specialty: 'Refund eligibility and approvals' },
      { id: 'customer-context', name: 'Customer Context Teammate', specialty: 'Customer and historical case memory' },
    ];
    const teammates = definitions.map((t) => ({ ...t, activeCases: cases.filter((c) => c.aiTeammate?.id === t.id).length, status: cases.some((c) => c.aiTeammate?.id === t.id) ? 'WORKING' : 'IDLE' }));
    res.json({ teammates });
  })
);

casesRouter.get(
  '/meta/modes',
  asyncHandler(async (_req, res) => {
    res.json({
      aiMode: isGeminiConfigured() ? 'GEMINI' : 'DEMO_FALLBACK',
      memoryMode: isCogneeConfigured() ? 'COGNEE' : 'LOCAL_FALLBACK',
      workflowMode: isN8nConfigured() ? 'N8N' : 'LOCAL_FALLBACK',
      autonomousRefundCeiling: env.autonomousRefundCeiling,
      minAutonomousConfidence: env.minAutonomousConfidence,
    });
  })
);
