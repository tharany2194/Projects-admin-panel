import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Client from "@/models/Client";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["admin", "sales"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const tag = searchParams.get("tag") || "";
    const type = searchParams.get("type") || "";

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }
    if (tag) filter.tags = tag;
    if (type) filter.type = type;

    if (session.user.role === "sales") {
      filter.assignedTo = session.user.id;
    }

    const clients = await Client.find(filter)
      .select("-password")
      .populate("assignedTo", "name email role")
      .sort({ createdAt: -1 })
      .lean();
    return NextResponse.json({ clients });
  } catch (error) {
    console.error("GET clients error:", error);
    return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await dbConnect();
    const body = await req.json();

    if (!body.name) {
      return NextResponse.json({ error: "Client name is required" }, { status: 400 });
    }

    const createData: Record<string, unknown> = {
      ...body,
      createdBy: session.user.id,
    };

    if (!Array.isArray(body.assignedTo)) {
      createData.assignedTo = [];
    }

    if (body.portalAccessEnabled) {
      if (typeof body.portalPassword !== "string" || body.portalPassword.trim().length < 6) {
        return NextResponse.json(
          { error: "Portal password must be at least 6 characters when portal access is enabled" },
          { status: 400 }
        );
      }
      createData.password = await bcrypt.hash(body.portalPassword.trim(), 12);
    }

    delete createData.portalPassword;

    const client = await Client.create(createData);

    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    console.error("POST client error:", error);
    return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
  }
}
