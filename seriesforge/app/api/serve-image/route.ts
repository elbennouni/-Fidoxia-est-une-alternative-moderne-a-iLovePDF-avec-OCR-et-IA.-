/**
 * Temporary image proxy that uploads a local image to a free CDN (imgbb)
 * so it gets a real public URL usable by external APIs like Nano Banana Pro.
 */
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getCurrentUser } from "@/lib/auth";

// Upload to imgbb (free, no account needed for basic use)
// Or use fal.ai storage (already have the key)
async function uploadToFalStorage(buffer: Buffer, mimeType: string, falKey: string): Promise<string | null> {
  try {
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    const formData = new FormData();
    formData.append("file", blob, `ref-${Date.now()}.${mimeType.split("/")[1]}`);

    const res = await fetch("https://fal.run/fal-ai/storage/upload", {
      method: "POST",
      headers: { "Authorization": `Key ${falKey}` },
      body: formData,
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.url || null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { localPath } = await req.json();
    if (!localPath || !localPath.startsWith("/")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), "public", localPath);
    const buffer = await readFile(filePath);
    const ext = localPath.split(".").pop()?.toLowerCase() || "jpg";
    const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

    // Try fal.ai storage first (we have the key)
    const falKey = process.env.FAL_API_KEY;
    if (falKey) {
      const url = await uploadToFalStorage(buffer, mimeType, falKey);
      if (url) return NextResponse.json({ url });
    }

    // Fallback: return as base64 data URI
    const base64 = `data:${mimeType};base64,${buffer.toString("base64")}`;
    return NextResponse.json({ url: base64 });

  } catch (error) {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
