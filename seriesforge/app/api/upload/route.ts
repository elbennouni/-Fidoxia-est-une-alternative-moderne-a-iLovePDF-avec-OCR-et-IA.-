import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { persistUserUpload } from "@/lib/storage/publicUploads";
import { ensureDurableImageUrl } from "@/lib/storage/durableImages";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const folder = (formData.get("folder") as string) || "uploads";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const persisted = await persistUserUpload({
      buffer: Buffer.from(bytes),
      folder,
      originalFileName: file.name,
    });

    const durableUrl = await ensureDurableImageUrl(persisted.url, {
      folder,
      fileNamePrefix: persisted.fileName.replace(/\.[^.]+$/, ""),
      forceRehostRemote: persisted.storage !== "fal",
    });

    return NextResponse.json({
      url: durableUrl,
      fileName: persisted.fileName,
      storage: persisted.storage,
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
