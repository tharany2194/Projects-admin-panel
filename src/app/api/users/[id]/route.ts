import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();
    const { id } = await params;
    const body = await req.json();

    const updateData: Record<string, unknown> = {};

    // Anyone can update their own name
    if (body.name && id === session.user.id) {
      updateData.name = body.name;
    }

    // Only admins can change roles or update other users
    if (body.role) {
      if (session.user.role !== "admin") {
        return NextResponse.json({ error: "Only admins can change roles" }, { status: 403 });
      }
      if (id === session.user.id) {
        return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
      }
      updateData.role = body.role;
    }

    // Admin can update anyone's name
    if (body.name && session.user.role === "admin") {
      updateData.name = body.name;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const user = await User.findByIdAndUpdate(id, updateData, { new: true }).select("-password").lean();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("PUT user error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Only admins can delete users
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Only admins can remove team members" }, { status: 403 });
    }

    await dbConnect();
    const { id } = await params;

    if (id === session.user.id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({ message: "User removed" });
  } catch (error) {
    console.error("DELETE user error:", error);
    return NextResponse.json({ error: "Failed to remove user" }, { status: 500 });
  }
}
