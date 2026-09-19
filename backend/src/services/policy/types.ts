import type { RiskLevel } from '../../models/types';

export type PolicyOutcome = 'ALLOW' | 'REQUIRE_APPROVAL' | 'BLOCK';

export interface PolicyContext {
  action: string;
  amount?: number;
  confidence?: number;
  riskLevel?: RiskLevel;
  transactionStatus?: string;
  orderStatus?: string;
  failedAttempts?: number;
  actorRole?: 'SUPPORT_AGENT' | 'ADMIN' | 'AI';
  humanApproved?: boolean;
  riskSignals?: string[];
}

export interface PolicyEvaluation {
  policyId: string;
  name: string;
  outcome: PolicyOutcome;
  reason: string;
}

export interface PolicyDecision {
  outcome: PolicyOutcome;
  /** True only when the action may be executed right now without a human. */
  allowed: boolean;
  approvalRequired: boolean;
  blockingReason?: string;
  evaluations: PolicyEvaluation[];
}
