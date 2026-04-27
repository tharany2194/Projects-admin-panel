import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Quotation from "@/models/Quotation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import r2Client from "@/lib/r2";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["admin", "sales"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();
    const { id } = await params;
    const query: Record<string, unknown> = { _id: id };
    if (session.user.role === "sales") query.createdBy = session.user.id;

    const quotation = await Quotation.findOne(query).select("pdfFileUrl pdfFileName quotationNumber").lean();

    if (!quotation) {
      console.error(`[Download] Quotation not found: ${id}`);
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    if (!quotation.pdfFileUrl) {
      console.error(`[Download] No PDF URL for quotation: ${id}`);
      return NextResponse.json({ error: "No PDF attached to this quotation" }, { status: 400 });
    }

    const fileName = quotation.pdfFileName || `${quotation.quotationNumber}.pdf`;
    console.log(`[Download] Starting download for quotation ${id}, URL: ${quotation.pdfFileUrl}`);

    let buffer: ArrayBuffer;

    try {
      // Determine if URL is remote or local
      const isRemoteUrl = quotation.pdfFileUrl.startsWith("http://") || 
                          quotation.pdfFileUrl.startsWith("https://") ||
                          quotation.pdfFileUrl.includes("r2.cloudflarestorage.com") ||
                          quotation.pdfFileUrl.includes(".r2.");

      console.log(`[Download] Is remote URL: ${isRemoteUrl}, URL: ${quotation.pdfFileUrl}`);

      if (isRemoteUrl) {
        // Check if it's an R2 URL
        const isR2Url = quotation.pdfFileUrl.includes("r2.cloudflarestorage.com") || 
                        quotation.pdfFileUrl.includes(".r2.");

        if (isR2Url) {
          // Fetch from R2 using S3 client (with authentication)
          console.log(`[Download] Fetching from R2 using authenticated client`);
          
          try {
            // Extract the key from the URL
            // URL format: https://[endpoint]/[bucket]/[key]
            const urlParts = quotation.pdfFileUrl.split("/");
            const keyStartIndex = urlParts.findIndex(part => part.includes("r2.cloudflarestorage.com") || part.includes(".r2."));
            
            let objectKey = "";
            if (keyStartIndex !== -1 && keyStartIndex + 2 < urlParts.length) {
              // Skip endpoint and bucket, get the rest as key
              objectKey = urlParts.slice(keyStartIndex + 2).join("/");
            } else {
              throw new Error("Invalid R2 URL format");
            }

            console.log(`[Download] Extracted key from URL: ${objectKey}`);

            const result = await r2Client.send(
              new GetObjectCommand({
                Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
                Key: objectKey,
              })
            );

            if (!result.Body) {
              throw new Error("R2 returned empty body");
            }

            const chunks: Uint8Array[] = [];
            const reader = result.Body as any;
            
            if (reader[Symbol.asyncIterator]) {
              // Handle async iterable
              for await (const chunk of reader) {
                chunks.push(chunk);
              }
            } else if (typeof reader.read === 'function') {
              // Handle readable stream
              let chunk;
              while ((chunk = await reader.read()) !== null) {
                chunks.push(chunk);
              }
            } else {
              // Try as array buffer directly
              chunks.push(new Uint8Array(await reader.arrayBuffer?.() || reader));
            }

            // Concatenate all chunks
            const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
            const concatenated = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
              concatenated.set(chunk, offset);
              offset += chunk.length;
            }

            buffer = concatenated.buffer.slice(concatenated.byteOffset, concatenated.byteOffset + concatenated.byteLength);
            console.log(`[Download] Successfully fetched ${buffer.byteLength} bytes from R2`);
          } catch (r2Err) {
            console.error(`[Download] R2 fetch error:`, r2Err);
            throw new Error(`Failed to fetch from R2: ${r2Err instanceof Error ? r2Err.message : "Unknown error"}`);
          }
        } else {
          // Fetch from external URL
          console.log(`[Download] Fetching from external URL: ${quotation.pdfFileUrl}`);
          
          try {
            const pdfResponse = await fetch(quotation.pdfFileUrl, {
              method: "GET",
            });

            if (!pdfResponse.ok) {
              console.error(`[Download] Remote fetch failed: ${pdfResponse.status} ${pdfResponse.statusText}`);
              throw new Error(`Remote storage returned: ${pdfResponse.status} ${pdfResponse.statusText}`);
            }

            buffer = await pdfResponse.arrayBuffer();
            console.log(`[Download] Successfully fetched ${buffer.byteLength} bytes from external URL`);
          } catch (fetchErr) {
            console.error(`[Download] External fetch error:`, fetchErr);
            throw fetchErr;
          }
        }
      } else {
        // Local file - read from filesystem
        const filePath = path.join(process.cwd(), "public", quotation.pdfFileUrl);
        console.log(`[Download] Reading local file from: ${filePath}`);
        
        try {
          const fileBuffer = await readFile(filePath);
          buffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
          console.log(`[Download] Successfully read ${buffer.byteLength} bytes from local file`);
        } catch (readError) {
          console.error(`[Download] Local file read error:`, readError);
          throw new Error("PDF file not found or cannot be read");
        }
      }

      if (!buffer || buffer.byteLength === 0) {
        console.error(`[Download] Buffer is empty or invalid`);
        throw new Error("PDF file is empty");
      }

      console.log(`[Download] Returning PDF: ${fileName} (${buffer.byteLength} bytes)`);

      // Return PDF with proper headers for download
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Length": buffer.byteLength.toString(),
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}; filename="${fileName.replace(/[^\x20-\x7E]/g, '_')}"`,
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
          "X-Content-Type-Options": "nosniff",
          "Access-Control-Expose-Headers": "Content-Disposition",
        },
      });
    } catch (fetchError) {
      console.error(`[Download] Error in fetch/read block:`, fetchError);
      const message = fetchError instanceof Error ? fetchError.message : "Failed to retrieve PDF";
      return NextResponse.json(
        { error: `Failed to download PDF: ${message}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Download] Outer catch error:", error);
    const errorMsg = error instanceof Error ? error.message : "Failed to download PDF";
    return NextResponse.json(
      { error: `Server error: ${errorMsg}` },
      { status: 500 }
    );
  }
}
