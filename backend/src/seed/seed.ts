import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../db/connect';
import {
  AuditLog,
  Customer,
  Escalation,
  Merchant,
  Notification,
  Order,
  Policy,
  SupportCase,
  Transaction,
  User,
} from '../models';
import { isCogneeConfigured } from '../config/env';
import { ingestKnowledge } from '../services/memory';
import { customers, merchants, orders, policies, transactions } from './data';

const DEMO_USERS = [
  { name: 'Asha Menon', email: 'agent@resolveai.dev', password: 'Agent@12345', role: 'SUPPORT_AGENT' as const },
  { name: 'Ravi Deshpande', email: 'admin@resolveai.dev', password: 'Admin@12345', role: 'ADMIN' as const },
];

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);

/** Cases 1-4 are the live demo scenarios and are left OPEN for the walkthrough. */
const openCases = [
  { caseId: 'CASE-DEMO01', customerId: 'CUS-1001', merchantId: 'MRC-2201', transactionId: 'TXN-3001', issue: '₹2,499 was deducted but my order wasn\u2019t placed.', priority: 'HIGH' },
  { caseId: 'CASE-DEMO02', customerId: 'CUS-1002', merchantId: 'MRC-2202', transactionId: 'TXN-3002', issue: 'I want a refund for my ₹3,000 payment. The groceries never arrived.', priority: 'MEDIUM' },
  { caseId: 'CASE-DEMO03', customerId: 'CUS-1004', merchantId: 'MRC-2203', transactionId: 'TXN-3003', issue: 'I want a ₹50,000 refund for the tent I ordered. It is the wrong model.', priority: 'HIGH' },
  { caseId: 'CASE-DEMO04', customerId: 'CUS-1005', merchantId: 'MRC-2204', transactionId: 'TXN-3004', issue: 'I don\u2019t recognize this ₹45,000 transaction on my card. I did not make it.', priority: 'CRITICAL' },
  { caseId: 'CASE-DEMO05', customerId: 'CUS-1007', merchantId: 'MRC-2205', transactionId: 'TXN-3007', issue: 'Paid ₹4,500 for a wellness package and nothing shows in my account.', priority: 'MEDIUM' },
  { caseId: 'CASE-DEMO06', customerId: 'CUS-1003', merchantId: 'MRC-2204', transactionId: 'TXN-3020', issue: 'There is a ₹27,500 charge I never authorised.', priority: 'CRITICAL' },
];

/** Historical closed cases so the dashboard has real metrics on first load. */
const historicalCases = [
  { caseId: 'CASE-H0041', customerId: 'CUS-1006', merchantId: 'MRC-2201', transactionId: 'TXN-3013', issue: '₹5,600 taken but the cookware order never appeared.', category: 'PAYMENT_ORDER_MISMATCH', status: 'RESOLVED', confidence: 0.94, risk: 'LOW', action: 'RETRY_ORDER_CREATION', createdMinutesAgo: 2880, resolvedMinutesAgo: 2877, notified: true },
  { caseId: 'CASE-H0058', customerId: 'CUS-1011', merchantId: 'MRC-2205', transactionId: 'TXN-3011', issue: 'Refund requested for a ₹1,800 yoga pack I could not attend.', category: 'REFUND_REQUEST', status: 'RESOLVED', confidence: 0.92, risk: 'LOW', action: 'INITIATE_REFUND', createdMinutesAgo: 4320, resolvedMinutesAgo: 4315, notified: true },
  { caseId: 'CASE-H0059', customerId: 'CUS-1008', merchantId: 'MRC-2203', transactionId: 'TXN-3008', issue: '₹8,900 shoes marked delivered but never received.', category: 'PAYMENT_ORDER_MISMATCH', status: 'RESOLVED', confidence: 0.87, risk: 'LOW', action: 'RECONCILE_PAYMENT', createdMinutesAgo: 1440, resolvedMinutesAgo: 1432, notified: true },
  { caseId: 'CASE-H0063', customerId: 'CUS-1004', merchantId: 'MRC-2203', transactionId: 'TXN-3015', issue: 'Demanding a ₹15,750 refund for a duplicate camping pack charge.', category: 'HIGH_VALUE_REFUND', status: 'ESCALATED', confidence: 0.83, risk: 'MEDIUM', action: 'ESCALATE_TO_HUMAN', createdMinutesAgo: 720, resolvedMinutesAgo: null, notified: false },
  { caseId: 'CASE-H0067', customerId: 'CUS-1010', merchantId: 'MRC-2204', transactionId: 'TXN-3010', issue: 'Says a ₹32,000 gift card purchase was not made by them.', category: 'SUSPICIOUS_TRANSACTION', status: 'ESCALATED', confidence: 0.9, risk: 'HIGH', action: 'ESCALATE_TO_HUMAN', createdMinutesAgo: 300, resolvedMinutesAgo: null, notified: false },
  { caseId: 'CASE-H0071', customerId: 'CUS-1009', merchantId: 'MRC-2202', transactionId: 'TXN-3018', issue: 'Coffee order charged ₹450 twice, wants one back.', category: 'REFUND_REQUEST', status: 'RESOLVED', confidence: 0.91, risk: 'LOW', action: 'INITIATE_REFUND', createdMinutesAgo: 180, resolvedMinutesAgo: 176, notified: true },
];

