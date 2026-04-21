import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Quotation from "@/models/Quotation";

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
      workflowStatus: { $in: ["sent", "approved", "rejected"] },
    };
    if (status && ["sent", "accepted", "rejected"].includes(status)) {
      filter.status = status;
    }

    const quotations = await Quotation.find(filter)
      .select("quotationNumber quotationDate validUntil total status workflowStatus createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ quotations });
  } catch (error) {
    console.error("GET client quotations error:", error);
    return NextResponse.json({ error: "Failed to fetch quotations" }, { status: 500 });
  }
}
