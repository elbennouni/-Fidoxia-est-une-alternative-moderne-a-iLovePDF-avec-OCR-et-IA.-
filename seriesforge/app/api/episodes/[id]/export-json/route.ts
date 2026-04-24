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
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      series: {
        id: episode.seriesId,
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
        format: episode.format,
        duration: episode.duration,
        bgMusicUrl: episode.bgMusicUrl,
        bgMusicName: episode.bgMusicName,
        bgMusicVolume: episode.bgMusicVolume,
      },
      characters: episode.series.characters.map(
        (c: {
          name: string;
          physicalDescription: string;
          outfit: string;
          personality: string;
          voiceProfile: string | null;
          heygenVoiceId: string | null;
          referenceImageUrl: string | null;
          visualDNA: string | null;
          consistencyPrompt: string;
        }) => ({
          name: c.name,
          physicalDescription: c.physicalDescription,
          outfit: c.outfit,
          personality: c.personality,
          voiceProfile: c.voiceProfile,
          heygenVoiceId: c.heygenVoiceId,
          referenceImageUrl: c.referenceImageUrl,
          visualDNA: c.visualDNA,
          consistencyPrompt: c.consistencyPrompt,
        })
      ),
      environments: episode.series.environments.map(
        (e: {
          name: string;
          description: string;
          lighting: string | null;
          mood: string | null;
          reusable: boolean;
          previewImageUrl: string | null;
        }) => ({
          name: e.name,
          description: e.description,
          lighting: e.lighting,
          mood: e.mood,
          reusable: e.reusable,
          previewImageUrl: e.previewImageUrl,
        })
      ),
      scenes: episode.scenes.map(
        (s: {
          sceneNumber: number;
          timecode: string | null;
          location: string | null;
          charactersJson: string | null;
          action: string | null;
          narration: string | null;
          dialogue: string | null;
          camera: string | null;
          emotion: string | null;
          soundDesign: string | null;
          imagePrompt: string | null;
          videoPrompt: string | null;
          audioPrompt: string | null;
          qualityScore: number | null;
          imageUrl: string | null;
          videoUrl: string | null;
          imageHistory: string | null;
          status: string;
          voiceProvider: string | null;
          voiceUrl: string | null;
          validatedByUser: boolean;
        }) => ({
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
          imageHistory: s.imageHistory,
          status: s.status,
          voiceProvider: s.voiceProvider,
          voiceUrl: s.voiceUrl,
          validatedByUser: s.validatedByUser,
        })
      ),
    };

    return NextResponse.json(exportData);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to export" }, { status: 500 });
  }
}
