import { Customer, Merchant, Transaction, SupportCase } from '../../models';

export interface RiskIntelligence {
  overallScore: number;
  transactionScore: number;
  customerScore: number;
  merchantScore: number;
  actionScore: number;
  historicalScore: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  signals: Array<{ signal: string; score: number; explanation: string }>;
}

export async function assessRiskIntelligence(transactionId: string, action = 'INVESTIGATE'): Promise<RiskIntelligence> {
  const txn = await Transaction.findOne({ transactionId }).lean();
  if (!txn) throw new Error(`Transaction ${transactionId} not found`);
  const [customer, merchant, history] = await Promise.all([
    Customer.findOne({ customerId: txn.customerId }).lean(),
    Merchant.findOne({ merchantId: txn.merchantId }).lean(),
    SupportCase.find({ customerId: txn.customerId }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);

  const signals: RiskIntelligence['signals'] = [];
  let transactionScore = 0;
  let customerScore = 0;
  let merchantScore = 0;
  const actionScore = action === 'INITIATE_REFUND' ? Math.min(35, txn.amount / 2000) : action === 'RETRY_ORDER_CREATION' ? 8 : 15;
  let historicalScore = 0;

  if (txn.amount >= 50000) { transactionScore += 35; signals.push({ signal: 'VERY_HIGH_VALUE', score: 35, explanation: 'Transaction amount is at least INR 50,000.' }); }
  else if (txn.amount >= 25000) { transactionScore += 22; signals.push({ signal: 'HIGH_VALUE', score: 22, explanation: 'Transaction amount is at least INR 25,000.' }); }
  if (txn.riskLevel === 'HIGH') { transactionScore += 35; signals.push({ signal: 'STORED_HIGH_RISK', score: 35, explanation: 'Gateway record already marks this transaction HIGH risk.' }); }
  if ((txn.riskSignals ?? []).length) { const s = Math.min(25, txn.riskSignals.length * 8); transactionScore += s; signals.push({ signal: 'RISK_SIGNALS', score: s, explanation: `${txn.riskSignals.length} stored risk signal(s) are attached.` }); }

  if (!customer?.verified) { customerScore += 18; signals.push({ signal: 'UNVERIFIED_CUSTOMER', score: 18, explanation: 'Customer identity is not verified.' }); }
  if ((customer?.accountAgeDays ?? 9999) < 30) { customerScore += 18; signals.push({ signal: 'NEW_ACCOUNT', score: 18, explanation: 'Customer account is less than 30 days old.' }); }

  if (merchant?.riskLevel === 'HIGH') { merchantScore += 35; signals.push({ signal: 'HIGH_RISK_MERCHANT', score: 35, explanation: 'Merchant is classified as HIGH risk.' }); }
  else if (merchant?.riskLevel === 'MEDIUM') { merchantScore += 18; signals.push({ signal: 'MEDIUM_RISK_MERCHANT', score: 18, explanation: 'Merchant is classified as MEDIUM risk.' }); }

  const relatedFailures = history.filter((c) => c.status === 'ESCALATED' || (c.actions ?? []).some((a) => a.status === 'FAILED')).length;
  if (relatedFailures >= 3) { historicalScore += 25; signals.push({ signal: 'REPEATED_FAILURE_HISTORY', score: 25, explanation: `${relatedFailures} recent related cases contain escalation/action failures.` }); }
  else if (relatedFailures > 0) { historicalScore += 10; signals.push({ signal: 'PRIOR_FAILURE_HISTORY', score: 10, explanation: `${relatedFailures} recent related case(s) contain a failure or escalation.` }); }

  const overallScore = Math.min(100, Math.round(transactionScore * 0.35 + customerScore * 0.15 + merchantScore * 0.15 + actionScore * 0.2 + historicalScore * 0.15));
  const level = overallScore >= 65 ? 'HIGH' : overallScore >= 35 ? 'MEDIUM' : 'LOW';
  return { overallScore, transactionScore, customerScore, merchantScore, actionScore: Math.round(actionScore), historicalScore, level, signals };
}
