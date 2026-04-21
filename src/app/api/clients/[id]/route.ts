import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Client from "@/models/Client";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["admin", "sales"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();
    const { id } = await params;

    if (session.user.role === "sales") {
      const assignment = await Client.findOne({ _id: id, assignedTo: session.user.id }).select("_id").lean();
      if (!assignment) return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const client = await Client.findById(id)
      .select("-password")
      .populate("assignedTo", "name email role")
      .lean();
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    return NextResponse.json({ client });
  } catch (error) {
    console.error("GET client error:", error);
    return NextResponse.json({ error: "Failed to fetch client" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await dbConnect();
    const { id } = await params;
    const body = await req.json();
    const existing = await Client.findById(id).select("password portalAccessEnabled").lean();
    if (!existing) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    const updateData = { ...body };
    if (typeof body.portalPassword === "string" && body.portalPassword.trim().length >= 6) {
      updateData.password = await bcrypt.hash(body.portalPassword.trim(), 12);
      updateData.portalAccessEnabled = true;
      delete updateData.portalPassword;
    }

    if (
      body.portalAccessEnabled === true &&
      !existing.password &&
      !(typeof body.portalPassword === "string" && body.portalPassword.trim().length >= 6)
    ) {
      return NextResponse.json(
        { error: "Provide a portal password (minimum 6 characters) to enable client portal access" },
        { status: 400 }
      );
    }

    if (body.portalAccessEnabled === false) {
      updateData.portalAccessEnabled = false;
      updateData.password = "";
    }

    const client = await Client.findByIdAndUpdate(id, updateData, { new: true })
      .select("-password")
      .lean();
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    return NextResponse.json({ client });
  } catch (error) {
    console.error("PUT client error:", error);
    return NextResponse.json({ error: "Failed to update client" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await dbConnect();
    const { id } = await params;
    const client = await Client.findByIdAndDelete(id);
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    return NextResponse.json({ message: "Client deleted" });
  } catch (error) {
    console.error("DELETE client error:", error);
    return NextResponse.json({ error: "Failed to delete client" }, { status: 500 });
  }
}
