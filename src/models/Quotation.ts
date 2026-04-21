import mongoose, { Schema, Document } from "mongoose";

export interface IQuotationItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface IQuotation extends Document {
  quotationNumber: string;
  clientId: mongoose.Types.ObjectId;
  quotationDate: Date;
  validUntil: Date | null;
  items: IQuotationItem[];
  subtotal: number;
  discount: number;
  discountType: "percentage" | "fixed";
  gstEnabled: boolean;
  gstRate: number;
  cgst: number;
  sgst: number;
  total: number;
  status: "draft" | "sent" | "accepted" | "rejected";
  workflowStatus: "draft" | "review" | "sent" | "approved" | "rejected";
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: Date;
  rejectedById?: string;
  rejectedByName?: string;
  rejectedAt?: Date;
  workflowHistory: Array<{
    action: "draft" | "review" | "sent" | "approved" | "rejected";
    actorId: string;
    actorName: string;
    actorRole: "admin" | "developer" | "sales" | "client";
    note?: string;
    at: Date;
  }>;
  notes: string;
  terms: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const QuotationItemSchema = new Schema<IQuotationItem>(
  {
    description: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    rate: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const QuotationSchema = new Schema<IQuotation>(
  {
    quotationNumber: { type: String, required: true, unique: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true },
    quotationDate: { type: Date, default: Date.now },
    validUntil: { type: Date, default: null },
    items: [QuotationItemSchema],
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    discountType: { type: String, enum: ["percentage", "fixed"], default: "percentage" },
    gstEnabled: { type: Boolean, default: false },
    gstRate: { type: Number, default: 18 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    status: { type: String, enum: ["draft", "sent", "accepted", "rejected"], default: "draft" },
    workflowStatus: { type: String, enum: ["draft", "review", "sent", "approved", "rejected"], default: "draft" },
    approvedById: { type: String, default: "" },
    approvedByName: { type: String, default: "" },
    approvedAt: { type: Date, default: null },
    rejectedById: { type: String, default: "" },
    rejectedByName: { type: String, default: "" },
    rejectedAt: { type: Date, default: null },
    workflowHistory: [
      {
        action: { type: String, enum: ["draft", "review", "sent", "approved", "rejected"], required: true },
        actorId: { type: String, required: true },
        actorName: { type: String, required: true },
        actorRole: { type: String, enum: ["admin", "developer", "sales", "client"], required: true },
        note: { type: String, default: "" },
        at: { type: Date, default: Date.now },
      },
    ],
    notes: { type: String, default: "" },
    terms: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

if (process.env.NODE_ENV !== "production" && mongoose.models.Quotation) {
  mongoose.deleteModel("Quotation");
}
export default (mongoose.models.Quotation as mongoose.Model<IQuotation>) || mongoose.model<IQuotation>("Quotation", QuotationSchema);
