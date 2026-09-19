import { Order, Transaction } from '../models';
import { captureState, verifyAction } from '../services/verification/engine';
import { callTool } from '../services/tools/registry';
import { AI_CALLER, seedWorld } from './fixtures';

beforeEach(seedWorld);

describe('verification engine', () => {
  it('passes when the order actually gets created', async () => {
    const before = await captureState('TXN-MISMATCH');
    expect(before.orderStatus).toBe('NOT_CREATED');

    await callTool('retryOrderCreation', { transactionId: 'TXN-MISMATCH' }, { caller: AI_CALLER, confidence: 0.94 });

    const outcome = await verifyAction({
      caseId: 'CASE-V', transactionId: 'TXN-MISMATCH', action: 'RETRY_ORDER_CREATION', beforeState: before,
    });
    expect(outcome.passed).toBe(true);
    expect(outcome.afterState.orderStatus).toBe('CREATED');
  });

  it('fails when an action claimed success but state did not change', async () => {
    const before = await captureState('TXN-MISMATCH');
    // Nothing is executed — verification must not take the claim on trust.
    const outcome = await verifyAction({
      caseId: 'CASE-V', transactionId: 'TXN-MISMATCH', action: 'RETRY_ORDER_CREATION', beforeState: before,
    });
    expect(outcome.passed).toBe(false);
    expect(outcome.checks.some((c) => !c.passed)).toBe(true);
  });

  it('fails when the order row exists but is still NOT_CREATED', async () => {
    await Order.create({ orderId: 'ORD-STUCK', transactionId: 'TXN-MISMATCH', customerId: 'CUS-1', merchantId: 'MRC-1', amount: 2499, status: 'NOT_CREATED' });
    const before = await captureState('TXN-MISMATCH');
    const outcome = await verifyAction({ caseId: 'CASE-V', transactionId: 'TXN-MISMATCH', action: 'RETRY_ORDER_CREATION', beforeState: before });
    expect(outcome.passed).toBe(false);
  });

  it('confirms a refund moved the money', async () => {
    const before = await captureState('TXN-REFUND');
    await Transaction.updateOne({ transactionId: 'TXN-REFUND' }, { $set: { refundedAmount: 3000, status: 'REFUNDED' } });
    const outcome = await verifyAction({
      caseId: 'CASE-V', transactionId: 'TXN-REFUND', action: 'INITIATE_REFUND', beforeState: before, expectedRefundAmount: 3000,
    });
    expect(outcome.passed).toBe(true);
  });

  it('rejects an action it does not know how to verify', async () => {
    const before = await captureState('TXN-REFUND');
    const outcome = await verifyAction({ caseId: 'CASE-V', transactionId: 'TXN-REFUND', action: 'TELEPORT_FUNDS', beforeState: before });
    expect(outcome.passed).toBe(false);
  });
});