async function seed() {
  await connectDatabase();
  console.log('[seed] clearing existing collections');
  await Promise.all([
    User.deleteMany({}), Customer.deleteMany({}), Merchant.deleteMany({}),
    Transaction.deleteMany({}), Order.deleteMany({}), SupportCase.deleteMany({}),
    Policy.deleteMany({}), AuditLog.deleteMany({}), Escalation.deleteMany({}),
    Notification.deleteMany({}),
  ]);

  console.log('[seed] users');
  await User.insertMany(
    await Promise.all(
      DEMO_USERS.map(async (u) => ({
        name: u.name,
        email: u.email,
        passwordHash: await bcrypt.hash(u.password, 10),
        role: u.role,
      }))
    )
  );

  console.log('[seed] customers, merchants, transactions, orders, policies');
  await Customer.insertMany(customers);
  await Merchant.insertMany(merchants);
  await Transaction.insertMany(transactions.map((t) => ({ ...t, currency: 'INR', refundedAmount: t.refundedAmount ?? 0 })));

  const txnById = new Map(transactions.map((t) => [t.transactionId, t]));
  await Order.insertMany(
    orders.map((o) => {
      const txn = txnById.get(o.transactionId);
      return {
        ...o,
        customerId: txn?.customerId ?? 'CUS-1001',
        merchantId: txn?.merchantId ?? 'MRC-2201',
      };
    })
  );
  await Policy.insertMany(policies);

  console.log('[seed] open demo cases');
  await SupportCase.insertMany(openCases.map((c) => ({ ...c, caseName: c.issue.length > 40 ? c.issue.substring(0, 40) + '...' : c.issue, status: 'OPEN', createdBy: 'agent@resolveai.dev' })));

  console.log('[seed] historical cases, escalations, notifications, audit records');
  for (const h of historicalCases) {
    const createdAt = minutesAgo(h.createdMinutesAgo);
    const resolvedAt = h.resolvedMinutesAgo ? minutesAgo(h.resolvedMinutesAgo) : undefined;
    const resolved = h.status === 'RESOLVED';

    await SupportCase.create({
      caseId: h.caseId,
      caseName: h.issue.length > 40 ? h.issue.substring(0, 40) + '...' : h.issue,
      customerId: h.customerId,
      merchantId: h.merchantId,
      transactionId: h.transactionId,
      issue: h.issue,
      category: h.category,
      priority: h.risk === 'HIGH' ? 'CRITICAL' : 'MEDIUM',
      status: h.status,
      aiConfidence: h.confidence,
      riskLevel: h.risk,
      decision: {
        intent: h.category,
        confidence: h.confidence,
        risk: h.risk,
        reasoningSummary: `Historical case retained for reference. Outcome: ${h.status}.`,
        recommendedAction: h.action,
        aiMode: 'DEMO_FALLBACK',
      },
      memoryMode: 'LOCAL_FALLBACK',
      actions: resolved
        ? [{ tool: h.action === 'INITIATE_REFUND' ? 'initiateRefund' : 'retryOrderCreation', input: { transactionId: h.transactionId }, status: 'SUCCESS', result: { seeded: true }, attempt: 1, executedAt: createdAt }]
        : [],
      verification: resolved
        ? { passed: true, beforeState: { orderStatus: 'NOT_CREATED' }, afterState: { orderStatus: 'CREATED' }, checks: [{ name: 'Outcome verified', expected: 'CREATED', actual: 'CREATED', passed: true }], verifiedAt: resolvedAt }
        : {},
      resolution: resolved ? 'Closed after verification against live system state.' : '',
      customerNotified: h.notified,
      firstAttemptResolved: resolved,
      createdBy: 'agent@resolveai.dev',
      createdAt,
      updatedAt: resolvedAt ?? createdAt,
      resolvedAt,
    });

    if (h.status === 'ESCALATED') {
      await Escalation.create({
        escalationId: `ESC-${h.caseId.slice(-5)}`,
        caseId: h.caseId,
        reason: h.risk === 'HIGH'
          ? 'High-risk signals present; autonomous financial action blocked pending fraud review.'
          : 'Requested refund exceeds the autonomous authority ceiling.',
        riskLevel: h.risk,
        aiSummary: `The teammate investigated ${h.transactionId} and stopped short of acting.`,
        recommendedAction: h.risk === 'HIGH' ? 'FRAUD_REVIEW' : 'INITIATE_REFUND',
        evidence: { transactionId: h.transactionId },
        status: 'PENDING',
        createdAt,
      });
    }

    if (h.notified) {
      await Notification.create({
        caseId: h.caseId,
        channel: 'EMAIL',
        recipient: customers.find((c) => c.customerId === h.customerId)?.email ?? 'customer@example.in',
        subject: `Update on your support case ${h.caseId}`,
        body: 'Your case has been resolved. No further action is needed from you.',
        status: 'SENT',
        deliveredVia: 'LOCAL_SIMULATION',
        createdAt: resolvedAt ?? createdAt,
      });
    }

    await AuditLog.insertMany([
      { caseId: h.caseId, event: 'CASE_CREATED', actor: 'agent@resolveai.dev', actorType: 'HUMAN', summary: `Case opened: ${h.issue}`, outcome: 'SUCCESS', createdAt },
      { caseId: h.caseId, event: 'AI_DECISION', actor: 'DEMO_FALLBACK', actorType: 'AI', summary: `Classified as ${h.category} with ${(h.confidence * 100).toFixed(0)}% confidence`, outcome: 'SUCCESS', createdAt },
      ...(resolved
        ? [
            { caseId: h.caseId, event: 'ACTION_EXECUTED' as const, actor: 'AI_ORCHESTRATOR', actorType: 'AI' as const, summary: `${h.action} completed`, outcome: 'SUCCESS' as const, createdAt },
            { caseId: h.caseId, event: 'VERIFICATION' as const, actor: 'VERIFICATION_ENGINE', actorType: 'SYSTEM' as const, summary: 'State change confirmed', outcome: 'SUCCESS' as const, createdAt: resolvedAt },
            { caseId: h.caseId, event: 'CASE_RESOLVED' as const, actor: 'AI_ORCHESTRATOR', actorType: 'AI' as const, summary: 'Case resolved autonomously', outcome: 'SUCCESS' as const, createdAt: resolvedAt },
          ]
        : [
            { caseId: h.caseId, event: 'ACTION_BLOCKED' as const, actor: 'POLICY_ENGINE', actorType: 'SYSTEM' as const, summary: 'Autonomous action blocked by policy', outcome: 'BLOCKED' as const, createdAt },
            { caseId: h.caseId, event: 'ESCALATION' as const, actor: 'AI_ORCHESTRATOR', actorType: 'AI' as const, summary: 'Handed to a human with evidence attached', outcome: 'SUCCESS' as const, createdAt },
          ]),
    ]);
  }

  if (isCogneeConfigured()) {
    try {
      const { ingested } = await ingestKnowledge();
      console.log(`[seed] pushed ${ingested} knowledge documents into Cognee`);
    } catch (error) {
      console.warn('[seed] Cognee ingest failed; local knowledge fallback will be used:', error);
    }
  } else {
    console.log('[seed] Cognee not configured — local knowledge fallback will be used');
  }

  console.log('\n[seed] done. Demo accounts:');
  for (const u of DEMO_USERS) console.log(`  ${u.role.padEnd(14)} ${u.email}  ${u.password}`);
  await disconnectDatabase();
}

seed().catch(async (error) => {
  console.error('[seed] failed', error);
  await disconnectDatabase();
  process.exit(1);
});
