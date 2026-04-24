import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";

// Upload background music file
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const episode = await prisma.episode.findFirst({
      where: { id, series: { userId: user.id } },
    });
    if (!episode) return NextResponse.json({ error: "Episode not found" }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const volumeStr = formData.get("volume") as string;
    const volume = volumeStr ? parseFloat(volumeStr) : 0.2;

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
    if (!["mp3", "wav", "ogg", "m4a", "aac"].includes(ext)) {
      return NextResponse.json({ error: "Format audio non supporté (mp3, wav, ogg, m4a)" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = `bg-music-${uuidv4()}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "music");

    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, fileName), buffer);

    const bgMusicUrl = `/uploads/music/${fileName}`;

    await prisma.episode.update({
      where: { id },
      data: {
        bgMusicUrl,
        bgMusicName: file.name,
        bgMusicVolume: Math.max(0, Math.min(1, volume)),
      },
    });

    return NextResponse.json({ bgMusicUrl, bgMusicName: file.name, bgMusicVolume: volume });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

// Update volume or remove music
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { volume, remove } = await req.json();

    const episode = await prisma.episode.findFirst({
      where: { id, series: { userId: user.id } },
    });
    if (!episode) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (remove) {
      await prisma.episode.update({
        where: { id },
        data: { bgMusicUrl: null, bgMusicName: null, bgMusicVolume: 0.2 },
      });
      return NextResponse.json({ success: true, removed: true });
    }

    if (volume !== undefined) {
      const vol = Math.max(0, Math.min(1, parseFloat(volume)));
      await prisma.episode.update({
        where: { id },
        data: { bgMusicVolume: vol },
      });
      return NextResponse.json({ success: true, bgMusicVolume: vol });
    }

    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
