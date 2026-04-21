import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Quotation from "@/models/Quotation";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "client" || !session.user.clientId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();

    const { id } = await params;
    const quotation = await Quotation.findOne({ _id: id, clientId: session.user.clientId })
      .select("quotationNumber quotationDate validUntil items subtotal discount discountType gstEnabled gstRate cgst sgst total status workflowStatus notes terms createdAt")
      .lean();

    if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    if (!["sent", "approved", "rejected"].includes(quotation.workflowStatus || "")) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    return NextResponse.json({ quotation });
  } catch (error) {
    console.error("GET client quotation detail error:", error);
    return NextResponse.json({ error: "Failed to fetch quotation" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "client" || !session.user.clientId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();

    const body = await req.json();
    const status = body?.status;
    if (status !== "accepted" && status !== "rejected") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const { id } = await params;
    const existingQuotation = await Quotation.findOne({ _id: id, clientId: session.user.clientId })
      .select("status workflowStatus")
      .lean();

    if (!existingQuotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    if (existingQuotation.status !== "sent" || existingQuotation.workflowStatus !== "sent") {
      return NextResponse.json({ error: "Quotation can only be responded to after it is sent" }, { status: 400 });
    }

    const workflowStatus = status === "accepted" ? "approved" : "rejected";
    const quotation = await Quotation.findOneAndUpdate(
      { _id: id, clientId: session.user.clientId, status: "sent", workflowStatus: "sent" },
      {
        status,
        workflowStatus,
        ...(status === "accepted"
          ? {
              approvedById: session.user.id,
              approvedByName: session.user.name || "Client",
              approvedAt: new Date(),
            }
          : {
              rejectedById: session.user.id,
              rejectedByName: session.user.name || "Client",
              rejectedAt: new Date(),
            }),
        $push: {
          workflowHistory: {
            action: workflowStatus,
            actorId: session.user.id,
            actorName: session.user.name || "Client",
            actorRole: "client",
            note: `Client marked quotation as ${status}`,
            at: new Date(),
          },
        },
      },
      { new: true }
    )
      .select("quotationNumber quotationDate validUntil items subtotal discount discountType gstEnabled gstRate cgst sgst total status workflowStatus notes terms createdAt")
      .lean();

    if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });

    return NextResponse.json({ quotation });
  } catch (error) {
    console.error("PUT client quotation status error:", error);
    return NextResponse.json({ error: "Failed to update quotation" }, { status: 500 });
  }
}
