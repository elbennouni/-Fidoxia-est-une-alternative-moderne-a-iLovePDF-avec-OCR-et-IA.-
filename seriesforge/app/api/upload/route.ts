import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { persistUserUpload } from "@/lib/storage/publicUploads";

function getMimeTypeFromFile(file: File): string {
  if (file.type && file.type.startsWith("image/")) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
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

    let persisted: Awaited<ReturnType<typeof persistUserUpload>>;
    try {
      persisted = await persistUserUpload({
        buffer,
        folder,
        originalFileName: file.name,
      });
    } catch {
      const mimeType = getMimeTypeFromFile(file);
      const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
      return NextResponse.json({
        url: dataUrl,
        fileName: file.name,
        storage: "inline",
      });
    }

    if (!persisted.url) {
      const mimeType = getMimeTypeFromFile(file);
      const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
      return NextResponse.json({
        url: dataUrl,
        fileName: file.name,
        storage: "inline",
      });
    }

    return NextResponse.json({
      url: persisted.url,
      fileName: persisted.fileName,
      storage: persisted.storage,
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
