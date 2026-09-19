import { Schema, model, InferSchemaType } from 'mongoose';

const customerSchema = new Schema(
  {
    customerId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    accountAgeDays: { type: Number, default: 365 },
    verified: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type CustomerDoc = InferSchemaType<typeof customerSchema>;
export const Customer = model('Customer', customerSchema);
