import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Quotation from "@/models/Quotation";
import Client from "@/models/Client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["admin", "sales"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "";
    const clientId = searchParams.get("clientId") || "";
    const workflowStatus = searchParams.get("workflowStatus") || "";

    const filter: Record<string, unknown> = {};
    if (session.user.role === "sales") {
      filter.createdBy = session.user.id;
    }
    if (status) filter.status = status;
    if (clientId) filter.clientId = clientId;
    if (workflowStatus) filter.workflowStatus = workflowStatus;

    const quotations = await Quotation.find(filter)
      .populate("clientId", "name email phone")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ quotations });
  } catch (error) {
    console.error("GET quotations error:", error);
    return NextResponse.json({ error: "Failed to fetch quotations" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["admin", "sales"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();
    const body = await req.json();

    if (!body.clientId) {
      return NextResponse.json({ error: "Client is required" }, { status: 400 });
    }

    if (session.user.role === "sales") {
      const allowedClient = await Client.findOne({ _id: body.clientId, assignedTo: session.user.id })
        .select("_id")
        .lean();
      if (!allowedClient) {
        return NextResponse.json({ error: "You are not assigned to this client" }, { status: 403 });
      }
    }

    // Auto-generate quotation number
    const lastQuotation = await Quotation.findOne().sort({ createdAt: -1 }).lean();
    let nextNum = 1;
    if (lastQuotation?.quotationNumber) {
      const match = lastQuotation.quotationNumber.match(/\d+$/);
      if (match) nextNum = parseInt(match[0]) + 1;
    }
    const quotationNumber = `QUO-${String(nextNum).padStart(4, "0")}`;

    const initialWorkflowStatus = body.workflowStatus || (session.user.role === "sales" ? "review" : "draft");

    const quotation = await Quotation.create({
      ...body,
      quotationNumber,
      workflowStatus: initialWorkflowStatus,
      workflowHistory: [
        {
          action: initialWorkflowStatus,
          actorId: session.user.id,
          actorName: session.user.name || "Unknown User",
          actorRole: session.user.role,
          note: body.workflowNote || "Initial workflow state",
          at: new Date(),
        },
      ],
      createdBy: session.user.id,
    });

    return NextResponse.json({ quotation }, { status: 201 });
  } catch (error) {
    console.error("POST quotation error:", error);
    return NextResponse.json({ error: "Failed to create quotation" }, { status: 500 });
  }
}
