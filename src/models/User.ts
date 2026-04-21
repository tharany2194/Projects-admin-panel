import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: "admin" | "developer" | "sales";
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "developer", "sales"], default: "admin" },
    avatar: { type: String, default: "" },
  },
  { timestamps: true }
);

if (process.env.NODE_ENV !== "production" && mongoose.models.User) {
  mongoose.deleteModel("User");
}
export default (mongoose.models.User as mongoose.Model<IUser>) || mongoose.model<IUser>("User", UserSchema);
