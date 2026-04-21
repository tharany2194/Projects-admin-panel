import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import r2Client from "@/lib/r2";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { v4 as uuidv4 } from "uuid";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const hasR2Config =
  !!process.env.CLOUDFLARE_R2_ENDPOINT &&
  !!process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
  !!process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
  !!process.env.CLOUDFLARE_R2_BUCKET_NAME;

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "uploads";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "bin";
    const safeFolder = folder
      .replace(/\\/g, "/")
      .replace(/\.\./g, "")
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");
    const key = `${safeFolder}/${uuidv4()}.${ext}`;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let fileUrl = "";

    if (hasR2Config) {
      await r2Client.send(
        new PutObjectCommand({
          Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: file.type,
        })
      );

      const publicBase = (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, "");
      let publicPath = key;
      if (publicBase.endsWith("/projects") && key.startsWith("projects/")) {
        publicPath = key.replace(/^projects\//, "");
      }
      fileUrl = publicBase ? `${publicBase}/${publicPath}` : key;
    } else {
      const localDir = path.join(process.cwd(), "public", safeFolder);
      await mkdir(localDir, { recursive: true });
      const filename = `${uuidv4()}.${ext}`;
      const localPath = path.join(localDir, filename);
      await writeFile(localPath, buffer);
      fileUrl = `/${safeFolder}/${filename}`;
    }

    return NextResponse.json({
      file: {
        key,
        name: file.name,
        size: file.size,
        type: file.type,
        url: fileUrl,
        uploadedAt: new Date().toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error("File upload error:", error);
    return NextResponse.json({
      error: "Failed to upload file",
      details: error instanceof Error ? error.message : "Unknown upload error",
    }, { status: 500 });
  }
}
