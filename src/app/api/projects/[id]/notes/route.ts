import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Project from "@/models/Project";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role === "client") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { text } = await req.json();
    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Note text is required" }, { status: 400 });
    }

    await dbConnect();
    const { id } = await params;

    const filter: Record<string, unknown> = { _id: id };
    if (session.user.role !== "admin") {
      filter.$or = [{ assignedTo: session.user.id }, { createdBy: session.user.id }];
    }

    const project = await Project.findOneAndUpdate(
      filter,
      {
        $push: {
          notes: {
            text: text.trim(),
            authorId: session.user.id,
            authorName: session.user.name || "Unknown",
            authorRole: session.user.role,
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    )
      .select("notes")
      .lean();

    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    return NextResponse.json({ notes: project.notes || [] });
  } catch (error) {
    console.error("Project note create error:", error);
    return NextResponse.json({ error: "Failed to add note" }, { status: 500 });
  }
}
