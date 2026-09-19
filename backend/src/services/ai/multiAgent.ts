import { Customer, Merchant, Order, Transaction, SupportCase } from '../../models';
import { retrieveKnowledge } from '../memory';
import { assessRiskIntelligence } from '../risk/intelligence';
import { publishCaseEvent } from '../realtime';

export interface TeammateFinding {
  teammateId: string;
  teammateName: string;
  specialty: string;
  status: 'WORKING' | 'COMPLETED' | 'BLOCKED';
  confidence: number;
  recommendation: string;
  evidence: Array<{ label: string; value: string }>;
}

export interface CollaborationResult {
  status: 'CONSENSUS' | 'HUMAN_REQUIRED';
  consensus: string;
  agreementScore: number;
  nextOwner: string;
  findings: TeammateFinding[];
  memoryMode: 'COGNEE' | 'LOCAL_FALLBACK';
}

const names = {
  payment: ['payment-resolution', 'Payment Resolution Teammate', 'Payment/order mismatches and reconciliation'],
  risk: ['risk-investigator', 'Risk Investigation Teammate', 'Suspicious transactions and financial risk'],
  refund: ['refund-specialist', 'Refund Specialist Teammate', 'Refund eligibility and approval workflows'],
  context: ['customer-context', 'Customer Context Teammate', 'Customer history and organisational memory'],
} as const;

/**
 * Runs four specialized teammates in parallel. They produce evidence, not side effects.
 * The orchestrator remains the only component allowed to turn findings into actions.
 */
