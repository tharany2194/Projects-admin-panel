import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Client from "@/models/Client";
import Project from "@/models/Project";
import Invoice from "@/models/Invoice";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "client" || !session.user.clientId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();

    const clientId = session.user.clientId;
    const projects = await Project.find({ clientId })
      .select("_id title status deadline paymentStatus updatedAt")
      .sort({ updatedAt: -1 })
      .lean();

    const projectIds = projects.map((p) => p._id);

    const [client, invoices] = await Promise.all([
      Client.findById(clientId)
        .select("_id name email phone whatsapp address type gstNumber")
        .lean(),
      Invoice.find({ clientId })
        .select("_id invoiceNumber total status dueDate invoiceDate")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const stats = {
      totalProjects: projects.length,
      activeProjects: projects.filter((p) => ["new", "in_progress", "on_hold"].includes(p.status)).length,
      totalInvoices: invoices.length,
      pendingInvoices: invoices.filter((i) => i.status !== "paid").length,
    };

    return NextResponse.json({ client, stats, projects, invoices });
  } catch (error) {
    console.error("Client dashboard error:", error);
    return NextResponse.json({ error: "Failed to load client dashboard" }, { status: 500 });
  }
}
