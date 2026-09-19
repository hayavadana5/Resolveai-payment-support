import { Schema, model, InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['SUPPORT_AGENT', 'ADMIN'], required: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = model('User', userSchema);
