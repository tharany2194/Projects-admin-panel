import mongoose, { Schema, Document } from "mongoose";

export interface ITask extends Document {
  title: string;
  description: string;
  projectId: mongoose.Types.ObjectId | null;
  assignedTo: mongoose.Types.ObjectId | null;
  history: {
    action: "created" | "updated" | "status_changed" | "reassigned";
    field?: string;
    from?: string;
    to?: string;
    note?: string;
    at: Date;
    actorId: mongoose.Types.ObjectId;
  }[];
  status: "todo" | "doing" | "done";
  priority: "low" | "medium" | "high";
  deadline: Date | null;
  order: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    history: [
      {
        action: {
          type: String,
          enum: ["created", "updated", "status_changed", "reassigned"],
          required: true,
        },
        field: { type: String, default: "" },
        from: { type: String, default: "" },
        to: { type: String, default: "" },
        note: { type: String, default: "" },
        at: { type: Date, default: Date.now },
        actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
      },
    ],
    status: { type: String, enum: ["todo", "doing", "done"], default: "todo" },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    deadline: { type: Date, default: null },
    order: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

if (process.env.NODE_ENV !== "production" && mongoose.models.Task) {
  mongoose.deleteModel("Task");
}
export default (mongoose.models.Task as mongoose.Model<ITask>) || mongoose.model<ITask>("Task", TaskSchema);
