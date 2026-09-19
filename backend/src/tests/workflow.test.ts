import { Escalation, Order, SupportCase, Transaction } from '../models';
import { runAutonomousCase } from '../services/workflow/runCase';
import { makeCase, seedWorld } from './fixtures';

const caller = { type: 'AI' as const, identifier: 'AI_ORCHESTRATOR', role: 'AI' as const };

beforeEach(seedWorld);

describe('autonomous case workflow', () => {
  it('resolves a payment/order mismatch end to end', async () => {
    await makeCase('CASE-W1', 'TXN-MISMATCH', '₹2,499 was deducted but my order wasn\u2019t placed.');
    const outcome = await runAutonomousCase({ caseId: 'CASE-W1', caller });

    expect(outcome.resolved).toBe(true);
    expect(outcome.status).toBe('RESOLVED');

    const order = await Order.findOne({ transactionId: 'TXN-MISMATCH' });
    expect(order?.status).toBe('CREATED');

    const supportCase = await SupportCase.findOne({ caseId: 'CASE-W1' });
    expect(supportCase?.verification?.passed).toBe(true);
    expect(supportCase?.customerNotified).toBe(true);
    expect(supportCase?.retrievedKnowledge.length).toBeGreaterThan(0);
    expect(supportCase?.decision?.intent).toBe('PAYMENT_ORDER_MISMATCH');
  });

  it('refunds an eligible ₹3,000 request and verifies it', async () => {
    await makeCase('CASE-W2', 'TXN-REFUND', 'I want a refund for my ₹3,000 payment.');
    const outcome = await runAutonomousCase({ caseId: 'CASE-W2', caller });

    expect(outcome.resolved).toBe(true);
    const txn = await Transaction.findOne({ transactionId: 'TXN-REFUND' });
    expect(txn?.status).toBe('REFUNDED');
    expect(txn?.refundedAmount).toBe(3000);
  });

  it('escalates a ₹50,000 refund instead of issuing it', async () => {
    await makeCase('CASE-W3', 'TXN-BIG', 'I want a ₹50,000 refund.');
    const outcome = await runAutonomousCase({ caseId: 'CASE-W3', caller });

    expect(outcome.escalated).toBe(true);
    expect(outcome.status).toBe('ESCALATED');

    const txn = await Transaction.findOne({ transactionId: 'TXN-BIG' });
    expect(txn?.refundedAmount).toBe(0);
    expect(txn?.status).toBe('SUCCESS');

    const escalation = await Escalation.findOne({ caseId: 'CASE-W3' });
    expect(escalation?.status).toBe('PENDING');
  });

  it('escalates a disputed transaction without touching the money', async () => {
    await makeCase('CASE-W4', 'TXN-FRAUD', 'I don\u2019t recognize this ₹45,000 transaction.', 'CUS-2');
    const outcome = await runAutonomousCase({ caseId: 'CASE-W4', caller });

    expect(outcome.escalated).toBe(true);
    const txn = await Transaction.findOne({ transactionId: 'TXN-FRAUD' });
    expect(txn?.status).toBe('SUCCESS');
    expect(txn?.refundedAmount).toBe(0);

    const supportCase = await SupportCase.findOne({ caseId: 'CASE-W4' });
    expect(supportCase?.riskLevel).toBe('HIGH');
    expect(supportCase?.decision?.intent).toBe('SUSPICIOUS_TRANSACTION');
  });

  it('records the mode it actually used rather than claiming Gemini or Cognee', async () => {
    await makeCase('CASE-W5', 'TXN-MISMATCH', '₹2,499 deducted, no order.');
    await runAutonomousCase({ caseId: 'CASE-W5', caller });
    const supportCase = await SupportCase.findOne({ caseId: 'CASE-W5' });
    // No API keys are set in the test environment, so both must report fallback.
    expect(supportCase?.decision?.aiMode).toBe('DEMO_FALLBACK');
    expect(supportCase?.memoryMode).toBe('LOCAL_FALLBACK');
  });
});
