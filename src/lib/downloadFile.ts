/**
 * Utility function to trigger file downloads directly to the user's system storage
 * Handles both R2 URLs and local file paths
 * 
 * @param pdfFileUrl - The URL of the file (can be R2 URL or local path)
 * @param filename - The name to save the file as (including extension)
 */
export async function downloadFile(pdfFileUrl: string, filename: string): Promise<void> {
  try {
    // If it's a local path (starts with /), download directly
    if (pdfFileUrl.startsWith("/")) {
      const response = await fetch(pdfFileUrl);
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }
      const blob = await response.blob();
      triggerBlobDownload(blob, filename);
      return;
    }

    // For R2 URLs, we need to extract the key and use the API
    // R2 URLs are like: https://r2url.com/quotations/uuid.pdf
    // We need to extract: quotations/uuid.pdf
    let fileKey = "";
    
    try {
      const url = new URL(pdfFileUrl);
      // Get pathname and remove leading slash
      fileKey = url.pathname.replace(/^\/+/, "");
    } catch {
      // If URL parsing fails, try to extract from string
      // Handle both full URLs and partial paths
      const match = pdfFileUrl.match(/\/([^/]+\/[^/]+\.[a-zA-Z0-9]+)$/);
      if (match) {
        fileKey = match[1];
      } else {
        // Last resort: use the last two path segments
        const parts = pdfFileUrl.split("/").filter(Boolean);
        if (parts.length >= 2) {
          fileKey = `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
        } else {
          throw new Error("Could not parse file URL");
        }
      }
    }

    if (!fileKey) {
      throw new Error("Invalid file URL format");
    }

    // Use the download API with the extracted key
    const params = new URLSearchParams({
      key: fileKey,
      name: filename,
    });

    const response = await fetch(`/api/upload/download?${params.toString()}`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Download failed: ${response.statusText}`);
    }

    const blob = await response.blob();
    triggerBlobDownload(blob, filename);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Download failed";
    console.error("File download error:", message);
    throw error;
  }
}

/**
 * Helper function to trigger blob download
 */
function triggerBlobDownload(blob: Blob, filename: string): void {
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
}
