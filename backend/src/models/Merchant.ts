import { Schema, model, InferSchemaType } from 'mongoose';

const merchantSchema = new Schema(
  {
    merchantId: { type: String, required: true, unique: true, index: true },
    businessName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    category: { type: String, default: 'RETAIL' },
    riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'LOW' },
    knownIssues: { type: [String], default: [] },
  },
  { timestamps: true }
);

export type MerchantDoc = InferSchemaType<typeof merchantSchema>;
export const Merchant = model('Merchant', merchantSchema);
