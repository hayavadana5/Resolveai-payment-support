import { Schema, model, InferSchemaType } from 'mongoose';

const escalationSchema = new Schema(
  {
    escalationId: { type: String, required: true, unique: true, index: true },
    caseId: { type: String, required: true, index: true },
    reason: { type: String, required: true },
    riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
    aiSummary: { type: String, default: '' },
    recommendedAction: { type: String, default: 'NO_ACTION' },
    evidence: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'INFO_REQUESTED'],
      default: 'PENDING',
      index: true,
    },
    humanDecision: {
      type: {
        decidedBy: String,
        decision: String,
        note: String,
        decidedAt: Date,
      },
      default: null,
    },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

export type EscalationDoc = InferSchemaType<typeof escalationSchema>;
export const Escalation = model('Escalation', escalationSchema);
