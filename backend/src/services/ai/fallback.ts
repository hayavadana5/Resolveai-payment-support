import { env } from '../../config/env';
import type { AiDecision } from './schemas';
import type { InvestigationContext } from './prompt';

interface Txn { amount?: number; status?: string; transactionId?: string }
interface OrderInfo { exists?: boolean; order?: { status?: string } | null }
interface RiskInfo { riskLevel?: string; signals?: string[] }

/**
 * Deterministic rule-based decisioning used when Gemini is unconfigured or
 * unreachable. Surfaced in the UI as AI MODE: DEMO FALLBACK — never presented
 * as a Gemini decision.
 */
export function decideWithoutModel(ctx: InvestigationContext): AiDecision {
  const txn = (ctx.transaction ?? {}) as Txn;
  const order = (ctx.order ?? {}) as OrderInfo;
  const risk = (ctx.risk ?? {}) as RiskInfo;
  const issue = ctx.issue.toLowerCase();
  const amount = txn.amount ?? 0;
  const requested = extractAmount(ctx.issue) ?? amount;

  if (risk.riskLevel === 'HIGH' || /don'?t recognis|do not recognis|unauthori[sz]ed|didn'?t make|fraud/.test(issue)) {
    return {
      intent: 'SUSPICIOUS_TRANSACTION',
      confidence: 0.91,
      risk: 'HIGH',
      reasoningSummary: `The customer disputes transaction ${txn.transactionId ?? 'unknown'} for INR ${amount}. Risk signals present: ${(risk.signals ?? []).join(', ') || 'high-value transaction'}. Treated as potential fraud rather than a refund request; no autonomous financial action is safe here.`,
      recommendedAction: 'ESCALATE_TO_HUMAN',
    };
  }

  if (/refund|money back|return my/.test(issue)) {
    const high = requested > env.autonomousRefundCeiling;
    return {
      intent: high ? 'HIGH_VALUE_REFUND' : 'REFUND_REQUEST',
      confidence: high ? 0.88 : 0.93,
      risk: high ? 'MEDIUM' : 'LOW',
      reasoningSummary: high
        ? `Customer requests a refund of INR ${requested}, above the autonomous ceiling of INR ${env.autonomousRefundCeiling}. The payment record supports the charge, but the amount exceeds this teammate's authority.`
        : `Customer requests a refund of INR ${requested} against a captured payment with no prior refund. The amount is within autonomous authority and the transaction is low risk.`,
      recommendedAction: high ? 'ESCALATE_TO_HUMAN' : 'INITIATE_REFUND',
      refundAmount: requested,
      customerMessage: high
        ? undefined
        : `Your refund of INR ${requested} has been approved and will reach your original payment method within five working days.`,
    };
  }

  const orderMissing = order.exists === false || order.order?.status === 'NOT_CREATED';
  if (txn.status === 'SUCCESS' && orderMissing) {
    const reconciled = ctx.previousActions.some((a) => a.tool === 'reconcilePayment' && a.status === 'SUCCESS');
    return {
      intent: 'PAYMENT_ORDER_MISMATCH',
      confidence: 0.94,
      risk: 'LOW',
      reasoningSummary: `Payment ${txn.transactionId ?? ''} of INR ${amount} was captured successfully but no order record exists. This matches the known payment/order synchronisation failure pattern for this merchant, which has previously been resolved by reconciliation followed by order retry.`,
      recommendedAction: reconciled ? 'RETRY_ORDER_CREATION' : 'RECONCILE_PAYMENT',
      customerMessage: `Your order for INR ${amount} has been created. The payment was already received and nothing further is needed from you.`,
    };
  }

  return {
    intent: 'UNKNOWN',
    confidence: 0.45,
    risk: 'MEDIUM',
    reasoningSummary:
      'The available payment and order records do not clearly explain the reported issue, so confidence is below the autonomous threshold and a human should review.',
    recommendedAction: 'ESCALATE_TO_HUMAN',
  };
}

/** Pulls an amount out of free text: "₹50,000", "Rs 3000", "50000 refund". */
export function extractAmount(text: string): number | undefined {
  const match = text.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)/i) ?? text.match(/\b(\d{3,7}(?:,\d{3})*)\b/);
  if (!match?.[1]) return undefined;
  const value = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(value) ? value : undefined;
}
