import { SupportCase } from '../../models';
import { recordAudit } from '../audit.service';
import { retrieveKnowledge } from '../memory';
import { rememberResolution } from '../memory/outcome';
import { assessRiskIntelligence } from '../risk/intelligence';
import { decide, extractAmount } from '../ai/orchestrator';
import { collaborateOnCase } from '../ai/multiAgent';
import { callTool, captureState } from '../tools/registry';
import { publishCaseEvent } from '../realtime';
import type { ToolCaller } from '../tools/types';

export interface RunOptions {
  caseId: string;
  caller: ToolCaller;
  /** Set when a human has already approved the action on an escalation. */
  humanApproved?: boolean;
}

export interface RunOutcome {
  caseId: string;
  status: string;
  resolved: boolean;
  escalated: boolean;
  reason?: string;
}

const AI_CALLER: ToolCaller = { type: 'AI', identifier: 'AI_ORCHESTRATOR', role: 'AI' };

/**
 * UNDERSTAND -> INVESTIGATE -> DECIDE -> ACT -> VERIFY -> RESOLVE / ESCALATE
 *
 * The teammate owns the case end to end. Every branch either reaches a verified
 * resolution or puts the case in a human's hands with the evidence attached.
 */
async function lifecycle(caseId: string, stage: 'UNDERSTAND'|'INVESTIGATE'|'MEMORY'|'RISK'|'DECIDE'|'ACT'|'VERIFY'|'RESOLVE'|'ESCALATE', title: string, detail: string, status: 'STARTED'|'COMPLETED'|'BLOCKED' = 'COMPLETED') {
  await SupportCase.updateOne({ caseId }, { $push: { lifecycle: { stage, status, title, detail, actor: 'AI_ORCHESTRATOR', createdAt: new Date() } } });
  publishCaseEvent({ caseId, type: 'LIFECYCLE', title, detail, status });
  await recordAudit({ caseId, event: `LIFECYCLE_${stage}`, actor: 'AI_ORCHESTRATOR', actorType: 'AI', summary: title, detail: { stage, detail }, outcome: status === 'BLOCKED' ? 'BLOCKED' : 'SUCCESS' });
}

function teammateFor(intent: string) {
  if (intent === 'SUSPICIOUS_TRANSACTION') return { id: 'risk-investigator', name: 'Risk Investigation Teammate', specialty: 'Suspicious and high-risk transactions' };
  if (intent === 'REFUND_REQUEST' || intent === 'HIGH_VALUE_REFUND') return { id: 'refund-specialist', name: 'Refund Specialist Teammate', specialty: 'Refund eligibility and approvals' };
  return { id: 'payment-resolution', name: 'Payment Resolution Teammate', specialty: 'Payment/order mismatches and reconciliation' };
}

