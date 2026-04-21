import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getServerSession } from "next-auth";
import { readFile } from "node:fs/promises";
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

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const rawKey = searchParams.get("key") || "";
    const fileName = searchParams.get("name") || "download";

    if (!rawKey) {
      return NextResponse.json({ error: "File key is required" }, { status: 400 });
    }

    const key = sanitizeKey(rawKey);
    if (!key) {
      return NextResponse.json({ error: "Invalid file key" }, { status: 400 });
    }

    let data: Uint8Array;
    let contentType = "application/octet-stream";

    if (hasR2Config) {
      const object = await r2Client.send(
        new GetObjectCommand({
          Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
          Key: key,
        })
      );

      if (!object.Body) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }

      contentType = object.ContentType || contentType;
      data = await object.Body.transformToByteArray();
    } else {
      const localPath = path.join(process.cwd(), "public", key);
      const buffer = await readFile(localPath);
      data = new Uint8Array(buffer);
    }

    const body = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("NoSuchKey") || message.includes("not found")) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    console.error("Download file error:", error);
    return NextResponse.json({ error: "Failed to download file" }, { status: 500 });
  }
}
