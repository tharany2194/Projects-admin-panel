import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Task from "@/models/Task";
import User from "@/models/User";
import { sendWebPushToUsers } from "@/lib/webpush";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();
    const { id } = await params;
    const isAdmin = session.user.role === "admin";
    const query: Record<string, unknown> = { _id: id };
    if (!isAdmin) query.$or = [{ assignedTo: session.user.id }, { createdBy: session.user.id }];

    const taskDoc = await Task.findOne(query)
      .populate("projectId", "title")
      .populate("assignedTo", "name email")
      .populate("createdBy", "name role")
      .populate("history.actorId", "name role")
      .lean();

    if (!taskDoc) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    if (!isAdmin) {
      return NextResponse.json({
        task: {
          ...taskDoc,
          history: [],
        },
      });
    }

    return NextResponse.json({ task: taskDoc });
  } catch (error) {
    console.error("GET task error:", error);
    return NextResponse.json({ error: "Failed to fetch task" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();
    const { id } = await params;
    const body = await req.json();

    const isAdmin = session.user.role === "admin";

    const existing = await Task.findById(id);
    if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const isCreator = String(existing.createdBy) === String(session.user.id);
    const isAssignee = existing.assignedTo ? String(existing.assignedTo) === String(session.user.id) : false;

    const allowedKeys = isAdmin
      ? new Set(["status", "description", "deadline", "priority", "title", "projectId", "assignedTo", "order"])
      : new Set(["status", "description", "deadline", "priority", "title", "projectId", "assignedTo"]);

    const requestedAllowedKeys = Object.keys(body).filter((key) => allowedKeys.has(key));

    if (!isAdmin) {
      const isStatusOnlyUpdate = requestedAllowedKeys.length === 1 && requestedAllowedKeys[0] === "status";

      if (isCreator) {
        // Creator can edit allowed fields.
      } else if (isAssignee && isStatusOnlyUpdate) {
        // Assignee can only move stage (status).
      } else {
        return NextResponse.json(
          { error: "You can edit details only for tasks created by you. Assignees can move stage only." },
          { status: 403 }
        );
      }
    }

    const safeUpdate: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (allowedKeys.has(key)) {
        if (key === "projectId" && value === "") {
          safeUpdate[key] = null;
        } else if (key === "assignedTo" && value === "") {
          safeUpdate[key] = null;
        } else {
          safeUpdate[key] = value;
        }
      }
    }

    if (!isAdmin && Object.prototype.hasOwnProperty.call(safeUpdate, "assignedTo") && safeUpdate.assignedTo) {
      const target = await User.findById(safeUpdate.assignedTo as string).select("role").lean();
      if (!target || target.role === "admin") {
        return NextResponse.json({ error: "You can assign tasks only to staff users" }, { status: 403 });
      }
    }

    const toComparable = (value: unknown) => {
      if (value === null || value === undefined) return "";
      if (value instanceof Date) return value.toISOString();
      if (typeof value === "object" && value !== null && "toString" in value) return (value as { toString: () => string }).toString();
      return String(value);
    };

    const historyEntries: Array<{
      action: "created" | "updated" | "status_changed" | "reassigned";
      field: string;
      from: string;
      to: string;
      note: string;
      at: Date;
      actorId: string;
    }> = [];

    for (const [field, newValue] of Object.entries(safeUpdate)) {
      const oldValue = existing.get(field);
      const from = toComparable(oldValue);
      const to = toComparable(newValue);
      if (from === to) continue;

      const action = field === "status" ? "status_changed" : field === "assignedTo" ? "reassigned" : "updated";
      historyEntries.push({
        action,
        field,
        from,
        to,
        note: field === "status" ? `Moved from ${from || "none"} to ${to || "none"}` : `${field} updated`,
        at: new Date(),
        actorId: session.user.id,
      });
    }

    safeUpdate.history = [...(existing.history || []), ...historyEntries];

    const task = await Task.findByIdAndUpdate(id, safeUpdate, { new: true })
      .populate("projectId", "title")
      .populate("assignedTo", "name email")
      .populate("createdBy", "name role")
      .populate("history.actorId", "name role")
      .lean();

    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    if (historyEntries.length > 0) {
      const adminUsers = await User.find({ role: "admin" }).select("_id").lean();
      const recipientIds = new Set<string>();
      adminUsers.forEach((u) => recipientIds.add(String(u._id)));

      const createdById =
        typeof task.createdBy === "object" && task.createdBy && "_id" in task.createdBy
          ? String((task.createdBy as { _id: unknown })._id)
          : String(task.createdBy || "");

      const assignedToId =
        typeof task.assignedTo === "object" && task.assignedTo && "_id" in task.assignedTo
          ? String((task.assignedTo as { _id: unknown })._id)
          : String(task.assignedTo || "");

      if (createdById) recipientIds.add(createdById);
      if (assignedToId) recipientIds.add(assignedToId);

      const statusEntry = historyEntries.find((h) => h.field === "status");

      await sendWebPushToUsers(
        [...recipientIds].filter(Boolean),
        {
          title: statusEntry ? "Task Stage Updated" : "Task Updated",
          body: statusEntry
            ? `${session.user.name || "A user"} moved \"${task.title}\" from ${statusEntry.from || "none"} to ${statusEntry.to || "none"}`
            : `${session.user.name || "A user"} updated \"${task.title}\"`,
          url: "/tasks",
        }
      );
    }

    if (!isAdmin) {
      return NextResponse.json({
        task: {
          ...task,
          history: [],
        },
      });
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error("PUT task error:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Only admins can delete tasks" }, { status: 403 });
    }

    await dbConnect();
    const { id } = await params;
    const task = await Task.findByIdAndDelete(id);
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    return NextResponse.json({ message: "Task deleted" });
  } catch (error) {
    console.error("DELETE task error:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
