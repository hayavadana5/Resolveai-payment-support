export type Role = 'SUPPORT_AGENT' | 'ADMIN';

export type TransactionStatus = 'SUCCESS' | 'FAILED' | 'PENDING' | 'REVERSED' | 'REFUNDED';
export type OrderStatus = 'CREATED' | 'NOT_CREATED' | 'FAILED' | 'CANCELLED';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type CaseStatus =
  | 'OPEN'
  | 'INVESTIGATING'
  | 'ACTING'
  | 'VERIFYING'
  | 'RESOLVED'
  | 'ESCALATED'
  | 'CLOSED';
export type CasePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type CaseCategory =
  | 'PAYMENT_ORDER_MISMATCH'
  | 'REFUND_REQUEST'
  | 'HIGH_VALUE_REFUND'
  | 'SUSPICIOUS_TRANSACTION'
  | 'SETTLEMENT_DELAY'
  | 'GENERAL_QUERY'
  | 'UNKNOWN';

export type RecommendedAction =
  | 'RETRY_ORDER_CREATION'
  | 'RECONCILE_PAYMENT'
  | 'INITIATE_REFUND'
  | 'NOTIFY_CUSTOMER'
  | 'ESCALATE_TO_HUMAN'
  | 'NO_ACTION';

export type EscalationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'INFO_REQUESTED';

export type AiMode = 'GEMINI' | 'DEMO_FALLBACK';
export type MemoryMode = 'COGNEE' | 'LOCAL_FALLBACK';
export type ActionStepStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'BLOCKED';
