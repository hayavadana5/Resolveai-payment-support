import { env } from '../../config/env';
import type { PolicyContext, PolicyEvaluation } from './types';

export interface PolicyRule {
  policyId: string;
  name: string;
  description: string;
  appliesTo: (ctx: PolicyContext) => boolean;
  evaluate: (ctx: PolicyContext) => PolicyEvaluation;
}

const FINANCIAL_ACTIONS = ['INITIATE_REFUND', 'RECONCILE_PAYMENT', 'RETRY_ORDER_CREATION'];

export const policyRules: PolicyRule[] = [
  {
    policyId: 'POL-REFUND-AUTONOMOUS',
    name: 'Autonomous refund ceiling',
    description: `Refunds up to INR ${env.autonomousRefundCeiling} may be issued autonomously when the customer is otherwise eligible.`,
    appliesTo: (ctx) => ctx.action === 'INITIATE_REFUND',
    evaluate: (ctx) => {
      const amount = ctx.amount ?? 0;
      if (amount <= env.autonomousRefundCeiling) {
        return {
          policyId: 'POL-REFUND-AUTONOMOUS',
          name: 'Autonomous refund ceiling',
          outcome: 'ALLOW',
          reason: `Refund of INR ${amount} is within the autonomous ceiling of INR ${env.autonomousRefundCeiling}.`,
        };
      }
      return {
        policyId: 'POL-REFUND-AUTONOMOUS',
        name: 'Autonomous refund ceiling',
        outcome: 'REQUIRE_APPROVAL',
        reason: `Refund of INR ${amount} exceeds the autonomous ceiling of INR ${env.autonomousRefundCeiling} and needs human approval.`,
      };
    },
  },
  {
    policyId: 'POL-RISK-SUSPICIOUS',
    name: 'Suspicious transaction hold',
    description: 'Any transaction flagged HIGH risk blocks autonomous financial action and must reach a human.',
    appliesTo: (ctx) => FINANCIAL_ACTIONS.includes(ctx.action),
    evaluate: (ctx) => {
      const high = ctx.riskLevel === 'HIGH' || (ctx.riskSignals?.length ?? 0) >= 2;
      return high
        ? {
            policyId: 'POL-RISK-SUSPICIOUS',
            name: 'Suspicious transaction hold',
            outcome: 'BLOCK',
            reason: `Transaction carries high-risk signals (${(ctx.riskSignals ?? []).join(', ') || 'risk level HIGH'}). Autonomous financial action is not permitted.`,
          }
        : {
            policyId: 'POL-RISK-SUSPICIOUS',
            name: 'Suspicious transaction hold',
            outcome: 'ALLOW',
            reason: 'No high-risk signals present on this transaction.',
          };
    },
  },
  {
    policyId: 'POL-CONFIDENCE-FLOOR',
    name: 'Confidence floor',
    description: `The AI may only act autonomously at confidence >= ${env.minAutonomousConfidence}.`,
    appliesTo: (ctx) => ctx.action !== 'NO_ACTION' && ctx.action !== 'ESCALATE_TO_HUMAN',
    evaluate: (ctx) => {
      const confidence = ctx.confidence ?? 0;
      return confidence >= env.minAutonomousConfidence
        ? {
            policyId: 'POL-CONFIDENCE-FLOOR',
            name: 'Confidence floor',
            outcome: 'ALLOW',
            reason: `Confidence ${confidence.toFixed(2)} meets the ${env.minAutonomousConfidence} floor.`,
          }
        : {
            policyId: 'POL-CONFIDENCE-FLOOR',
            name: 'Confidence floor',
            outcome: 'REQUIRE_APPROVAL',
            reason: `Confidence ${confidence.toFixed(2)} is below the ${env.minAutonomousConfidence} floor, so a human reviews before acting.`,
          };
    },
  },
  {
    policyId: 'POL-REPEATED-FAILURE',
    name: 'Repeated action failure',
    description: `After ${env.maxActionAttempts} failed attempts the case escalates instead of retrying.`,
    appliesTo: (ctx) => (ctx.failedAttempts ?? 0) > 0,
    evaluate: (ctx) => {
      const failures = ctx.failedAttempts ?? 0;
      return failures >= env.maxActionAttempts
        ? {
            policyId: 'POL-REPEATED-FAILURE',
            name: 'Repeated action failure',
            outcome: 'BLOCK',
            reason: `${failures} attempts have already failed. Further autonomous retries are blocked.`,
          }
        : {
            policyId: 'POL-REPEATED-FAILURE',
            name: 'Repeated action failure',
            outcome: 'ALLOW',
            reason: `${failures} prior failure(s), below the retry limit of ${env.maxActionAttempts}.`,
          };
    },
  },
  {
    policyId: 'POL-REFUND-ELIGIBILITY',
    name: 'Refund eligibility',
    description: 'A refund requires a captured payment that has not already been refunded or reversed.',
    appliesTo: (ctx) => ctx.action === 'INITIATE_REFUND',
    evaluate: (ctx) => {
      const status = ctx.transactionStatus;
      if (status === 'SUCCESS') {
        return {
          policyId: 'POL-REFUND-ELIGIBILITY',
          name: 'Refund eligibility',
          outcome: 'ALLOW',
          reason: 'Payment was captured successfully and is refundable.',
        };
      }
      return {
        policyId: 'POL-REFUND-ELIGIBILITY',
        name: 'Refund eligibility',
        outcome: 'BLOCK',
        reason: `Transaction status is ${status ?? 'UNKNOWN'}; only SUCCESS transactions can be refunded.`,
      };
    },
  },
];

export const policyRuleCatalogue = policyRules.map((rule) => ({
  policyId: rule.policyId,
  name: rule.name,
  description: rule.description,
}));