export async function runAutonomousCase(options: RunOptions): Promise<RunOutcome> {
  const { caseId } = options;
  const supportCase = await SupportCase.findOne({ caseId });
  if (!supportCase) throw new Error(`Support case ${caseId} not found`);

  const aiCtx = { ...AI_CALLER, humanApproved: options.humanApproved };
  await lifecycle(caseId, 'UNDERSTAND', 'AI teammate accepted the case', 'The teammate has taken ownership and is beginning an end-to-end investigation.');
  await SupportCase.updateOne({ caseId }, { $set: { 'aiTeammate.status': 'WORKING' } });
  publishCaseEvent({ caseId, type: 'CASE_STATUS', title: 'AI teammate is working', detail: 'The case is now owned by the autonomous teammate.', status: 'WORKING' });

  // ---------- INVESTIGATE ----------
  await lifecycle(caseId, 'INVESTIGATE', 'Investigation started', 'Customer, transaction, merchant, order and risk evidence are being gathered.', 'STARTED');
  supportCase.status = 'INVESTIGATING';
  await supportCase.save();
  publishCaseEvent({ caseId, type: 'CASE_STATUS', title: 'Case moved to investigation', detail: 'Evidence gathering has started.', status: supportCase.status });

  const unwrap = <T>(result: { ok: boolean; data?: unknown }): T | null =>
    result.ok ? ((result as { data: T }).data) : null;

  const [customerRes, transactionRes] = await Promise.all([
    callTool('getCustomer', { customerId: supportCase.customerId }, { caller: aiCtx, caseId }),
    supportCase.transactionId
      ? callTool('getTransaction', { transactionId: supportCase.transactionId }, { caller: aiCtx, caseId })
      : Promise.resolve({ ok: false as const, error: 'No transaction on case', code: 'NOT_FOUND' as const }),
  ]);

  const transaction = unwrap<Record<string, unknown>>(transactionRes);
  const customer = unwrap<Record<string, unknown>>(customerRes);

  if (!transaction) {
    await SupportCase.updateOne({ caseId }, { $set: { autonomy: { mode: 'HUMAN_ONLY', reason: 'The teammate could not locate a transaction to investigate.' }, 'aiTeammate.status': 'WAITING_HUMAN' } });
    return escalate(caseId, {
      reason: 'No payment transaction could be located for this case, so nothing can be investigated automatically.',
      riskLevel: 'MEDIUM',
      aiSummary: supportCase.issue,
      recommendedAction: 'MANUAL_INVESTIGATION',
      evidence: { customerId: supportCase.customerId },
      caller: aiCtx,
    });
  }

  const transactionId = String(transaction.transactionId);
  const merchantId = String(transaction.merchantId);

  const [merchantRes, orderRes, riskRes, eligibilityRes] = await Promise.all([
    callTool('getMerchant', { merchantId }, { caller: aiCtx, caseId }),
    callTool('getOrder', { transactionId }, { caller: aiCtx, caseId }),
    callTool('checkRisk', { transactionId }, { caller: aiCtx, caseId }),
    callTool('checkRefundEligibility', { transactionId }, { caller: aiCtx, caseId }),
  ]);

  await lifecycle(caseId, 'INVESTIGATE', 'Core evidence gathered', `Customer, transaction, merchant, order and risk evidence gathered for ${transactionId}.`);

  // ---------- REMEMBER ----------
  const memory = await retrieveKnowledge(
    supportCase.issue,
    [supportCase.category, merchantId].filter(Boolean) as string[],
    caseId
  );
  await lifecycle(caseId, 'MEMORY', 'Organisational memory retrieved', `${memory.knowledge.length} relevant memories were retrieved from ${memory.mode === 'COGNEE' ? 'Cognee' : 'the local fallback knowledge base'}.`);
  supportCase.set('retrievedKnowledge', memory.knowledge);
  supportCase.memoryMode = memory.mode;
  supportCase.merchantId = merchantId;
  await supportCase.save();

  const riskIntelligence = await assessRiskIntelligence(transactionId, 'INVESTIGATE');
  supportCase.set('riskIntelligence', { ...riskIntelligence, assessedAt: new Date() });
  supportCase.riskLevel = riskIntelligence.level;
  await supportCase.save();
  await lifecycle(caseId, 'RISK', 'Risk assessment completed', `Risk intelligence scored ${riskIntelligence.overallScore}/100 (${riskIntelligence.level}) across transaction, customer, merchant, action and historical signals.`);

  // ---------- TEAM COLLABORATION ----------
  const collaboration = await collaborateOnCase(caseId);
  await SupportCase.updateOne({ caseId }, {
    $set: { collaboration },
    $push: { lifecycle: { stage: 'DECIDE', status: collaboration.status === 'HUMAN_REQUIRED' ? 'BLOCKED' : 'COMPLETED', title: 'Specialist teammate consensus formed', detail: `${collaboration.consensus} · ${Math.round(collaboration.agreementScore * 100)}% agreement · next owner ${collaboration.nextOwner}`, actor: 'AI_ORCHESTRATOR', createdAt: new Date() } },
  });
  publishCaseEvent({ caseId, type: 'DECISION', title: 'Multi-agent consensus ready', detail: `${collaboration.consensus} · ${Math.round(collaboration.agreementScore * 100)}% agreement`, status: collaboration.status, data: { nextOwner: collaboration.nextOwner, findings: collaboration.findings } });

  // ---------- DECIDE ----------
  const decision = await decide(
    {
      issue: supportCase.issue,
      customer,
      merchant: unwrap(merchantRes),
      transaction,
      order: unwrap(orderRes),
      risk: unwrap(riskRes),
      refundEligibility: unwrap(eligibilityRes),
      knowledge: memory.knowledge,
      previousActions: supportCase.actions.map((a) => ({ tool: a.tool, status: a.status })),
      teamFindings: collaboration.findings.map((f) => ({ teammate: f.teammateName, recommendation: f.recommendation, confidence: f.confidence, evidence: f.evidence })),
    },
    caseId
  );

  const actionRisk = await assessRiskIntelligence(transactionId, decision.recommendedAction);
  supportCase.set('riskIntelligence', { ...actionRisk, assessedAt: new Date() });
  const financialAction = ['INITIATE_REFUND', 'RECONCILE_PAYMENT', 'RETRY_ORDER_CREATION'].includes(decision.recommendedAction);
  if (financialAction && actionRisk.level === 'HIGH' && decision.recommendedAction !== 'ESCALATE_TO_HUMAN') {
    decision.recommendedAction = 'ESCALATE_TO_HUMAN';
    decision.reasoningSummary = `${decision.reasoningSummary} The independent risk engine scored this proposed financial action HIGH, so autonomous execution is blocked.`;
  }
  const teammate = teammateFor(decision.intent);
  supportCase.aiTeammate = { ...teammate, status: 'WORKING' };
  supportCase.autonomy = { mode: decision.recommendedAction === 'ESCALATE_TO_HUMAN' ? 'HUMAN_ONLY' : 'AUTONOMOUS', reason: financialAction && actionRisk.level === 'HIGH' ? 'Independent risk engine blocked autonomous financial action.' : '' };
  supportCase.decision = {
    intent: decision.intent,
    confidence: decision.confidence,
    risk: decision.risk,
    reasoningSummary: decision.reasoningSummary,
    recommendedAction: decision.recommendedAction,
    aiMode: decision.aiMode,
  };
  supportCase.category = decision.intent;
  supportCase.aiConfidence = decision.confidence;
  supportCase.riskLevel = actionRisk.level === 'HIGH' || decision.risk === 'HIGH' ? 'HIGH' : actionRisk.level === 'MEDIUM' || decision.risk === 'MEDIUM' ? 'MEDIUM' : 'LOW';
  supportCase.priority = decision.risk === 'HIGH' ? 'CRITICAL' : decision.risk === 'MEDIUM' ? 'HIGH' : 'MEDIUM';
  await lifecycle(caseId, 'DECIDE', 'AI recommendation produced', `${teammate.name} recommends ${decision.recommendedAction} with ${(decision.confidence * 100).toFixed(0)}% confidence and ${decision.risk} risk.`);
  await supportCase.save();

  if (decision.recommendedAction === 'ESCALATE_TO_HUMAN' || decision.recommendedAction === 'NO_ACTION') {
    return escalate(caseId, {
      reason:
        decision.recommendedAction === 'ESCALATE_TO_HUMAN'
          ? `The teammate judged this case outside its authority: ${decision.reasoningSummary}`
          : 'No safe autonomous action is available for this case.',
      riskLevel: decision.risk,
      aiSummary: decision.reasoningSummary,
      recommendedAction: decision.recommendedAction,
      evidence: { transaction, risk: unwrap(riskRes), eligibility: unwrap(eligibilityRes), knowledge: memory.knowledge },
      caller: aiCtx,
      confidence: decision.confidence,
    });
  }

  await lifecycle(caseId, 'ACT', 'Action authorized', `The policy layer allowed the recommended action to proceed through controlled tools.`, 'STARTED');

  // ---------- ACT ----------
  supportCase.status = 'ACTING';
  await supportCase.save();

  const plan = buildActionPlan(decision.recommendedAction, {
    transactionId,
    refundAmount: decision.refundAmount ?? extractAmount(supportCase.issue) ?? Number(transaction.amount ?? 0),
    caseId,
  });

  supportCase.set('actionPlan', plan.map((step, index) => ({ step: index + 1, tool: step.tool, purpose: step.purpose ?? `Execute ${step.tool}`, status: 'PENDING' })));
  await supportCase.save();

  const beforeState = await captureState(transactionId);
  let failedAttempts = supportCase.actions.filter((a) => a.status === 'FAILED').length;
  let lastError: string | undefined;

  for (const [stepIndex, step] of plan.entries()) {
    supportCase.actionPlan![stepIndex].status = 'RUNNING';
    supportCase.markModified('actionPlan');
    await supportCase.save();
    publishCaseEvent({ caseId, type: 'ACTION', title: `Executing step ${stepIndex + 1}: ${step.tool}`, detail: step.purpose, status: 'RUNNING', data: { step: stepIndex + 1, tool: step.tool } });
    const result = await callTool(step.tool, step.input, {
      caller: aiCtx,
      caseId,
      failedAttempts,
      confidence: decision.confidence,
    });

    supportCase.actionPlan![stepIndex].status = result.ok ? 'SUCCESS' : result.code === 'POLICY' || result.code === 'AUTHORIZATION' ? 'BLOCKED' : 'FAILED';
    publishCaseEvent({ caseId, type: 'ACTION', title: result.ok ? `Step ${stepIndex + 1} completed` : `Step ${stepIndex + 1} failed`, detail: result.ok ? `${step.tool} completed successfully.` : result.error, status: result.ok ? 'SUCCESS' : 'FAILED', data: { tool: step.tool, result: result.ok ? result.data as Record<string, unknown> : { code: result.code } } });
    supportCase.actions.push({
      tool: step.tool,
      input: step.input,
      status: result.ok ? 'SUCCESS' : result.code === 'POLICY' || result.code === 'AUTHORIZATION' ? 'BLOCKED' : 'FAILED',
      result: result.ok ? (result.data as Record<string, unknown>) : { error: result.error, code: result.code },
      attempt: failedAttempts + 1,
      executedAt: new Date(),
    });
    supportCase.markModified('actionPlan');
    await supportCase.save();

    if (!result.ok) {
      lastError = result.error;
      failedAttempts += 1;
      break;
    }
  }

  if (lastError) {
    return escalate(caseId, {
      reason: `Autonomous action could not complete: ${lastError}`,
      riskLevel: decision.risk,
      aiSummary: decision.reasoningSummary,
      recommendedAction: decision.recommendedAction,
      evidence: { transaction, beforeState, attemptedPlan: plan, error: lastError },
      caller: aiCtx,
      confidence: decision.confidence,
    });
  }

  await lifecycle(caseId, 'ACT', 'Action execution completed', `${plan.length} controlled action step(s) completed successfully.`);

  // ---------- VERIFY ----------
  supportCase.status = 'VERIFYING';
  await supportCase.save();

  const verifyRes = await callTool(
    'verifyAction',
    {
      caseId,
      transactionId,
      action: plan[plan.length - 1]?.verifyAs ?? decision.recommendedAction,
      beforeState,
      expectedRefundAmount: decision.recommendedAction === 'INITIATE_REFUND' ? decision.refundAmount : undefined,
    },
    { caller: aiCtx, caseId }
  );

  const verification = verifyRes.ok
    ? (verifyRes.data as {
        passed: boolean;
        beforeState: Record<string, unknown>;
        afterState: Record<string, unknown>;
        checks: Array<{ name: string; expected: string; actual: string; passed: boolean }>;
        verifiedAt: Date;
      })
    : null;

  if (verification) {
    supportCase.set('verification', verification);
    await supportCase.save();
  }

  if (!verification?.passed) {
    return escalate(caseId, {
      reason:
        'The action reported success but verification against live system state did not confirm the expected change.',
      riskLevel: 'HIGH',
      aiSummary: decision.reasoningSummary,
      recommendedAction: 'MANUAL_VERIFICATION',
      evidence: { beforeState, verification },
      caller: aiCtx,
      confidence: decision.confidence,
    });
  }

  publishCaseEvent({ caseId, type: 'VERIFICATION', title: verification.passed ? 'Verification passed' : 'Verification failed', detail: verification.passed ? 'Live state matches the expected outcome.' : 'Live state did not match the expected outcome.', status: verification.passed ? 'PASSED' : 'FAILED', data: { checks: verification.checks } });
  await lifecycle(caseId, 'VERIFY', verification.passed ? 'Verification passed' : 'Verification failed', verification.passed ? 'Live state matches the expected outcome.' : 'Live state did not match the expected outcome.');

  // ---------- RESOLVE ----------
  if (decision.customerMessage) {
    await callTool(
      'sendNotification',
      {
        caseId,
        customerId: supportCase.customerId,
        subject: `Update on your support case ${caseId}`,
        body: decision.customerMessage,
        channel: 'EMAIL',
      },
      { caller: aiCtx, caseId, confidence: decision.confidence }
    );
  }

  await lifecycle(caseId, 'RESOLVE', 'Verified resolution completed', 'The teammate completed the action, verified the result and is closing the customer case.');
  const resolution = `${decision.reasoningSummary} Action ${decision.recommendedAction} completed and verified against live system state.`;
  const memoryWriteMode = await rememberResolution({ caseId, issue: supportCase.issue, action: decision.recommendedAction, result: resolution, merchantId });
  const finalCase = await SupportCase.findOne({ caseId });
  if (finalCase) { finalCase.memoryOutcome = memoryWriteMode === 'COGNEE' ? 'Resolution summary written to Cognee for future investigations.' : 'Resolution retained locally; Cognee was unavailable.'; await finalCase.save(); }
  await lifecycle(caseId, 'RESOLVE', 'Outcome learned', memoryWriteMode === 'COGNEE' ? 'A compact verified resolution summary was added to organisational memory.' : 'The verified outcome was recorded locally; external memory was unavailable.');
  await callTool('updateSupportCase', { caseId, status: 'RESOLVED', resolution }, { caller: aiCtx, caseId, confidence: decision.confidence });

  const refreshed = await SupportCase.findOne({ caseId });
  if (refreshed) {
    refreshed.aiTeammate = { ...((refreshed.aiTeammate ?? {}) as any), status: 'RESOLVED' };
    refreshed.firstAttemptResolved = refreshed.actions.filter((a) => a.status !== 'SUCCESS').length === 0;
    await refreshed.save();
  }

  publishCaseEvent({ caseId, type: 'CASE_STATUS', title: 'Case resolved', detail: 'The outcome was verified and the customer case is complete.', status: 'RESOLVED' });
  await recordAudit({
    caseId,
    event: 'CASE_RESOLVED',
    actor: 'AI_ORCHESTRATOR',
    actorType: 'AI',
    summary: `Case resolved autonomously via ${decision.recommendedAction}`,
    detail: { decision, verification },
    outcome: 'SUCCESS',
  });

  return { caseId, status: 'RESOLVED', resolved: true, escalated: false };
}

