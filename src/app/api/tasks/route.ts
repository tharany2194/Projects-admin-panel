import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Task from "@/models/Task";
import User from "@/models/User";
import { sendWebPushToUsers } from "@/lib/webpush";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "";
    const projectId = searchParams.get("projectId") || "";
    const assignedTo = searchParams.get("assignedTo") || "";

    const isAdmin = session.user.role === "admin";

    const filter: Record<string, unknown> = {};
    if (!isAdmin) filter.$or = [{ assignedTo: session.user.id }, { createdBy: session.user.id }];
    if (status) filter.status = status;
    if (projectId) filter.projectId = projectId;
    if (assignedTo && isAdmin) filter.assignedTo = assignedTo;

    const taskDocs = await Task.find(filter)
      .populate("projectId", "title")
      .populate("assignedTo", "name email")
      .populate("createdBy", "name role")
      .populate("history.actorId", "name role")
      .sort({ order: 1, createdAt: -1 })
      .lean();

    const tasks = isAdmin
      ? taskDocs
      : taskDocs.map((task) => ({
          ...task,
          history: [],
        }));

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("GET tasks error:", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();
    const body = await req.json();
    const isAdmin = session.user.role === "admin";

    if (!body.title) {
      return NextResponse.json({ error: "Task title is required" }, { status: 400 });
    }

    // Clean empty strings to null for ObjectId fields
    const taskData: Record<string, unknown> = {
      title: body.title,
      description: body.description || "",
      status: body.status || "todo",
      priority: body.priority || "medium",
      order: body.order || 0,
      createdBy: session.user.id,
    };
    if (body.projectId && body.projectId !== "") taskData.projectId = body.projectId;
    if (body.assignedTo && body.assignedTo !== "") {
      if (!isAdmin) {
        const target = await User.findById(body.assignedTo).select("role").lean();
        if (!target || target.role === "admin") {
          return NextResponse.json({ error: "You can assign tasks only to staff users" }, { status: 403 });
        }
      }
      taskData.assignedTo = body.assignedTo;
    }
    if (body.deadline && body.deadline !== "") taskData.deadline = body.deadline;

    taskData.history = [
      {
        action: "created",
        field: "task",
        from: "",
        to: body.status || "todo",
        note: "Task created",
        at: new Date(),
        actorId: session.user.id,
      },
    ];

    const task = await Task.create(taskData);

    const adminUsers = await User.find({ role: "admin" }).select("_id").lean();
    const recipientIds = new Set<string>();

    adminUsers.forEach((u) => recipientIds.add(String(u._id)));
    if (task.assignedTo) recipientIds.add(String(task.assignedTo));
    recipientIds.add(String(task.createdBy));

    await sendWebPushToUsers(
      [...recipientIds].filter(Boolean),
      {
        title: "Task Created",
        body: `${session.user.name || "A user"} created task \"${task.title}\"`,
        url: "/tasks",
      }
    );

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error("POST task error:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
