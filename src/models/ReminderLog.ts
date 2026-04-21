import mongoose, { Schema, Document } from "mongoose";

export interface IReminderLog extends Document {
  invoiceId: mongoose.Types.ObjectId;
  reminderType: "upcoming" | "overdue";
  reminderDateKey: string;
  channels: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ReminderLogSchema = new Schema<IReminderLog>(
  {
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", required: true },
    reminderType: { type: String, enum: ["upcoming", "overdue"], required: true },
    reminderDateKey: { type: String, required: true },
    channels: [{ type: String }],
  },
  { timestamps: true }
);

ReminderLogSchema.index({ invoiceId: 1, reminderType: 1, reminderDateKey: 1 }, { unique: true });

if (process.env.NODE_ENV !== "production" && mongoose.models.ReminderLog) {
  mongoose.deleteModel("ReminderLog");
}

export default (mongoose.models.ReminderLog as mongoose.Model<IReminderLog>) || mongoose.model<IReminderLog>("ReminderLog", ReminderLogSchema);
