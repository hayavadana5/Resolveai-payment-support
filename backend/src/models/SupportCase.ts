import { Schema, model, InferSchemaType } from 'mongoose';
import crypto from 'crypto';

const actionSchema = new Schema(
  {
    tool: { type: String, required: true },
    input: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['SUCCESS', 'FAILED', 'BLOCKED'], required: true },
    result: { type: Schema.Types.Mixed, default: {} },
    attempt: { type: Number, default: 1 },
    executedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const decisionSchema = new Schema(
  {
    intent: { type: String, default: 'UNKNOWN' },
    confidence: { type: Number, default: 0 },
    risk: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'LOW' },
    reasoningSummary: { type: String, default: '' },
    recommendedAction: { type: String, default: 'NO_ACTION' },
    aiMode: { type: String, enum: ['GEMINI', 'DEMO_FALLBACK'], default: 'DEMO_FALLBACK' },
  },
  { _id: false }
);

const lifecycleEventSchema = new Schema(
  {
    stage: { type: String, enum: ['UNDERSTAND', 'INVESTIGATE', 'MEMORY', 'RISK', 'DECIDE', 'ACT', 'VERIFY', 'RESOLVE', 'ESCALATE'], required: true },
    status: { type: String, enum: ['STARTED', 'COMPLETED', 'BLOCKED'], default: 'COMPLETED' },
    title: { type: String, required: true },
    detail: { type: String, default: '' },
    actor: { type: String, default: 'AI_ORCHESTRATOR' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const riskIntelligenceSchema = new Schema(
  {
    overallScore: { type: Number, default: 0 },
    transactionScore: { type: Number, default: 0 },
    customerScore: { type: Number, default: 0 },
    merchantScore: { type: Number, default: 0 },
    actionScore: { type: Number, default: 0 },
    historicalScore: { type: Number, default: 0 },
    level: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'LOW' },
    signals: { type: [{ signal: String, score: Number, explanation: String }], default: [] },
    assessedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const verificationSchema = new Schema(
  {
    passed: { type: Boolean, default: false },
    beforeState: { type: Schema.Types.Mixed, default: {} },
    afterState: { type: Schema.Types.Mixed, default: {} },
    checks: {
      type: [{ name: String, expected: String, actual: String, passed: Boolean }],
      default: [],
    },
    verifiedAt: { type: Date },
  },
  { _id: false }
);

const teammateFindingSchema = new Schema(
  {
    teammateId: { type: String, required: true },
    teammateName: { type: String, required: true },
    specialty: { type: String, required: true },
    status: { type: String, enum: ['WORKING', 'COMPLETED', 'BLOCKED'], default: 'COMPLETED' },
    confidence: { type: Number, default: 0 },
    recommendation: { type: String, default: '' },
    evidence: { type: [{ label: String, value: String }], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const collaborationSchema = new Schema(
  {
    orchestrator: { type: String, default: 'AI Orchestrator' },
    status: { type: String, enum: ['RUNNING', 'CONSENSUS', 'HUMAN_REQUIRED'], default: 'RUNNING' },
    consensus: { type: String, default: '' },
    agreementScore: { type: Number, default: 0 },
    findings: { type: [teammateFindingSchema], default: [] },
    nextOwner: { type: String, default: '' },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { _id: false }
);

const supportCaseSchema = new Schema(
  {
    caseId: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, required: true, index: true },
    merchantId: { type: String, index: true },
    transactionId: { type: String, index: true },
    caseName: { type: String, required: true },
    issue: { type: String, required: true },
    source: { type: String, enum: ['EMAIL', 'CUSTOMER_PORTAL', 'AGENT', 'SYSTEM'], default: 'AGENT' },
    category: { type: String, default: 'UNKNOWN' },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
    status: {
      type: String,
      enum: ['OPEN', 'INVESTIGATING', 'ACTING', 'VERIFYING', 'RESOLVED', 'ESCALATED', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },
    aiConfidence: { type: Number, default: 0 },
    collaboration: { type: collaborationSchema, default: () => ({}) },
    aiTeammate: {
      id: { type: String, default: 'payment-resolution' },
      name: { type: String, default: 'Payment Resolution Teammate' },
      specialty: { type: String, default: 'Payment & order resolution' },
      status: { type: String, enum: ['IDLE', 'WORKING', 'WAITING_HUMAN', 'RESOLVED'], default: 'IDLE' },
    },
    autonomy: {
      mode: { type: String, enum: ['AUTONOMOUS', 'HUMAN_APPROVAL', 'HUMAN_ONLY'], default: 'AUTONOMOUS' },
      reason: { type: String, default: '' },
    },
    lifecycle: { type: [lifecycleEventSchema], default: [] },
    riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'LOW' },
    riskIntelligence: { type: riskIntelligenceSchema, default: () => ({}) },
    actionPlan: { type: [{ step: Number, tool: String, purpose: String, status: { type: String, enum: ['PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'BLOCKED'], default: 'PENDING' } }], default: [] },
    memoryOutcome: { type: String, default: '' },
    decision: { type: decisionSchema, default: () => ({}) },
    retrievedKnowledge: {
      type: [{ title: String, content: String, source: String, relevance: Number }],
      default: [],
    },
    memoryMode: { type: String, enum: ['COGNEE', 'LOCAL_FALLBACK'], default: 'LOCAL_FALLBACK' },
    policyEvaluations: {
      type: [
        {
          policyId: String,
          name: String,
          outcome: { type: String, enum: ['ALLOW', 'REQUIRE_APPROVAL', 'BLOCK'] },
          reason: String,
        },
      ],
      default: [],
    },
    actions: { type: [actionSchema], default: [] },
    verification: { type: verificationSchema, default: () => ({}) },
    resolution: { type: String, default: '' },
    customerNotified: { type: Boolean, default: false },
    portalToken: { type: String, default: () => `portal_${crypto.randomBytes(24).toString('hex')}`, unique: true, index: true },
    intake: {
      channel: { type: String, enum: ['EMAIL', 'CUSTOMER_PORTAL', 'AGENT', 'SYSTEM'], default: 'AGENT' },
      externalMessageId: { type: String, index: true },
      senderEmail: { type: String, default: '' },
      senderName: { type: String, default: '' },
      receivedAt: { type: Date },
    },
    createdBy: { type: String, default: 'system' },
    resolvedAt: { type: Date },
    firstAttemptResolved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export type SupportCaseDoc = InferSchemaType<typeof supportCaseSchema>;
export const SupportCase = model('SupportCase', supportCaseSchema);
