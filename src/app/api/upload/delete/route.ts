import { NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getServerSession } from "next-auth";
import { unlink } from "node:fs/promises";
import path from "node:path";
import r2Client from "@/lib/r2";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const hasR2Config =
  !!process.env.CLOUDFLARE_R2_ENDPOINT &&
  !!process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
  !!process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
  !!process.env.CLOUDFLARE_R2_BUCKET_NAME;

function sanitizeKey(rawKey: string) {
  return rawKey
    .replace(/\\/g, "/")
    .replace(/\.{2,}/g, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const rawKey = body?.key;

    if (!rawKey || typeof rawKey !== "string") {
      return NextResponse.json({ error: "File key is required" }, { status: 400 });
    }

    const key = sanitizeKey(rawKey);
    if (!key) {
      return NextResponse.json({ error: "Invalid file key" }, { status: 400 });
    }

    if (hasR2Config) {
      await r2Client.send(
        new DeleteObjectCommand({
          Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
          Key: key,
        })
      );
    } else {
      const localPath = path.join(process.cwd(), "public", key);
      try {
        await unlink(localPath);
      } catch {
        // Ignore missing file to keep delete idempotent.
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete file error:", error);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
