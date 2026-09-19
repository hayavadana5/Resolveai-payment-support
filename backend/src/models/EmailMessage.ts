import { Schema, model, InferSchemaType } from 'mongoose';

const emailMessageSchema = new Schema({
  messageId: { type: String, required: true, unique: true, index: true },
  threadId: { type: String, default: '' },
  from: { type: String, required: true },
  fromName: { type: String, default: '' },
  to: { type: String, default: '' },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  receivedAt: { type: Date, default: Date.now },
  caseId: { type: String, index: true },
  status: { type: String, enum: ['RECEIVED', 'CASE_CREATED', 'PROCESSED', 'FAILED'], default: 'RECEIVED' },
  error: { type: String, default: '' },
}, { timestamps: true });

export type EmailMessageDoc = InferSchemaType<typeof emailMessageSchema>;
export const EmailMessage = model('EmailMessage', emailMessageSchema);
