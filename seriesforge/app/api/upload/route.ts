import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { getCurrentUser } from "@/lib/auth";

// Upload to fal.ai CDN for permanent storage (works on Vercel)
async function uploadToFalStorage(buffer: Buffer, fileName: string, mimeType: string): Promise<string | null> {
  const falKey = process.env.FAL_API_KEY;
  if (!falKey) return null;

  try {
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    const formData = new FormData();
    formData.append("file", blob, fileName);

    const res = await fetch("https://fal.run/fal-ai/storage/upload", {
      method: "POST",
      headers: { "Authorization": `Key ${falKey}` },
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      return data.url || null;
    }
    return null;
  } catch {
    return null;
  }
}

// Save locally as fallback (for local dev)
async function saveLocally(buffer: Buffer, folder: string, ext: string): Promise<string> {
  const fileName = `${uuidv4()}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, fileName), buffer);
  return `/uploads/${folder}/${fileName}`;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const folder = (formData.get("folder") as string) || "uploads";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "mp3" ? "audio/mpeg" : ext === "wav" ? "audio/wav" : "image/jpeg";
    const fileName = `${folder}-${uuidv4().slice(0, 8)}.${ext}`;

    // Try Fal.ai storage first (permanent, works on Vercel)
    const falUrl = await uploadToFalStorage(buffer, fileName, mimeType);
    if (falUrl) {
      return NextResponse.json({ url: falUrl, fileName, storage: "fal" });
    }

    // Fallback: local storage (only works in local dev)
    const localUrl = await saveLocally(buffer, folder, ext);
    return NextResponse.json({ url: localUrl, fileName, storage: "local" });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
