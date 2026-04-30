import mongoose, { Schema, Document } from "mongoose";

export interface IInvoiceItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface IInvoice extends Document {
  invoiceNumber: string;
  clientId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId | null;
  invoiceDate: Date;
  dueDate: Date | null;
  items: IInvoiceItem[];
  subtotal: number;
  discount: number;
  discountType: "percentage" | "fixed";
  gstEnabled: boolean;
  gstRate: number;
  cgst: number;
  sgst: number;
  total: number;
  status: "paid" | "unpaid" | "overdue";
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
  pdfFileName?: string;
  pdfFileUrl?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceItemSchema = new Schema<IInvoiceItem>(
  {
    description: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1 },
    rate: { type: Number, required: true },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

const InvoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: { type: String, required: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    invoiceDate: { type: Date, default: Date.now },
    dueDate: { type: Date, default: null },
    items: [InvoiceItemSchema],
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    discountType: { type: String, enum: ["percentage", "fixed"], default: "fixed" },
    gstEnabled: { type: Boolean, default: false },
    gstRate: { type: Number, default: 18 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    total: { type: Number, required: true },
    status: { type: String, enum: ["paid", "unpaid", "overdue"], default: "unpaid" },
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
    pdfFileName: { type: String, default: "" },
    pdfFileUrl: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

if (process.env.NODE_ENV !== "production" && mongoose.models.Invoice) {
  mongoose.deleteModel("Invoice");
}
export default (mongoose.models.Invoice as mongoose.Model<IInvoice>) || mongoose.model<IInvoice>("Invoice", InvoiceSchema);
