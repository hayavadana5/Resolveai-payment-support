export type Role = 'SUPPORT_AGENT' | 'ADMIN';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface CaseAction {
  tool: string;
  input: Record<string, unknown>;
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED';
  result: Record<string, unknown>;
  attempt: number;
  executedAt: string;
}

export interface VerificationCheck {
  name: string;
  expected: string;
  actual: string;
  passed: boolean;
}

export interface SupportCase {
  caseId: string;
  customerId: string;
  merchantId?: string;
  transactionId?: string;
  caseName: string;
  issue: string;
  source: 'EMAIL' | 'CUSTOMER_PORTAL' | 'AGENT' | 'SYSTEM';
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'INVESTIGATING' | 'ACTING' | 'VERIFYING' | 'RESOLVED' | 'ESCALATED' | 'CLOSED';
  aiConfidence: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskIntelligence?: { overallScore: number; transactionScore: number; customerScore: number; merchantScore: number; actionScore: number; historicalScore: number; level: 'LOW'|'MEDIUM'|'HIGH'; signals: Array<{signal:string; score:number; explanation:string}>; assessedAt?: string };
  actionPlan?: Array<{step:number; tool:string; purpose:string; status:'PENDING'|'RUNNING'|'SUCCESS'|'FAILED'|'BLOCKED'}>;
  memoryOutcome?: string;
  aiTeammate: { id: string; name: string; specialty: string; status: 'IDLE' | 'WORKING' | 'WAITING_HUMAN' | 'RESOLVED' };
  collaboration?: { orchestrator: string; status: 'RUNNING'|'CONSENSUS'|'HUMAN_REQUIRED'; consensus: string; agreementScore: number; findings: Array<{ teammateId:string; teammateName:string; specialty:string; status:string; confidence:number; recommendation:string; evidence:Array<{label:string;value:string}> }>; nextOwner:string; memoryMode:'COGNEE'|'LOCAL_FALLBACK'; startedAt?:string; completedAt?:string };
  autonomy: { mode: 'AUTONOMOUS' | 'HUMAN_APPROVAL' | 'HUMAN_ONLY'; reason: string };
  lifecycle: Array<{ stage: string; status: 'STARTED' | 'COMPLETED' | 'BLOCKED'; title: string; detail: string; actor: string; createdAt: string }>;
  decision?: {
    intent: string;
    confidence: number;
    risk: string;
    reasoningSummary: string;
    recommendedAction: string;
    aiMode: 'GEMINI' | 'DEMO_FALLBACK';
  };
  retrievedKnowledge: Array<{ title: string; content: string; source: string; relevance: number }>;
  memoryMode: 'COGNEE' | 'LOCAL_FALLBACK';
  actions: CaseAction[];
  verification?: {
    passed: boolean;
    beforeState: Record<string, unknown>;
    afterState: Record<string, unknown>;
    checks: VerificationCheck[];
    verifiedAt?: string;
  };
  resolution: string;
  customerNotified: boolean;
  createdAt: string;
  resolvedAt?: string;
}

export interface AuditEntry {
  _id: string;
  caseId?: string;
  event: string;
  actor: string;
  actorType: 'AI' | 'SYSTEM' | 'HUMAN';
  summary: string;
  detail?: Record<string, unknown>;
  outcome: 'SUCCESS' | 'FAILURE' | 'BLOCKED' | 'INFO';
  durationMs?: number;
  createdAt: string;
}

export interface EscalationRecord {
  escalationId: string;
  caseId: string;
  reason: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskIntelligence?: { overallScore: number; transactionScore: number; customerScore: number; merchantScore: number; actionScore: number; historicalScore: number; level: 'LOW'|'MEDIUM'|'HIGH'; signals: Array<{signal:string; score:number; explanation:string}>; assessedAt?: string };
  actionPlan?: Array<{step:number; tool:string; purpose:string; status:'PENDING'|'RUNNING'|'SUCCESS'|'FAILED'|'BLOCKED'}>;
  memoryOutcome?: string;
  aiSummary: string;
  recommendedAction: string;
  evidence: Record<string, unknown>;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'INFO_REQUESTED';
  humanDecision?: { decidedBy: string; decision: string; note: string; decidedAt: string } | null;
  createdAt: string;
  case?: SupportCase | null;
}

export interface Analytics {
  totals: {
    cases: number;
    autonomousResolutions: number;
    humanEscalations: number;
    openCases: number;
    verifiedCustomerResolutions: number;
    blockedActions: number;
  };
  rates: {
    automationRate: number;
    escalationRate: number;
    actionSuccessRate: number;
    firstTimeResolutionRate: number;
  };
  averageResolutionMs: number;
  byCategory: Record<string, number>;
}

export interface SystemModes {
  aiMode: 'GEMINI' | 'DEMO_FALLBACK';
  memoryMode: 'COGNEE' | 'LOCAL_FALLBACK';
  workflowMode: 'N8N' | 'LOCAL_FALLBACK';
  autonomousRefundCeiling: number;
  minAutonomousConfidence: number;
}

export interface Customer {
  customerId: string;
  name: string;
  email: string;
  phone: string;
}

export interface Transaction {
  transactionId: string;
  customerId: string;
  merchantId: string;
  amount: number;
  status: string;
  paymentMethod: string;
  gatewayStatus: string;
  settlementStatus: string;
  riskLevel: string;
  riskSignals: string[];
  orderId: string | null;
  refundedAmount: number;
  createdAt: string;
}
