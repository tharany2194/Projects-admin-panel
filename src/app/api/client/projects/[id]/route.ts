import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Project from "@/models/Project";
import Client from "@/models/Client";
import Invoice from "@/models/Invoice";
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

    const project = await Project.findOne({ _id: id, clientId: session.user.clientId })
      .select("_id title status clientStage clientProgressPercent deadline cost paymentStatus description notes files createdAt updatedAt")
      .lean();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const [client, invoices, quotations] = await Promise.all([
      Client.findById(session.user.clientId)
        .select("recurringPayments paymentHistory")
        .lean(),
      Invoice.find({ clientId: session.user.clientId, projectId: id })
        .select("_id invoiceNumber total status dueDate invoiceDate")
        .sort({ dueDate: 1, invoiceDate: 1, createdAt: 1 })
        .lean(),
      Quotation.find({ clientId: session.user.clientId })
        .select("_id quotationNumber total status quotationDate")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    return NextResponse.json({
      project,
      payment: {
        invoices,
        quotations,
        recurringPayments: client?.recurringPayments || [],
        paymentHistory: client?.paymentHistory || [],
      },
    });
  } catch (error) {
    console.error("Client project detail error:", error);
    return NextResponse.json({ error: "Failed to fetch project detail" }, { status: 500 });
  }
}
