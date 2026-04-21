import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Project from "@/models/Project";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();
    const { id } = await params;
    const isAdmin = session.user.role === "admin";
    const isSales = session.user.role === "sales";
    const query: Record<string, unknown> = { _id: id };
    if (!isAdmin) query.$or = [{ assignedTo: session.user.id }, { createdBy: session.user.id }];

    const projectDoc = await Project.findOne(query)
      .populate("clientId", isAdmin || isSales ? "name email phone whatsapp" : "name")
      .populate("assignedTo", "name email role")
      .lean();

    if (!projectDoc) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    if (!isAdmin && !isSales) {
      const project = {
        ...projectDoc,
        clientId: null,
        cost: 0,
        paymentStatus: "restricted",
        advanceAmount: 0,
      };
      return NextResponse.json({ project });
    }

    return NextResponse.json({ project: projectDoc });
  } catch (error) {
    console.error("GET project error:", error);
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
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

    if (!isAdmin) {
      const allowedKeys = new Set(["status", "tasks", "files", "description", "title", "deadline"]);
      const safeUpdate: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(body)) {
        if (allowedKeys.has(key)) safeUpdate[key] = value;
      }

      const project = await Project.findOneAndUpdate(
        { _id: id, $or: [{ assignedTo: session.user.id }, { createdBy: session.user.id }] },
        safeUpdate,
        { new: true }
      )
        .populate("clientId", "name")
        .populate("assignedTo", "name email role")
        .lean();

      if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
      return NextResponse.json({
        project: {
          ...project,
          clientId: null,
          cost: 0,
          paymentStatus: "restricted",
          advanceAmount: 0,
        },
      });
    }

    const project = await Project.findByIdAndUpdate(id, body, { new: true })
      .populate("clientId", "name email phone")
      .lean();

    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({ project });
  } catch (error) {
    console.error("PUT project error:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Only admins can delete projects" }, { status: 403 });
    }

    await dbConnect();
    const { id } = await params;
    const project = await Project.findByIdAndDelete(id);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    return NextResponse.json({ message: "Project deleted" });
  } catch (error) {
    console.error("DELETE project error:", error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
