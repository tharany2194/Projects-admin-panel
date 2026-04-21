import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Client from "@/models/Client";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; recurringId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await dbConnect();

    const body = await req.json();
    const action = body?.action as "pause" | "resume";
    if (action !== "pause" && action !== "resume") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const { id, recurringId } = await params;
    const client = await Client.findById(id);
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    const recurring = client.recurringPayments.find((item) => String(item._id) === recurringId);
    if (!recurring) return NextResponse.json({ error: "Recurring payment not found" }, { status: 404 });

    if (action === "pause") {
      recurring.paused = true;
      recurring.pausedAt = new Date();
      recurring.pauseReason = body?.reason || "Paused by admin";
    } else {
      recurring.paused = false;
      recurring.pausedAt = null;
      recurring.pauseReason = "";
    }

    await client.save();

    return NextResponse.json({ success: true, recurringPayment: recurring });
  } catch (error) {
    console.error("Recurring pause/resume error:", error);
    return NextResponse.json({ error: "Failed to update recurring payment" }, { status: 500 });
  }
}