export async function collaborateOnCase(caseId: string): Promise<CollaborationResult> {
  const supportCase = await SupportCase.findOne({ caseId }).lean();
  if (!supportCase) throw new Error(`Support case ${caseId} not found`);
  if (!supportCase.transactionId) {
    return { status: 'HUMAN_REQUIRED', consensus: 'A transaction is required before specialized financial investigation can begin.', agreementScore: 0, nextOwner: 'Human Operations', findings: [], memoryMode: 'LOCAL_FALLBACK' };
  }

  const transaction = await Transaction.findOne({ transactionId: supportCase.transactionId }).lean();
  if (!transaction) throw new Error(`Transaction ${supportCase.transactionId} not found`);
  const [customer, merchant, order, history] = await Promise.all([
    Customer.findOne({ customerId: transaction.customerId }).lean(),
    Merchant.findOne({ merchantId: transaction.merchantId }).lean(),
    Order.findOne({ transactionId: transaction.transactionId }).lean(),
    SupportCase.find({ customerId: transaction.customerId }).sort({ createdAt: -1 }).limit(8).lean(),
  ]);

  publishCaseEvent({ caseId, type: 'LIFECYCLE', title: 'Specialist teammates collaborating', detail: 'Payment, risk, refund and customer-context teammates are independently reviewing the same case.', status: 'STARTED' });

  const risk = await assessRiskIntelligence(transaction.transactionId, 'INVESTIGATE');
  const memory = await retrieveKnowledge(supportCase.issue, [transaction.merchantId, supportCase.category].filter(Boolean), caseId);

  const findings: TeammateFinding[] = [];
  const amount = Number(transaction.amount ?? 0);
  const paymentMismatch = transaction.status === 'SUCCESS' && !transaction.orderId;
  findings.push({
    teammateId: names.payment[0], teammateName: names.payment[1], specialty: names.payment[2], status: 'COMPLETED',
    confidence: paymentMismatch ? 0.97 : 0.74,
    recommendation: paymentMismatch ? 'RECONCILE_PAYMENT → RETRY_ORDER_CREATION' : 'No payment/order repair is indicated by current state.',
    evidence: [
      { label: 'Payment', value: String(transaction.status) },
      { label: 'Order', value: order ? String(order.orderId ?? 'CREATED') : 'NOT_CREATED' },
      { label: 'Mismatch', value: paymentMismatch ? 'Detected' : 'Not detected' },
    ],
  });

  const suspicious = transaction.riskLevel === 'HIGH' || (transaction.riskSignals ?? []).length > 0;
  findings.push({
    teammateId: names.risk[0], teammateName: names.risk[1], specialty: names.risk[2], status: 'COMPLETED',
    confidence: Math.min(0.99, 0.65 + risk.overallScore / 300),
    recommendation: risk.level === 'HIGH' || suspicious ? 'ESCALATE_TO_HUMAN — autonomous financial action blocked.' : 'Risk posture permits continued policy evaluation.',
    evidence: [
      { label: 'Overall risk', value: `${risk.overallScore}/100 (${risk.level})` },
      { label: 'Stored signals', value: String((transaction.riskSignals ?? []).length) },
      { label: 'Merchant risk', value: String(merchant?.riskLevel ?? 'UNKNOWN') },
    ],
  });

  const refundIntent = /refund|return my money|money back/i.test(supportCase.issue);
  const refundEligible = transaction.status === 'SUCCESS' && Number(transaction.refundedAmount ?? 0) < amount;
  const refundRecommendation = refundIntent && refundEligible
    ? amount <= 5000 ? 'INITIATE_REFUND' : 'HUMAN_APPROVAL_REQUIRED_FOR_REFUND'
    : 'Refund specialist recommends no refund action for this issue.';
  findings.push({
    teammateId: names.refund[0], teammateName: names.refund[1], specialty: names.refund[2], status: 'COMPLETED',
    confidence: refundIntent ? 0.94 : 0.78,
    recommendation: refundRecommendation,
    evidence: [
      { label: 'Customer intent', value: refundIntent ? 'Refund request' : 'Non-refund issue' },
      { label: 'Amount', value: `₹${amount.toLocaleString('en-IN')}` },
      { label: 'Eligibility', value: refundEligible ? 'Potentially eligible' : 'Not eligible from current state' },
    ],
  });

  const historyFailures = history.filter(c => c.status === 'ESCALATED' || (c.actions ?? []).some(a => a.status === 'FAILED')).length;
  findings.push({
    teammateId: names.context[0], teammateName: names.context[1], specialty: names.context[2], status: 'COMPLETED',
    confidence: memory.knowledge.length ? 0.91 : 0.62,
    recommendation: memory.knowledge.length ? `Use ${memory.knowledge.length} organisational memories as supporting context.` : 'Proceed with transactional evidence; external memory unavailable.',
    evidence: [
      { label: 'Customer', value: String(customer?.name ?? transaction.customerId) },
      { label: 'Prior related failures', value: String(historyFailures) },
      { label: 'Retrieved memories', value: String(memory.knowledge.length) },
    ],
  });

  const riskBlock = risk.level === 'HIGH';
  const paymentVote = paymentMismatch ? 'RECONCILE_PAYMENT' : 'NO_ACTION';
  const refundVote = refundIntent && refundEligible ? (amount <= 5000 ? 'INITIATE_REFUND' : 'HUMAN_APPROVAL') : 'NO_ACTION';
  const votes = [paymentVote, riskBlock ? 'ESCALATE_TO_HUMAN' : 'CONTINUE', refundVote];
  let consensus = 'CONTINUE_TO_ORCHESTRATOR';
  let nextOwner = names.payment[1];
  if (riskBlock) { consensus = 'HUMAN_REQUIRED_FOR_RISK'; nextOwner = 'Human Operations'; }
  else if (refundVote === 'HUMAN_APPROVAL') { consensus = 'HUMAN_APPROVAL_REQUIRED_FOR_REFUND'; nextOwner = names.refund[1]; }
  else if (paymentMismatch) { consensus = 'PAYMENT_RECONCILIATION'; nextOwner = names.payment[1]; }
  else if (refundVote === 'INITIATE_REFUND') { consensus = 'REFUND'; nextOwner = names.refund[1]; }
  const nonNeutral = votes.filter(v => v !== 'NO_ACTION' && v !== 'CONTINUE');
  const agreementScore = nonNeutral.length <= 1 ? 1 : nonNeutral.filter(v => v === consensus || (consensus === 'PAYMENT_RECONCILIATION' && v === 'RECONCILE_PAYMENT')).length / nonNeutral.length;

  publishCaseEvent({ caseId, type: 'DECISION', title: 'Specialist consensus formed', detail: `${consensus} with ${Math.round(agreementScore * 100)}% agreement. Next owner: ${nextOwner}.`, status: 'CONSENSUS', data: { consensus, agreementScore, findings } });
  return { status: riskBlock || refundVote === 'HUMAN_APPROVAL' ? 'HUMAN_REQUIRED' : 'CONSENSUS', consensus, agreementScore, nextOwner, findings, memoryMode: memory.mode };
}
