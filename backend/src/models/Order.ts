import { Schema, model, InferSchemaType } from 'mongoose';

const orderSchema = new Schema(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    transactionId: { type: String, required: true, index: true },
    customerId: { type: String, required: true },
    merchantId: { type: String, required: true },
    amount: { type: Number, required: true },
    items: {
      type: [{ name: String, quantity: Number, price: Number }],
      default: [],
    },
    status: {
      type: String,
      enum: ['CREATED', 'NOT_CREATED', 'FAILED', 'CANCELLED'],
      required: true,
    },
    failureReason: { type: String, default: '' },
  },
  { timestamps: true }
);

export type OrderDoc = InferSchemaType<typeof orderSchema>;
export const Order = model('Order', orderSchema);
