import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Project from "@/models/Project";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "";
    const clientId = searchParams.get("clientId") || "";
    const paymentStatus = searchParams.get("paymentStatus") || "";

    const isAdmin = session.user.role === "admin";
    const isSales = session.user.role === "sales";

    const filter: Record<string, unknown> = {};
    if (!isAdmin) {
      filter.assignedTo = session.user.id;
    }
    if (status) filter.status = status;
    if (clientId && isAdmin) filter.clientId = clientId;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    const projectDocs = await Project.find(filter)
      .populate("clientId", isAdmin || isSales ? "name email phone whatsapp" : "name")
      .populate("assignedTo", "name email role")
      .sort({ createdAt: -1 })
      .lean();

    const projects = isAdmin || isSales
      ? projectDocs
      : projectDocs.map((project) => ({
          ...project,
          clientId: null,
          cost: 0,
          paymentStatus: "restricted",
          advanceAmount: 0,
        }));

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("GET projects error:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Only admins can create projects" }, { status: 403 });
    }

    await dbConnect();
    const body = await req.json();

    if (!body.title || !body.clientId) {
      return NextResponse.json({ error: "Title and client are required" }, { status: 400 });
    }

    const project = await Project.create({
      ...body,
      createdBy: session.user.id,
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("POST project error:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