interface PlanStep {
  tool: string;
  input: Record<string, unknown>;
  verifyAs?: string;
  purpose?: string;
}

/** Maps a recommended action onto the concrete, ordered tool calls it requires. */
function buildActionPlan(
  action: string,
  args: { transactionId: string; refundAmount: number; caseId: string }
): PlanStep[] {
  switch (action) {
    case 'RECONCILE_PAYMENT':
      return [
        { tool: 'reconcilePayment', input: { transactionId: args.transactionId }, purpose: 'Confirm captured payment state against gateway evidence.' },
        { tool: 'retryOrderCreation', input: { transactionId: args.transactionId }, purpose: 'Create the missing order from the captured payment.', verifyAs: 'RETRY_ORDER_CREATION' },
      ];
    case 'RETRY_ORDER_CREATION':
      return [
        { tool: 'retryOrderCreation', input: { transactionId: args.transactionId }, purpose: 'Create the missing order from the captured payment.', verifyAs: 'RETRY_ORDER_CREATION' },
      ];
    case 'INITIATE_REFUND':
      return [
        {
          tool: 'initiateRefund',
          input: {
            transactionId: args.transactionId,
            amount: args.refundAmount,
            reason: `Refund approved for case ${args.caseId}`,
          },
          purpose: 'Issue the approved refund through the controlled payment workflow.',
          verifyAs: 'INITIATE_REFUND',
        },
      ];
    default:
      return [];
  }
}

interface EscalateArgs {
  reason: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  aiSummary: string;
  recommendedAction: string;
  evidence: Record<string, unknown>;
  caller: ToolCaller;
  confidence?: number;
}

async function escalate(caseId: string, args: EscalateArgs): Promise<RunOutcome> {
  const result = await callTool(
    'createEscalation',
    {
      caseId,
      reason: args.reason,
      riskLevel: args.riskLevel,
      aiSummary: args.aiSummary,
      recommendedAction: args.recommendedAction,
      evidence: args.evidence,
    },
    { caller: args.caller, caseId, confidence: args.confidence }
  );

  await recordAudit({
    caseId,
    event: 'ESCALATION',
    actor: 'AI_ORCHESTRATOR',
    actorType: 'AI',
    summary: `Escalated to a human: ${args.reason}`,
    detail: { recommendedAction: args.recommendedAction },
    outcome: result.ok ? 'SUCCESS' : 'FAILURE',
  });

  return { caseId, status: 'ESCALATED', resolved: false, escalated: true, reason: args.reason };
}
