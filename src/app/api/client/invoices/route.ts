import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Invoice from "@/models/Invoice";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "client" || !session.user.clientId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "";

    const filter: Record<string, unknown> = {
      clientId: session.user.clientId,
      workflowStatus: { $in: ["sent", "approved"] },
    };
    if (status) filter.status = status;

    const invoices = await Invoice.find(filter)
      .select("invoiceNumber invoiceDate dueDate total status items notes projectId createdAt")
      .populate("projectId", "title")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error("GET client invoices error:", error);
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 });
  }
}
