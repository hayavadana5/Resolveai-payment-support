import { evaluatePolicies } from '../services/policy/engine';

describe('policy engine', () => {
  it('allows a ₹3,000 refund autonomously', () => {
    const decision = evaluatePolicies({
      action: 'INITIATE_REFUND', amount: 3000, confidence: 0.93,
      riskLevel: 'LOW', transactionStatus: 'SUCCESS', failedAttempts: 0,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.outcome).toBe('ALLOW');
  });

  it('refuses a ₹50,000 refund without human approval', () => {
    const decision = evaluatePolicies({
      action: 'INITIATE_REFUND', amount: 50000, confidence: 0.95,
      riskLevel: 'LOW', transactionStatus: 'SUCCESS', failedAttempts: 0,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.outcome).toBe('REQUIRE_APPROVAL');
    expect(decision.blockingReason).toMatch(/exceeds the autonomous ceiling/);
  });

  it('permits the ₹50,000 refund once a human has approved it', () => {
    const decision = evaluatePolicies({
      action: 'INITIATE_REFUND', amount: 50000, confidence: 0.95,
      riskLevel: 'LOW', transactionStatus: 'SUCCESS', humanApproved: true,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.approvalRequired).toBe(true);
  });

  it('blocks financial action on a high-risk transaction, approval or not', () => {
    const decision = evaluatePolicies({
      action: 'INITIATE_REFUND', amount: 1000, confidence: 0.99,
      riskLevel: 'HIGH', transactionStatus: 'SUCCESS',
      riskSignals: ['VELOCITY_SPIKE', 'DEVICE_MISMATCH'], humanApproved: true,
    });
    expect(decision.outcome).toBe('BLOCK');
    expect(decision.allowed).toBe(false);
  });

  it('sends low-confidence decisions to a human', () => {
    const decision = evaluatePolicies({
      action: 'RETRY_ORDER_CREATION', confidence: 0.55, riskLevel: 'LOW', transactionStatus: 'SUCCESS',
    });
    expect(decision.outcome).toBe('REQUIRE_APPROVAL');
  });

  it('stops retrying after repeated failures', () => {
    const decision = evaluatePolicies({
      action: 'RETRY_ORDER_CREATION', confidence: 0.95, riskLevel: 'LOW',
      transactionStatus: 'SUCCESS', failedAttempts: 2,
    });
    expect(decision.outcome).toBe('BLOCK');
  });

  it('will not refund a failed payment', () => {
    const decision = evaluatePolicies({
      action: 'INITIATE_REFUND', amount: 500, confidence: 0.95, riskLevel: 'LOW', transactionStatus: 'FAILED',
    });
    expect(decision.outcome).toBe('BLOCK');
  });
});
