import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();

    const isAdmin = session.user.role === "admin";
    const users = isAdmin
      ? await User.find().select("-password").sort({ createdAt: -1 }).lean()
      : await User.find({ role: { $ne: "admin" } })
          .select("name role")
          .sort({ createdAt: -1 })
          .lean();

    return NextResponse.json({ users });
  } catch (error) {
    console.error("GET users error:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
