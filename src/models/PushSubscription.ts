import mongoose, { Schema, Document } from "mongoose";

export interface IPushSubscription extends Document {
  userId: mongoose.Types.ObjectId;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true }
);

if (process.env.NODE_ENV !== "production" && mongoose.models.PushSubscription) {
  mongoose.deleteModel("PushSubscription");
}

export default (mongoose.models.PushSubscription as mongoose.Model<IPushSubscription>) ||
  mongoose.model<IPushSubscription>("PushSubscription", PushSubscriptionSchema);
