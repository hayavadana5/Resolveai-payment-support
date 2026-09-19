import { Schema, model, InferSchemaType } from 'mongoose';

const transactionSchema = new Schema(
  {
    transactionId: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, required: true, index: true },
    merchantId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED', 'PENDING', 'REVERSED', 'REFUNDED'],
      required: true,
    },
    paymentMethod: { type: String, default: 'UPI' },
    gatewayStatus: { type: String, default: 'CAPTURED' },
    gatewayReference: { type: String, default: '' },
    orderId: { type: String, default: null },
    settlementStatus: {
      type: String,
      enum: ['SETTLED', 'PENDING', 'ON_HOLD', 'NOT_APPLICABLE'],
      default: 'PENDING',
    },
    riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'LOW' },
    riskSignals: { type: [String], default: [] },
    refundedAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type TransactionDoc = InferSchemaType<typeof transactionSchema>;
export const Transaction = model('Transaction', transactionSchema);
