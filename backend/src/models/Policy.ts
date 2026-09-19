import { Schema, model, InferSchemaType } from 'mongoose';

const policySchema = new Schema(
  {
    policyId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    // Declarative conditions evaluated by the backend policy engine.
    conditions: { type: Schema.Types.Mixed, default: {} },
    allowedAction: { type: String, default: 'ANY' },
    approvalRequired: { type: Boolean, default: false },
    riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'LOW' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type PolicyDoc = InferSchemaType<typeof policySchema>;
export const Policy = model('Policy', policySchema);
