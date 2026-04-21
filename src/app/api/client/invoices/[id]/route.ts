import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Invoice from "@/models/Invoice";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "client" || !session.user.clientId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();

    const { id } = await params;
    const invoice = await Invoice.findOne({ _id: id, clientId: session.user.clientId })
      .select("invoiceNumber invoiceDate dueDate items subtotal discount discountType gstEnabled gstRate cgst sgst total status workflowStatus notes projectId createdAt")
      .populate("projectId", "title")
      .lean();

    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    if (!["sent", "approved"].includes(invoice.workflowStatus || "")) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error("GET client invoice detail error:", error);
    return NextResponse.json({ error: "Failed to fetch invoice" }, { status: 500 });
  }
}
