import mongoose, { Schema, Document } from "mongoose";

export interface IRecurringPayment {
  _id?: mongoose.Types.ObjectId;
  label: string;
  amount: number;
  frequency: "monthly" | "quarterly" | "yearly";
  startDate: Date;
  endDate?: Date | null;
  nextDueDate: Date;
  active: boolean;
  paused: boolean;
  pausedAt?: Date | null;
  pauseReason?: string;
  autoGenerateInvoice: boolean;
  prorationMode: "none" | "daily";
  projectId?: mongoose.Types.ObjectId | null;
  lastGeneratedAt?: Date | null;
}

export interface IPaymentLog {
  amount: number;
  label: string;
  paidAt: Date;
  notes: string;
  recurringPaymentId?: mongoose.Types.ObjectId | null;
  recurringDueDate?: Date | null;
}

export interface IClient extends Document {
  name: string;
  type: "individual" | "business";
  email: string;
  password: string;
  portalAccessEnabled: boolean;
  phone: string;
  whatsapp: string;
  address: string;
  gstNumber: string;
  tags: string[];
  notes: string;
  assignedTo: mongoose.Types.ObjectId[];
  recurringPayments: IRecurringPayment[];
  paymentHistory: IPaymentLog[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RecurringPaymentSchema = new Schema<IRecurringPayment>(
  {
    label: { type: String, required: true },
    amount: { type: Number, required: true },
    frequency: { type: String, enum: ["monthly", "quarterly", "yearly"], default: "monthly" },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    nextDueDate: { type: Date, required: true },
    active: { type: Boolean, default: true },
    paused: { type: Boolean, default: false },
    pausedAt: { type: Date, default: null },
    pauseReason: { type: String, default: "" },
    autoGenerateInvoice: { type: Boolean, default: true },
    prorationMode: { type: String, enum: ["none", "daily"], default: "none" },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    lastGeneratedAt: { type: Date, default: null },
  },
  { _id: true }
);

const PaymentLogSchema = new Schema<IPaymentLog>(
  {
    amount: { type: Number, required: true },
    label: { type: String, required: true },
    paidAt: { type: Date, default: Date.now },
    notes: { type: String, default: "" },
    recurringPaymentId: { type: Schema.Types.ObjectId, default: null },
    recurringDueDate: { type: Date, default: null },
  },
  { _id: true }
);

const ClientSchema = new Schema<IClient>(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ["individual", "business"], default: "individual" },
    email: { type: String, default: "" },
    password: { type: String, default: "" },
    portalAccessEnabled: { type: Boolean, default: false },
    phone: { type: String, default: "" },
    whatsapp: { type: String, default: "" },
    address: { type: String, default: "" },
    gstNumber: { type: String, default: "" },
    tags: [{ type: String }],
    notes: { type: String, default: "" },
    assignedTo: [{ type: Schema.Types.ObjectId, ref: "User" }],
    recurringPayments: [RecurringPaymentSchema],
    paymentHistory: [PaymentLogSchema],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

ClientSchema.index({ name: "text", email: "text" });

if (process.env.NODE_ENV !== "production" && mongoose.models.Client) {
  mongoose.deleteModel("Client");
}
export default (mongoose.models.Client as mongoose.Model<IClient>) || mongoose.model<IClient>("Client", ClientSchema);
