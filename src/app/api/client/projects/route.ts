import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Project from "@/models/Project";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "client" || !session.user.clientId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();

    const projects = await Project.find({ clientId: session.user.clientId })
      .select("_id title status clientStage clientProgressPercent deadline cost paymentStatus description notes files createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Client projects error:", error);
    return NextResponse.json({ error: "Failed to fetch client projects" }, { status: 500 });
  }
}
