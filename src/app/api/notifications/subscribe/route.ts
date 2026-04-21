import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import PushSubscription from "@/models/PushSubscription";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const subscription = body?.subscription;

    if (
      !subscription?.endpoint ||
      !subscription?.keys?.p256dh ||
      !subscription?.keys?.auth
    ) {
      return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
    }

    await dbConnect();

    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        userId: session.user.id,
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
        userAgent: req.headers.get("user-agent") || "",
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Subscribe push error:", error);
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const endpoint = body?.endpoint;

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint is required" }, { status: 400 });
    }

    await dbConnect();

    await PushSubscription.deleteOne({ endpoint, userId: session.user.id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unsubscribe push error:", error);
    return NextResponse.json({ error: "Failed to remove subscription" }, { status: 500 });
  }
}
