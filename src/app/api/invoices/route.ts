import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Invoice from "@/models/Invoice";
import Client from "@/models/Client";
import { sendWebPushToRoles } from "@/lib/webpush";
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

    const invoices = await Invoice.find(filter)
      .populate("clientId", "name email phone")
      .populate("projectId", "title")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error("GET invoices error:", error);
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 });
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

    if (!body.clientId || !body.items || body.items.length === 0) {
      return NextResponse.json({ error: "Client and at least one item are required" }, { status: 400 });
    }

    if (session.user.role === "sales") {
      const allowedClient = await Client.findOne({ _id: body.clientId, assignedTo: session.user.id })
        .select("_id")
        .lean();
      if (!allowedClient) {
        return NextResponse.json({ error: "You are not assigned to this client" }, { status: 403 });
      }
    }

    // Auto-generate invoice number
    const count = await Invoice.countDocuments();
    const invoiceNumber = body.invoiceNumber || `INV-${String(count + 1).padStart(4, "0")}`;

    const initialWorkflowStatus = body.workflowStatus || (session.user.role === "sales" ? "review" : "draft");

    const invoice = await Invoice.create({
      ...body,
      invoiceNumber,
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

    await sendWebPushToRoles(
      ["admin", "developer", "sales"],
      {
        title: "Invoice Created",
        body: `${session.user.name || "A user"} created invoice ${invoice.invoiceNumber}`,
        url: `/invoices/${invoice._id}`,
      },
      session.user.id
    );

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    console.error("POST invoice error:", error);
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 });
  }
}
