import { Router } from 'express';
import { AuditLog, Escalation, SupportCase, Transaction } from '../models';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { env, isCogneeConfigured, isGeminiConfigured, isN8nConfigured } from '../config/env';

export const operationsRouter = Router();
operationsRouter.use(requireAuth);

const TEAMMATES = [
  { id: 'payment-resolution', name: 'Payment Resolution Teammate', specialty: 'Payment/order mismatches and reconciliation' },
  { id: 'risk-investigator', name: 'Risk Investigation Teammate', specialty: 'Suspicious transactions and financial risk' },
  { id: 'refund-specialist', name: 'Refund Specialist Teammate', specialty: 'Refund eligibility and approval workflows' },
  { id: 'customer-context', name: 'Customer Context Teammate', specialty: 'Customer history and organisational memory' },
];

operationsRouter.get('/control-plane', asyncHandler(async (_req, res) => {
  const [cases, pendingEscalations, recentActivity, transactions] = await Promise.all([
    SupportCase.find().sort({ updatedAt: -1 }).limit(250).lean(),
    Escalation.find({ status: 'PENDING' }).sort({ createdAt: -1 }).limit(20).lean(),
    AuditLog.find({ event: { $in: ['CASE_CREATED', 'AI_DECISION', 'ACTION_EXECUTED', 'ACTION_BLOCKED', 'VERIFICATION', 'ESCALATION', 'CASE_RESOLVED'] } })
      .sort({ createdAt: -1 }).limit(30).lean(),
    Transaction.find().sort({ createdAt: -1 }).limit(250).lean(),
  ]);

  const active = cases.filter((c) => ['OPEN', 'INVESTIGATING', 'ACTING', 'VERIFYING'].includes(String(c.status)));
  const resolved = cases.filter((c) => c.status === 'RESOLVED');
  const verified = resolved.filter((c) => c.verification?.passed);
  const autonomous = resolved.filter((c) => !cases.find((x) => x.caseId === c.caseId && x.autonomy?.mode === 'HUMAN_APPROVAL'));
  const failedActions = cases.flatMap((c) => c.actions ?? []).filter((a) => a.status === 'FAILED').length;
  const blockedActions = cases.flatMap((c) => c.actions ?? []).filter((a) => a.status === 'BLOCKED').length;
  const riskHigh = cases.filter((c) => c.riskLevel === 'HIGH').length;
  const anomalyCandidates = transactions
    .map((t) => ({
      merchantId: t.merchantId,
      captured: t.status === 'SUCCESS' ? 1 : 0,
      missingOrder: t.status === 'SUCCESS' && !t.orderId ? 1 : 0,
    }))
    .reduce<Record<string, { merchantId: string; captured: number; missingOrder: number }>>((acc, row) => {
      const current = acc[row.merchantId] ?? { merchantId: row.merchantId, captured: 0, missingOrder: 0 };
      current.captured += row.captured;
      current.missingOrder += row.missingOrder;
      acc[row.merchantId] = current;
      return acc;
    }, {});

  const anomalies = Object.values(anomalyCandidates)
    .map((m) => ({ ...m, mismatchRate: m.captured ? Number(((m.missingOrder / m.captured) * 100).toFixed(1)) : 0 }))
    .filter((m) => m.missingOrder >= 3 && m.mismatchRate >= 5)
    .sort((a, b) => b.mismatchRate - a.mismatchRate)
    .slice(0, 8);

  const teammates = TEAMMATES.map((t) => {
    const owned = cases.filter((c) => c.aiTeammate?.id === t.id);
    const working = owned.filter((c) => ['OPEN', 'INVESTIGATING', 'ACTING', 'VERIFYING'].includes(String(c.status))).length;
    return { ...t, activeCases: working, totalCases: owned.length, status: working ? 'WORKING' : 'IDLE' };
  });

  res.json({
    system: {
      aiMode: isGeminiConfigured() ? 'GEMINI' : 'DEMO_FALLBACK',
      memoryMode: isCogneeConfigured() ? 'COGNEE' : 'LOCAL_FALLBACK',
      workflowMode: isN8nConfigured() ? 'N8N' : 'LOCAL_FALLBACK',
      autonomousRefundCeiling: env.autonomousRefundCeiling,
      confidenceFloor: env.minAutonomousConfidence,
    },
    summary: {
      totalCases: cases.length,
      activeCases: active.length,
      autonomousResolutions: autonomous.length,
      verifiedResolutions: verified.length,
      pendingHumanDecisions: pendingEscalations.length,
      highRiskCases: riskHigh,
      blockedActions,
      failedActions,
      verificationRate: resolved.length ? Number(((verified.length / resolved.length) * 100).toFixed(1)) : 0,
    },
    teammates,
    anomalies,
    pendingEscalations,
    recentActivity,
    activeCases: active.slice(0, 12),
  });
}));
