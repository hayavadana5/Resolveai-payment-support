export interface KnowledgeRecord {
  title: string;
  content: string;
  tags: string[];
  source: string;
}

/**
 * The organisational knowledge base. This is what gets pushed into Cognee on
 * `npm run seed`, and what the local fallback searches when Cognee is down.
 */
export const knowledgeBase: KnowledgeRecord[] = [
  {
    title: 'Payment/order synchronisation failures',
    content:
      'When a payment is captured but no order record exists, the cause is almost always a dropped webhook between the gateway and the merchant order service. The standard remedy is to reconcile the payment against the gateway, then retry order creation using the captured transaction reference. Refunding in this situation is incorrect unless order retry fails twice.',
    tags: ['PAYMENT_ORDER_MISMATCH', 'reconciliation', 'order-retry'],
    source: 'Payments runbook v4.2',
  },
  {
    title: 'Refund authority limits',
    content:
      'Support agents and the autonomous teammate may issue refunds up to INR 5,000 where the payment was captured and not previously refunded. Refunds above INR 5,000 require approval from a payments lead. High-value refunds must never be auto-approved on customer assertion alone.',
    tags: ['REFUND_REQUEST', 'HIGH_VALUE_REFUND', 'policy'],
    source: 'Refund policy 2026-01',
  },
  {
    title: 'Unrecognised transaction handling',
    content:
      'A customer disputing a transaction they do not recognise is treated as potential fraud, not as a refund request. Do not reverse or refund the payment. Freeze autonomous action, gather device, velocity and geography signals, and route to the fraud desk with evidence attached. Reversing a disputed payment before investigation destroys chargeback defence evidence.',
    tags: ['SUSPICIOUS_TRANSACTION', 'fraud', 'escalation'],
    source: 'Fraud operations handbook',
  },
  {
    title: 'Merchant MRC-2201 order service instability',
    content:
      'Urban Cart Retail (MRC-2201) had three payment/order synchronisation incidents in the last quarter. All three were resolved by reconciliation followed by order retry, with a median resolution time of four minutes and no refunds issued. Customers were notified once the order was created.',
    tags: ['MRC-2201', 'merchant-history', 'PAYMENT_ORDER_MISMATCH'],
    source: 'Historical case archive',
  },
  {
    title: 'Settlement delays are not customer-facing failures',
    content:
      'A transaction in SETTLED=PENDING state has still been captured from the customer. Settlement affects when the merchant receives funds, not whether the customer was charged. Never tell a customer their payment failed because settlement is pending.',
    tags: ['SETTLEMENT_DELAY', 'customer-comms'],
    source: 'Payments runbook v4.2',
  },
  {
    title: 'Escalation rules',
    content:
      'Escalate when: the transaction risk level is HIGH, the requested refund exceeds authority, AI confidence is below 0.80, an action has failed twice, or verification of an executed action does not pass. Escalations must carry the investigation summary, actions attempted and recommended next step.',
    tags: ['escalation', 'policy'],
    source: 'Escalation policy 2026-01',
  },
  {
    title: 'Resolved case CASE-H0041',
    content:
      'Customer reported INR 2,499 deducted with no order. Transaction TXN-1001 was SUCCESS at the gateway, order record absent. Reconciliation confirmed capture, order retry created ORD-77120, verification confirmed order CREATED, customer notified. Closed autonomously in 3m 12s.',
    tags: ['PAYMENT_ORDER_MISMATCH', 'historical-case', 'resolution'],
    source: 'Historical case archive',
  },
  {
    title: 'Resolved case CASE-H0058',
    content:
      'Customer requested refund of INR 3,000 for a delivered-but-damaged item. Payment captured, no prior refund, amount within authority. Refund issued through the payments workflow, transaction moved to REFUNDED, customer notified. Closed autonomously.',
    tags: ['REFUND_REQUEST', 'historical-case', 'resolution'],
    source: 'Historical case archive',
  },
  {
    title: 'Escalated case CASE-H0063',
    content:
      'Customer demanded INR 50,000 refund citing a duplicate charge. Amount exceeded autonomous authority. The teammate blocked the refund, assembled the transaction and duplicate-charge evidence and escalated. The payments lead found no duplicate and rejected the refund.',
    tags: ['HIGH_VALUE_REFUND', 'historical-case', 'escalation'],
    source: 'Historical case archive',
  },
];
