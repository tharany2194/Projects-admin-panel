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

    // Validate file is not empty
    const bytes = await file.arrayBuffer();
    if (bytes.byteLength === 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }

    const buffer = Buffer.from(bytes);
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    
    // Normalize content type for PDFs
    let contentType = file.type;
    if (ext === "pdf") {
      contentType = "application/pdf";
    }

    const safeFolder = folder
      .replace(/\\/g, "/")
      .replace(/\.\./g, "")
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");
    const key = `${safeFolder}/${uuidv4()}.${ext}`;

    let fileUrl = "";

    if (hasR2Config) {
      try {
        await r2Client.send(
          new PutObjectCommand({
            Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: contentType,
          })
        );

        // Construct R2 public URL
        const r2Endpoint = process.env.CLOUDFLARE_R2_ENDPOINT || "";
        const r2Bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME || "";
        
        // If R2_PUBLIC_URL is set, use it; otherwise construct from endpoint
        if (process.env.R2_PUBLIC_URL) {
          const publicBase = process.env.R2_PUBLIC_URL.replace(/\/+$/, "");
          fileUrl = `${publicBase}/${key}`;
        } else {
          // Use R2 endpoint with bucket name to construct the URL
          const cleanEndpoint = r2Endpoint.replace(/\/+$/, "");
          fileUrl = `${cleanEndpoint}/${r2Bucket}/${key}`;
        }
      } catch (r2Error) {
        console.error("R2 upload error:", r2Error);
        throw new Error("Failed to upload to cloud storage");
      }
    } else {
      // Local file storage fallback
      try {
        const localDir = path.join(process.cwd(), "public", safeFolder);
        await mkdir(localDir, { recursive: true });
        const filename = `${uuidv4()}.${ext}`;
        const localPath = path.join(localDir, filename);
        await writeFile(localPath, buffer);
        fileUrl = `/${safeFolder}/${filename}`;
      } catch (localError) {
        console.error("Local file storage error:", localError);
        throw new Error("Failed to save file locally");
      }
    }

    return NextResponse.json({
      file: {
        key,
        name: file.name,
        size: buffer.byteLength,
        type: contentType,
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
