import { Router } from 'express';
import { z } from 'zod';
import { Escalation, SupportCase, Transaction } from '../models';
import { requireAuth, requireRole } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/error';
import { recordAudit } from '../services/audit.service';
import { callTool } from '../services/tools/registry';
import { captureState, verifyAction } from '../services/verification/engine';

export const escalationsRouter = Router();
escalationsRouter.use(requireAuth);

escalationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const escalations = await Escalation.find(status ? { status } : {}).sort({ createdAt: -1 }).lean();
    const caseIds = escalations.map((e) => e.caseId);
    const cases = await SupportCase.find({ caseId: { $in: caseIds } }).lean();
    const byId = new Map(cases.map((c) => [c.caseId, c]));
    res.json({
      escalations: escalations.map((e) => ({ ...e, case: byId.get(e.caseId) ?? null })),
    });
  })
);

const decisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT', 'REQUEST_INFO']),
  note: z.string().max(1000).default(''),
});

/**
 * A human decision on an escalation. Approving a refund executes it with the
 * human's authority attached, so the policy engine's approval requirement is
 * satisfied rather than bypassed.
 */
escalationsRouter.post(
  '/:escalationId/decision',
  requireRole('ADMIN', 'SUPPORT_AGENT'),
  asyncHandler(async (req, res) => {
    const escalationId = String(req.params.escalationId);
    const { decision, note } = decisionSchema.parse(req.body);
    const escalation = await Escalation.findOne({ escalationId });
    if (!escalation) throw new HttpError(404, `No escalation with id ${escalationId}.`);
    if (escalation.status !== 'PENDING') throw new HttpError(409, 'This escalation has already been decided.');

    const actor = req.user?.email ?? 'unknown';
    const supportCase = await SupportCase.findOne({ caseId: escalation.caseId });
    if (!supportCase) throw new HttpError(404, 'The linked case no longer exists.');

    let executionNote = '';

    if (decision === 'APPROVE' && escalation.recommendedAction === 'INITIATE_REFUND' && supportCase.transactionId) {
      if (req.user?.role !== 'ADMIN') {
        throw new HttpError(403, 'Approving a refund above the autonomous ceiling requires the ADMIN role.');
      }
      const txn = await Transaction.findOne({ transactionId: supportCase.transactionId }).lean();
      const amount = txn?.amount ?? 0;
      const beforeState = await captureState(supportCase.transactionId);

      const result = await callTool(
        'initiateRefund',
        { transactionId: supportCase.transactionId, amount, reason: `Human-approved refund for ${escalation.caseId}` },
        {
          caller: { type: 'HUMAN', identifier: actor, role: 'ADMIN', humanApproved: true },
          caseId: escalation.caseId,
        }
      );

      if (result.ok) {
        const verification = await verifyAction({
          caseId: escalation.caseId,
          transactionId: supportCase.transactionId,
          action: 'INITIATE_REFUND',
          beforeState,
          expectedRefundAmount: amount,
        });
        supportCase.verification = verification;
        supportCase.status = verification.passed ? 'RESOLVED' : 'ESCALATED';
        if (verification.passed) supportCase.resolvedAt = new Date();
        executionNote = verification.passed
          ? `Refund of INR ${amount} executed and verified.`
          : 'Refund executed but verification did not pass; the case stays open.';
      } else {
        executionNote = `Refund could not be executed: ${result.error}`;
      }
    }

    if (decision === 'REJECT') {
      supportCase.status = 'CLOSED';
      supportCase.resolution = `Escalation rejected by ${actor}. ${note}`.trim();
    } else if (decision === 'REQUEST_INFO') {
      supportCase.status = 'INVESTIGATING';
    } else if (!executionNote) {
      supportCase.status = 'RESOLVED';
      supportCase.resolvedAt = new Date();
      supportCase.resolution = `Approved by ${actor}. ${note}`.trim();
    }
    await supportCase.save();

    escalation.status = decision === 'APPROVE' ? 'APPROVED' : decision === 'REJECT' ? 'REJECTED' : 'INFO_REQUESTED';
    escalation.humanDecision = { decidedBy: actor, decision, note, decidedAt: new Date() };
    if (decision !== 'REQUEST_INFO') escalation.resolvedAt = new Date();
    await escalation.save();

    await recordAudit({
      caseId: escalation.caseId,
      event: 'HUMAN_DECISION',
      actor,
      actorType: 'HUMAN',
      summary: `${decision} on escalation ${escalationId}. ${executionNote}`.trim(),
      detail: { note, executionNote },
      outcome: 'SUCCESS',
    });

    res.json({ escalation: escalation.toObject(), case: supportCase.toObject(), executionNote });
  })
);
