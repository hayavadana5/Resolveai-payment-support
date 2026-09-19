import { callTool } from '../services/tools/registry';
import { AuditLog, Order, Transaction } from '../models';
import { AI_CALLER, seedWorld } from './fixtures';

beforeEach(seedWorld);

describe('controlled tool layer', () => {
  it('rejects a tool that does not exist', async () => {
    const result = await callTool('dropDatabase', {}, { caller: AI_CALLER });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('VALIDATION');
  });

  it('rejects malformed input before touching the database', async () => {
    const result = await callTool('initiateRefund', { transactionId: 'TXN-REFUND', amount: -5 }, { caller: AI_CALLER });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('VALIDATION');
    const txn = await Transaction.findOne({ transactionId: 'TXN-REFUND' });
    expect(txn?.refundedAmount).toBe(0);
  });

  it('blocks a ₹50,000 refund requested by the AI', async () => {
    const result = await callTool(
      'initiateRefund',
      { transactionId: 'TXN-BIG', amount: 50000, reason: 'customer asked' },
      { caller: AI_CALLER, caseId: 'CASE-T', confidence: 0.95 }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('POLICY');

    const txn = await Transaction.findOne({ transactionId: 'TXN-BIG' });
    expect(txn?.refundedAmount).toBe(0);
    expect(txn?.status).toBe('SUCCESS');

    const blocked = await AuditLog.findOne({ event: 'ACTION_BLOCKED' });
    expect(blocked).not.toBeNull();
  });

  it('processes an eligible ₹3,000 refund', async () => {
    const result = await callTool(
      'initiateRefund',
      { transactionId: 'TXN-REFUND', amount: 3000, reason: 'goods not delivered' },
      { caller: AI_CALLER, caseId: 'CASE-T', confidence: 0.93 }
    );
    expect(result.ok).toBe(true);
    const txn = await Transaction.findOne({ transactionId: 'TXN-REFUND' });
    expect(txn?.refundedAmount).toBe(3000);
    expect(txn?.status).toBe('REFUNDED');
  });

  it('blocks any refund on a high-risk transaction', async () => {
    const result = await callTool(
      'initiateRefund',
      { transactionId: 'TXN-FRAUD', amount: 1000, reason: 'disputed' },
      { caller: AI_CALLER, caseId: 'CASE-T', confidence: 0.95 }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('POLICY');
  });

  it('creates the missing order on retry', async () => {
    const result = await callTool('retryOrderCreation', { transactionId: 'TXN-MISMATCH' }, { caller: AI_CALLER, confidence: 0.94 });
    expect(result.ok).toBe(true);
    const order = await Order.findOne({ transactionId: 'TXN-MISMATCH' });
    expect(order?.status).toBe('CREATED');
  });

  it('writes an audit record for every call', async () => {
    await callTool('getTransaction', { transactionId: 'TXN-REFUND' }, { caller: AI_CALLER, caseId: 'CASE-A' });
    const logs = await AuditLog.find({ caseId: 'CASE-A' });
    expect(logs.length).toBeGreaterThan(0);
  });

  it('reports refund eligibility and authority separately', async () => {
    const result = await callTool('checkRefundEligibility', { transactionId: 'TXN-BIG', amount: 50000 }, { caller: AI_CALLER });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { eligible: boolean; withinAutonomousAuthority: boolean };
      expect(data.eligible).toBe(true);
      expect(data.withinAutonomousAuthority).toBe(false);
    }
  });

  it('flags the fraud transaction as high risk', async () => {
    const result = await callTool('checkRisk', { transactionId: 'TXN-FRAUD' }, { caller: AI_CALLER });
    expect(result.ok).toBe(true);
    if (result.ok) expect((result.data as { riskLevel: string }).riskLevel).toBe('HIGH');
  });
});
