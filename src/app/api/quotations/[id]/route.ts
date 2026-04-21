import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Quotation from "@/models/Quotation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const WORKFLOW_ORDER = ["draft", "review", "sent", "approved"] as const;
type WorkflowStatus = (typeof WORKFLOW_ORDER)[number] | "rejected";

function isValidWorkflowTransition(fromStatus: WorkflowStatus, toStatus: WorkflowStatus) {
  if (fromStatus === toStatus) return true;
  if (toStatus === "rejected") return true;
  if (fromStatus === "rejected") return false;

  const fromIndex = WORKFLOW_ORDER.indexOf(fromStatus as (typeof WORKFLOW_ORDER)[number]);
  const toIndex = WORKFLOW_ORDER.indexOf(toStatus as (typeof WORKFLOW_ORDER)[number]);

  if (fromIndex === -1 || toIndex === -1) return false;
  return toIndex === fromIndex + 1;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["admin", "sales"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();
    const { id } = await params;
    const query: Record<string, unknown> = { _id: id };
    if (session.user.role === "sales") query.createdBy = session.user.id;

    const quotation = await Quotation.findOne(query)
      .populate("clientId", "name email phone whatsapp address gstNumber")
      .lean();

    if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    return NextResponse.json({ quotation });
  } catch (error) {
    console.error("GET quotation error:", error);
    return NextResponse.json({ error: "Failed to fetch quotation" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["admin", "sales"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();
    const { id } = await params;
    const body = await req.json();

    const query: Record<string, unknown> = { _id: id };
    if (session.user.role === "sales") query.createdBy = session.user.id;

    const existingQuotation = await Quotation.findOne(query).select("workflowStatus").lean();
    if (!existingQuotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });

    const updatePayload: Record<string, unknown> = { ...body };

    if (body.workflowStatus) {
      const fromStatus = (existingQuotation.workflowStatus || "draft") as WorkflowStatus;
      const toStatus = body.workflowStatus as WorkflowStatus;

      if (session.user.role === "sales") {
        if (!(fromStatus === "draft" && toStatus === "review")) {
          return NextResponse.json(
            { error: "Sales can only move quotations from draft to review" },
            { status: 403 }
          );
        }
      }

      if (!["draft", "review", "sent", "approved", "rejected"].includes(toStatus)) {
        return NextResponse.json({ error: "Invalid workflow status" }, { status: 400 });
      }

      if (!isValidWorkflowTransition(fromStatus, toStatus)) {
        return NextResponse.json(
          { error: `Invalid transition from ${fromStatus} to ${toStatus}` },
          { status: 400 }
        );
      }

      updatePayload.$push = {
        workflowHistory: {
          action: toStatus,
          actorId: session.user.id,
          actorName: session.user.name || "Unknown User",
          actorRole: session.user.role,
          note: body.workflowNote || "",
          at: new Date(),
        },
      };

      if (toStatus === "approved") {
        updatePayload.status = "accepted";
        updatePayload.approvedById = session.user.id;
        updatePayload.approvedByName = session.user.name || "Unknown User";
        updatePayload.approvedAt = new Date();
      }

      if (toStatus === "rejected") {
        updatePayload.status = "rejected";
        updatePayload.rejectedById = session.user.id;
        updatePayload.rejectedByName = session.user.name || "Unknown User";
        updatePayload.rejectedAt = new Date();
      }

      if (toStatus === "sent") {
        updatePayload.status = "sent";
      }
    }

    const quotation = await Quotation.findOneAndUpdate(query, updatePayload, { new: true })
      .populate("clientId", "name email phone")
      .lean();

    if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    return NextResponse.json({ quotation });
  } catch (error) {
    console.error("PUT quotation error:", error);
    return NextResponse.json({ error: "Failed to update quotation" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await dbConnect();
    const { id } = await params;
    const existing = await Quotation.findById(id).select("status workflowStatus").lean();
    if (!existing) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });

    const hasBeenSent =
      existing.status === "sent" ||
      existing.status === "accepted" ||
      existing.status === "rejected" ||
      existing.workflowStatus === "sent" ||
      existing.workflowStatus === "approved" ||
      existing.workflowStatus === "rejected";

    if (hasBeenSent) {
      return NextResponse.json(
        { error: "Sent quotations cannot be deleted" },
        { status: 400 }
      );
    }

    await Quotation.findByIdAndDelete(id);

    return NextResponse.json({ message: "Quotation deleted" });
  } catch (error) {
    console.error("DELETE quotation error:", error);
    return NextResponse.json({ error: "Failed to delete quotation" }, { status: 500 });
  }
}
