import { Order, Transaction } from '../../models';
import { recordAudit } from '../audit.service';

export interface StateSnapshot {
  transactionStatus?: string;
  gatewayStatus?: string;
  orderStatus?: string;
  orderId?: string | null;
  refundedAmount?: number;
  settlementStatus?: string;
}

export interface VerificationCheck {
  name: string;
  expected: string;
  actual: string;
  passed: boolean;
}

export interface VerificationOutcome {
  passed: boolean;
  beforeState: StateSnapshot;
  afterState: StateSnapshot;
  checks: VerificationCheck[];
  verifiedAt: Date;
}

/** Reads real state from MongoDB. Never trusts an action's own return value. */
export async function captureState(transactionId: string): Promise<StateSnapshot> {
  const [txn, order] = await Promise.all([
    Transaction.findOne({ transactionId }).lean(),
    Order.findOne({ transactionId }).lean(),
  ]);
  return {
    transactionStatus: txn?.status,
    gatewayStatus: txn?.gatewayStatus,
    settlementStatus: txn?.settlementStatus,
    refundedAmount: txn?.refundedAmount ?? 0,
    orderStatus: order?.status ?? 'NOT_CREATED',
    orderId: order?.orderId ?? null,
  };
}

interface VerifyArgs {
  caseId: string;
  transactionId: string;
  action: string;
  beforeState: StateSnapshot;
  expectedRefundAmount?: number;
}

/**
 * Re-reads state after an action and asserts the world actually changed the way
 * it was supposed to. A case is only ever resolved on the back of this passing.
 */
export async function verifyAction(args: VerifyArgs): Promise<VerificationOutcome> {
  const { caseId, transactionId, action, beforeState } = args;
  const afterState = await captureState(transactionId);
  const checks: VerificationCheck[] = [];

  const check = (name: string, expected: string, actual: string | undefined) =>
    checks.push({ name, expected, actual: actual ?? 'undefined', passed: expected === actual });

  switch (action) {
    case 'RETRY_ORDER_CREATION':
      check('Order exists', 'CREATED', afterState.orderStatus);
      check('Payment still captured', 'SUCCESS', afterState.transactionStatus);
      checks.push({
        name: 'Order identifier assigned',
        expected: 'non-null',
        actual: afterState.orderId ? String(afterState.orderId) : 'null',
        passed: Boolean(afterState.orderId),
      });
      break;

    case 'RECONCILE_PAYMENT':
      check('Gateway reconciled', 'RECONCILED', afterState.gatewayStatus);
      check('Payment still captured', 'SUCCESS', afterState.transactionStatus);
      break;

    case 'INITIATE_REFUND': {
      const expectedRefund = (beforeState.refundedAmount ?? 0) + (args.expectedRefundAmount ?? 0);
      checks.push({
        name: 'Refunded amount increased',
        expected: `>= ${expectedRefund}`,
        actual: String(afterState.refundedAmount ?? 0),
        passed: (afterState.refundedAmount ?? 0) >= expectedRefund,
      });
      checks.push({
        name: 'Transaction marked refunded',
        expected: 'REFUNDED',
        actual: String(afterState.transactionStatus),
        passed: afterState.transactionStatus === 'REFUNDED',
      });
      break;
    }

    default:
      checks.push({
        name: 'Action recognised by verification engine',
        expected: 'known action',
        actual: action,
        passed: false,
      });
  }

  const passed = checks.length > 0 && checks.every((c) => c.passed);
  const outcome: VerificationOutcome = { passed, beforeState, afterState, checks, verifiedAt: new Date() };

  await recordAudit({
    caseId,
    event: 'VERIFICATION',
    actor: 'VERIFICATION_ENGINE',
    summary: passed
      ? `Verified ${action}: state changed as expected`
      : `Verification failed for ${action}: ${checks.filter((c) => !c.passed).map((c) => c.name).join(', ')}`,
    detail: { beforeState, afterState, checks },
    outcome: passed ? 'SUCCESS' : 'FAILURE',
  });

  return outcome;
}
