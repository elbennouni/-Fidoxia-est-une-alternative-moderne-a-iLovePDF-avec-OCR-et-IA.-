import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const episode = await prisma.episode.findFirst({
      where: { id, series: { userId: user.id } },
      include: {
        series: { include: { characters: true, environments: true } },
        scenes: { orderBy: { sceneNumber: "asc" } },
      },
    });

    if (!episode) return NextResponse.json({ error: "Episode not found" }, { status: 404 });

    const exportData = {
      exportedAt: new Date().toISOString(),
      series: {
        title: episode.series.title,
        visualStyle: episode.series.visualStyle,
        tone: episode.series.tone,
        format: episode.format,
      },
      episode: {
        id: episode.id,
        title: episode.title,
        synopsis: episode.script,
        status: episode.status,
      },
      characters: episode.series.characters.map(c => ({
        name: c.name,
        physicalDescription: c.physicalDescription,
        outfit: c.outfit,
        personality: c.personality,
        consistencyPrompt: c.consistencyPrompt,
      })),
      environments: episode.series.environments.map(e => ({
        name: e.name,
        description: e.description,
        lighting: e.lighting,
        mood: e.mood,
      })),
      scenes: episode.scenes.map(s => ({
        sceneNumber: s.sceneNumber,
        timecode: s.timecode,
        location: s.location,
        characters: JSON.parse(s.charactersJson || "[]"),
        action: s.action,
        narration: s.narration,
        dialogue: s.dialogue,
        camera: s.camera,
        emotion: s.emotion,
        soundDesign: s.soundDesign,
        imagePrompt: s.imagePrompt,
        videoPrompt: s.videoPrompt,
        audioPrompt: s.audioPrompt,
        qualityScore: s.qualityScore,
        imageUrl: s.imageUrl,
        videoUrl: s.videoUrl,
        status: s.status,
      })),
    };

    return NextResponse.json(exportData);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to export" }, { status: 500 });
  }
}
