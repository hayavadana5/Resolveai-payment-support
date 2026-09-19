import { Schema, model, InferSchemaType } from 'mongoose';

export const AUDIT_EVENTS = [
  'CASE_CREATED',
  'AI_DECISION',
  'TOOL_CALL',
  'POLICY_EVALUATION',
  'ACTION_EXECUTED',
  'ACTION_BLOCKED',
  'WORKFLOW_INVOKED',
  'MEMORY_RETRIEVAL',
  'VERIFICATION',
  'NOTIFICATION',
  'ESCALATION',
  'HUMAN_DECISION',
  'CASE_RESOLVED',
  'AUTH',
  'ERROR',
  'LIFECYCLE_UNDERSTAND',
  'LIFECYCLE_INVESTIGATE',
  'LIFECYCLE_MEMORY',
  'LIFECYCLE_RISK',
  'LIFECYCLE_DECIDE',
  'LIFECYCLE_ACT',
  'LIFECYCLE_VERIFY',
  'LIFECYCLE_RESOLVE',
  'LIFECYCLE_ESCALATE',
] as const;

export type AuditEvent = (typeof AUDIT_EVENTS)[number];

const auditLogSchema = new Schema(
  {
    caseId: { type: String, index: true },
    event: { type: String, enum: AUDIT_EVENTS, required: true, index: true },
    actor: { type: String, required: true }, // 'AI_ORCHESTRATOR' | 'POLICY_ENGINE' | user email
    actorType: {
      type: String,
      enum: ['AI', 'SYSTEM', 'HUMAN'],
      default: 'SYSTEM',
    },
    summary: { type: String, required: true },
    detail: { type: Schema.Types.Mixed, default: {} },
    outcome: { type: String, enum: ['SUCCESS', 'FAILURE', 'BLOCKED', 'INFO'], default: 'INFO' },
    durationMs: { type: Number },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });

export type AuditLogDoc = InferSchemaType<typeof auditLogSchema>;
export const AuditLog = model('AuditLog', auditLogSchema);
