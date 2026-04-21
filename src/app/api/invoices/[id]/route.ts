import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Invoice from "@/models/Invoice";
import { sendWebPushToRoles } from "@/lib/webpush";
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

    const invoice = await Invoice.findOne(query)
      .populate("clientId", "name email phone whatsapp address gstNumber")
      .populate("projectId", "title")
      .lean();

    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    return NextResponse.json({ invoice });
  } catch (error) {
    console.error("GET invoice error:", error);
    return NextResponse.json({ error: "Failed to fetch invoice" }, { status: 500 });
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

    const existingInvoice = await Invoice.findOne(query).select("status workflowStatus invoiceNumber").lean();
    if (!existingInvoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    if (session.user.role === "sales" && body.status) {
      return NextResponse.json({ error: "Only admin can update payment status" }, { status: 403 });
    }

    const updatePayload: Record<string, unknown> = { ...body };

    if (body.workflowStatus) {
      const fromStatus = (existingInvoice.workflowStatus || "draft") as WorkflowStatus;
      const toStatus = body.workflowStatus as WorkflowStatus;

      if (session.user.role === "sales") {
        if (!(fromStatus === "draft" && toStatus === "review")) {
          return NextResponse.json(
            { error: "Sales can only move invoices from draft to review" },
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
        updatePayload.approvedById = session.user.id;
        updatePayload.approvedByName = session.user.name || "Unknown User";
        updatePayload.approvedAt = new Date();
      }

      if (toStatus === "rejected") {
        updatePayload.rejectedById = session.user.id;
        updatePayload.rejectedByName = session.user.name || "Unknown User";
        updatePayload.rejectedAt = new Date();
      }
    }

    const invoice = await Invoice.findOneAndUpdate(query, updatePayload, { new: true })
      .populate("clientId", "name email phone")
      .lean();

    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    if (body.status && body.status !== existingInvoice.status) {
      await sendWebPushToRoles(
        ["admin", "developer", "sales"],
        {
          title: "Payment Status Updated",
          body: `${session.user.name || "A user"} changed ${existingInvoice.invoiceNumber} from ${existingInvoice.status} to ${body.status}`,
          url: `/invoices/${invoice._id}`,
        },
        session.user.id
      );
    }

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error("PUT invoice error:", error);
    return NextResponse.json({ error: "Failed to update invoice" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await dbConnect();
    const { id } = await params;
    const existing = await Invoice.findById(id).select("workflowStatus").lean();
    if (!existing) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    if (!["draft", "review"].includes(existing.workflowStatus || "")) {
      return NextResponse.json({ error: "Sent invoices cannot be deleted" }, { status: 400 });
    }

    await Invoice.findByIdAndDelete(id);

    return NextResponse.json({ message: "Invoice deleted" });
  } catch (error) {
    console.error("DELETE invoice error:", error);
    return NextResponse.json({ error: "Failed to delete invoice" }, { status: 500 });
  }
}
