import { Router } from 'express';
import { AuditLog, Escalation, Notification, SupportCase } from '../models';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

const pct = (numerator: number, denominator: number) =>
  denominator === 0 ? 0 : Number(((numerator / denominator) * 100).toFixed(1));

/** Every figure here is computed from stored records. Nothing is hardcoded. */
analyticsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const cases = await SupportCase.find().lean();
    const total = cases.length;

    const resolved = cases.filter((c) => c.status === 'RESOLVED');
    const escalated = cases.filter((c) => c.status === 'ESCALATED');

    // A resolution counts as autonomous only when no human decided it.
    const humanDecidedCaseIds = new Set(
      (await Escalation.find({ humanDecision: { $ne: null } }).lean()).map((e) => e.caseId)
    );
    const autonomous = resolved.filter((c) => !humanDecidedCaseIds.has(c.caseId));

    const durations = resolved
      .filter((c) => c.resolvedAt && c.createdAt)
      .map((c) => new Date(c.resolvedAt as Date).getTime() - new Date(c.createdAt as Date).getTime())
      .filter((d) => d >= 0);
    const avgResolutionMs = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    const actions = cases.flatMap((c) => c.actions ?? []);
    const successfulActions = actions.filter((a) => a.status === 'SUCCESS').length;

    const firstTime = resolved.filter((c) => c.firstAttemptResolved).length;

    // The primary product metric: resolved, verification passed, customer told.
    const notifiedCaseIds = new Set((await Notification.find().lean()).map((n) => n.caseId));
    const verifiedCustomerResolutions = resolved.filter(
      (c) => c.verification?.passed && notifiedCaseIds.has(c.caseId)
    ).length;

    const byCategory = cases.reduce<Record<string, number>>((acc, c) => {
      const key = String(c.category ?? 'UNKNOWN');
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const blockedActions = await AuditLog.countDocuments({ event: 'ACTION_BLOCKED' });

    res.json({
      totals: {
        cases: total,
        autonomousResolutions: autonomous.length,
        humanEscalations: escalated.length,
        openCases: cases.filter((c) => ['OPEN', 'INVESTIGATING', 'ACTING', 'VERIFYING'].includes(String(c.status)))
          .length,
        verifiedCustomerResolutions,
        blockedActions,
      },
      rates: {
        automationRate: pct(autonomous.length, total),
        escalationRate: pct(escalated.length, total),
        actionSuccessRate: pct(successfulActions, actions.length),
        firstTimeResolutionRate: pct(firstTime, resolved.length),
      },
      averageResolutionMs: avgResolutionMs,
      byCategory,
    });
  })
);

analyticsRouter.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const [recentCases, recentActivity, openEscalations, activeCases, recentRecommendations] = await Promise.all([
      SupportCase.find().sort({ createdAt: -1 }).limit(8).lean(),
      AuditLog.find({ event: { $in: ['AI_DECISION', 'ACTION_EXECUTED', 'ACTION_BLOCKED', 'VERIFICATION', 'ESCALATION'] } })
        .sort({ createdAt: -1 })
        .limit(12)
        .lean(),
      Escalation.find({ status: 'PENDING' }).sort({ createdAt: -1 }).limit(6).lean(),
      SupportCase.find({ status: { $nin: ['RESOLVED', 'CLOSED'] } }).lean(),
      SupportCase.find({
        'decision.recommendedAction': { $exists: true, $ne: 'NO_ACTION' },
      }).sort({ updatedAt: -1 }).limit(5).lean(),
    ]);

    const teammates = [
      { id: 'payment-resolution', name: 'Payment Resolution Teammate', specialty: 'Payment/order mismatches' },
      { id: 'risk-investigator', name: 'Risk Investigation Teammate', specialty: 'Suspicious transactions' },
      { id: 'refund-specialist', name: 'Refund Specialist Teammate', specialty: 'Refund eligibility' },
      { id: 'customer-context', name: 'Customer Context Teammate', specialty: 'Customer memory' },
    ].map((t) => ({ ...t, activeCases: activeCases.filter((c) => c.aiTeammate?.id === t.id).length, status: activeCases.some((c) => c.aiTeammate?.id === t.id) ? 'WORKING' : 'IDLE' }));

    res.json({ recentCases, recentActivity, openEscalations, teammates, recentRecommendations });
  })
);
