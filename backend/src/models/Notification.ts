import { Schema, model, InferSchemaType } from 'mongoose';

const notificationSchema = new Schema(
  {
    caseId: { type: String, index: true },
    channel: { type: String, enum: ['EMAIL', 'SMS', 'IN_APP'], default: 'EMAIL' },
    recipient: { type: String, required: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    status: { type: String, enum: ['SENT', 'FAILED'], default: 'SENT' },
    deliveredVia: { type: String, default: 'LOCAL_SIMULATION' },
  },
  { timestamps: true }
);

export type NotificationDoc = InferSchemaType<typeof notificationSchema>;
export const Notification = model('Notification', notificationSchema);
