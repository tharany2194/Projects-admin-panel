import mongoose, { Schema, Document } from "mongoose";

export interface IProjectFile {
  key: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: string;
  uploadedById: string;
  uploadedByName: string;
  uploadedByRole: "admin" | "developer" | "sales" | "client";
}

export interface IProjectFileHistory {
  action: "uploaded" | "deleted";
  fileKey: string;
  fileName: string;
  actorId: string;
  actorName: string;
  actorRole: "admin" | "developer" | "sales" | "client";
  actedAt: Date;
}

export interface IProjectTask {
  title: string;
  done: boolean;
}

export interface IProjectNote {
  text: string;
  authorId: string;
  authorName: string;
  authorRole: "admin" | "developer" | "sales" | "client";
  createdAt: Date;
}

export interface IProject extends Document {
  title: string;
  clientId: mongoose.Types.ObjectId;
  status: "new" | "in_progress" | "completed" | "on_hold";
  clientStage: "planning" | "design" | "development" | "testing" | "deployment" | "handover";
  clientProgressPercent: number;
  deadline: Date | null;
  cost: number;
  paymentStatus: "advance" | "pending" | "paid";
  advanceAmount: number;
  description: string;
  tasks: IProjectTask[];
  notes: IProjectNote[];
  files: IProjectFile[];
  fileHistory: IProjectFileHistory[];
  assignedTo: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectFileSchema = new Schema<IProjectFile>(
  {
    key: { type: String, required: true },
    name: { type: String, required: true },
    size: { type: Number, required: true },
    type: { type: String, required: true },
    url: { type: String, required: true },
    uploadedAt: { type: String, required: true },
    uploadedById: { type: String, required: true },
    uploadedByName: { type: String, required: true },
    uploadedByRole: { type: String, enum: ["admin", "developer", "sales", "client"], required: true },
  },
  { _id: false }
);

const ProjectFileHistorySchema = new Schema<IProjectFileHistory>(
  {
    action: { type: String, enum: ["uploaded", "deleted"], required: true },
    fileKey: { type: String, required: true },
    fileName: { type: String, required: true },
    actorId: { type: String, required: true },
    actorName: { type: String, required: true },
    actorRole: { type: String, enum: ["admin", "developer", "sales", "client"], required: true },
    actedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ProjectTaskSchema = new Schema<IProjectTask>(
  {
    title: { type: String, required: true },
    done: { type: Boolean, default: false },
  },
  { _id: false }
);

const ProjectNoteSchema = new Schema<IProjectNote>(
  {
    text: { type: String, required: true },
    authorId: { type: String, required: true },
    authorName: { type: String, required: true },
    authorRole: { type: String, enum: ["admin", "developer", "sales", "client"], required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ProjectSchema = new Schema<IProject>(
  {
    title: { type: String, required: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true },
    status: { type: String, enum: ["new", "in_progress", "completed", "on_hold"], default: "new" },
    clientStage: {
      type: String,
      enum: ["planning", "design", "development", "testing", "deployment", "handover"],
      default: "planning",
    },
    clientProgressPercent: { type: Number, min: 0, max: 100, default: 0 },
    deadline: { type: Date, default: null },
    cost: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ["advance", "pending", "paid"], default: "pending" },
    advanceAmount: { type: Number, default: 0 },
    description: { type: String, default: "" },
    tasks: [ProjectTaskSchema],
    notes: [ProjectNoteSchema],
    files: [ProjectFileSchema],
    fileHistory: [ProjectFileHistorySchema],
    assignedTo: [{ type: Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

if (process.env.NODE_ENV !== "production" && mongoose.models.Project) {
  mongoose.deleteModel("Project");
}
export default (mongoose.models.Project as mongoose.Model<IProject>) || mongoose.model<IProject>("Project", ProjectSchema);
