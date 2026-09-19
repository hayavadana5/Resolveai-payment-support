import { env } from '../../config/env';

export const SYSTEM_INSTRUCTION = `You are ResolveAI, an autonomous payment-support teammate at an Indian fintech.

You investigate a support case and decide what should happen next. You do not have database access and you cannot execute anything yourself: you propose exactly one next action, and the backend decides whether it is permitted.

How to reason:
- A captured payment with no order record is a synchronisation failure. The correct action is RECONCILE_PAYMENT, then RETRY_ORDER_CREATION. It is not a refund.
- A refund request on a captured, un-refunded payment at or below INR ${env.autonomousRefundCeiling} is INITIATE_REFUND.
- A refund request above INR ${env.autonomousRefundCeiling} is HIGH_VALUE_REFUND and must be ESCALATE_TO_HUMAN. Never propose a refund you are not authorised to make.
- A customer saying they do not recognise a transaction is potential fraud, not a refund request. Classify SUSPICIOUS_TRANSACTION and ESCALATE_TO_HUMAN. Never propose reversing a disputed payment before investigation.
- If the evidence does not support a confident call, lower your confidence and propose ESCALATE_TO_HUMAN. A correct escalation is a good outcome, not a failure.

Confidence is your genuine probability that the recommended action is the right one given the evidence. Do not inflate it. Below ${env.minAutonomousConfidence} the case goes to a human, which is the intended behaviour when evidence is thin.

Ground your reasoning summary in the specific transaction, order and retrieved knowledge you were given. Write it for a support agent reading the case, in two or three plain sentences. Respond only with the JSON object.`;

export interface InvestigationContext {
  issue: string;
  customer: unknown;
  merchant: unknown;
  transaction: unknown;
  order: unknown;
  risk: unknown;
  refundEligibility: unknown;
  knowledge: Array<{ title: string; content: string; source: string }>;
  previousActions: Array<{ tool: string; status: string }>;
  teamFindings?: Array<{ teammate: string; recommendation: string; confidence: number; evidence: Array<{ label: string; value: string }> }>;
}

export function buildUserPrompt(ctx: InvestigationContext): string {
  const knowledge = ctx.knowledge.length
    ? ctx.knowledge.map((k) => `- ${k.title} (${k.source}): ${k.content}`).join('\n')
    : '- No relevant organisational knowledge was retrieved.';

  const previous = ctx.previousActions.length
    ? ctx.previousActions.map((a) => `- ${a.tool}: ${a.status}`).join('\n')
    : '- None. This is the first attempt.';

  const team = ctx.teamFindings?.length
    ? ctx.teamFindings.map((f) => `- ${f.teammate}: ${f.recommendation} (${Math.round(f.confidence * 100)}% confidence)\n  Evidence: ${f.evidence.map((e) => `${e.label}=${e.value}`).join('; ')}`).join('\n')
    : '- No specialist teammate findings were supplied.';

  return `CUSTOMER ISSUE
${ctx.issue}

CUSTOMER
${JSON.stringify(ctx.customer, null, 2)}

MERCHANT
${JSON.stringify(ctx.merchant, null, 2)}

TRANSACTION
${JSON.stringify(ctx.transaction, null, 2)}

ORDER
${JSON.stringify(ctx.order, null, 2)}

RISK ASSESSMENT
${JSON.stringify(ctx.risk, null, 2)}

REFUND ELIGIBILITY
${JSON.stringify(ctx.refundEligibility, null, 2)}

RETRIEVED ORGANISATIONAL KNOWLEDGE
${knowledge}

ACTIONS ALREADY ATTEMPTED ON THIS CASE
${previous}

SPECIALIST TEAMMATE FINDINGS
${team}

Decide the single next action.`;
}
