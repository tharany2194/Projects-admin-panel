import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Project from "@/models/Project";

type SessionRole = "admin" | "developer" | "sales" | "client";

function buildProjectAccessFilter(sessionUser: { id: string; role: string; clientId?: string }, id: string) {
  if (sessionUser.role === "admin") {
    return { _id: id };
  }

  if (sessionUser.role === "client") {
    return { _id: id, clientId: sessionUser.clientId };
  }

  return { _id: id, $or: [{ assignedTo: sessionUser.id }, { createdBy: sessionUser.id }] };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = session.user.role as SessionRole;
    if (!["admin", "developer", "sales", "client"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();

    const body = await req.json();
    const file = body?.file;
    if (!file || typeof file !== "object") {
      return NextResponse.json({ error: "File payload is required" }, { status: 400 });
    }

    const { id } = await params;
    const actorId = session.user.id;
    const actorName = session.user.name || "Unknown User";

    const project = await Project.findOneAndUpdate(
      buildProjectAccessFilter(session.user, id),
      {
        $push: {
          files: {
            key: file.key,
            name: file.name,
            size: file.size,
            type: file.type,
            url: file.url,
            uploadedAt: file.uploadedAt || new Date().toISOString(),
            uploadedById: actorId,
            uploadedByName: actorName,
            uploadedByRole: role,
          },
          fileHistory: {
            action: "uploaded",
            fileKey: file.key,
            fileName: file.name,
            actorId,
            actorName,
            actorRole: role,
            actedAt: new Date(),
          },
        },
      },
      { new: true }
    )
      .populate("clientId", "name email phone whatsapp")
      .populate("assignedTo", "name email role")
      .lean();

    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    return NextResponse.json({ project });
  } catch (error) {
    console.error("POST project file error:", error);
    return NextResponse.json({ error: "Failed to attach file to project" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = session.user.role as SessionRole;
    if (!["admin", "developer", "sales", "client"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();

    const body = await req.json();
    const fileKey = body?.key;
    if (!fileKey || typeof fileKey !== "string") {
      return NextResponse.json({ error: "File key is required" }, { status: 400 });
    }

    const { id } = await params;
    const filter = buildProjectAccessFilter(session.user, id);

    const existing = await Project.findOne(filter).select("files").lean();
    if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const fileToDelete = (existing.files || []).find((f: { key: string; name: string }) => f.key === fileKey);
    if (!fileToDelete) {
      return NextResponse.json({ error: "File not found in project" }, { status: 404 });
    }

    const actorId = session.user.id;
    const actorName = session.user.name || "Unknown User";

    const project = await Project.findOneAndUpdate(
      filter,
      {
        $pull: { files: { key: fileKey } },
        $push: {
          fileHistory: {
            action: "deleted",
            fileKey,
            fileName: fileToDelete.name,
            actorId,
            actorName,
            actorRole: role,
            actedAt: new Date(),
          },
        },
      },
      { new: true }
    )
      .populate("clientId", "name email phone whatsapp")
      .populate("assignedTo", "name email role")
      .lean();

    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    return NextResponse.json({ project });
  } catch (error) {
    console.error("DELETE project file error:", error);
    return NextResponse.json({ error: "Failed to remove file from project" }, { status: 500 });
  }
}
