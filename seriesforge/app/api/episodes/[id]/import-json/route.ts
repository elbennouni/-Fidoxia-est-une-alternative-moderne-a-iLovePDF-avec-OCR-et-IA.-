import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buildConsistencyPrompt } from "@/lib/agents/characterConsistencyAgent";

/** Matches GET /api/episodes/:id/export-json; supports earlier exports with fewer fields. */
type ExportChar = {
  name: string;
  physicalDescription: string;
  outfit: string;
  personality: string;
  consistencyPrompt?: string | null;
  voiceProfile?: string | null;
  heygenVoiceId?: string | null;
  referenceImageUrl?: string | null;
  visualDNA?: string | null;
};

type ExportEnv = {
  name: string;
  description: string;
  lighting?: string | null;
  mood?: string | null;
  reusable?: boolean;
  previewImageUrl?: string | null;
};

type ExportScene = {
  sceneNumber: number;
  timecode?: string | null;
  location?: string | null;
  /** Either array of names, or stringified JSON in legacy shapes */
  characters?: unknown;
  action?: string | null;
  narration?: string | null;
  dialogue?: string | null;
  camera?: string | null;
  emotion?: string | null;
  soundDesign?: string | null;
  imagePrompt?: string | null;
  videoPrompt?: string | null;
  audioPrompt?: string | null;
  qualityScore?: number | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  imageHistory?: string | null;
  status?: string | null;
  voiceProvider?: string | null;
  voiceUrl?: string | null;
  validatedByUser?: boolean;
};

type ExportPayload = {
  series?: { title?: string; visualStyle?: string; tone?: string; format?: string };
  episode?: {
    title?: string;
    synopsis?: string;
    status?: string;
    format?: string;
    duration?: number | null;
    bgMusicUrl?: string | null;
    bgMusicName?: string | null;
    bgMusicVolume?: number | null;
  };
  characters?: ExportChar[];
  environments?: ExportEnv[];
  scenes?: ExportScene[];
};

function parseSceneCharactersList(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map(c => String(c));
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.map(c => String(c)) : [raw];
    } catch {
      return [raw];
    }
  }
  return [];
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const raw = (await req.json()) as Record<string, unknown>;

    const replaceSeriesMeta = raw.replaceSeriesMeta !== false;
    const replaceCharacters = raw.replaceCharacters !== false;
    const replaceEnvironments = raw.replaceEnvironments !== false;

    const optionKeys = new Set(["replaceSeriesMeta", "replaceCharacters", "replaceEnvironments", "data"]);
    let cleanData: ExportPayload;
    if (raw.data && typeof raw.data === "object" && raw.data !== null) {
      cleanData = raw.data as ExportPayload;
    } else {
      const rest: Record<string, unknown> = { ...raw };
      for (const k of optionKeys) delete rest[k];
      cleanData = rest as ExportPayload;
    }

    const seriesPatch = cleanData.series;
    const episodePart = cleanData.episode;
    const characters = cleanData.characters;
    const environments = cleanData.environments;
    const scenes = cleanData.scenes;

    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json(
        { error: "Invalid payload: scenes must be a non-empty array" },
        { status: 400 }
      );
    }
    for (const s of scenes) {
      if (typeof s?.sceneNumber !== "number" || !Number.isFinite(s.sceneNumber)) {
        return NextResponse.json(
          { error: "Each scene must have a numeric sceneNumber" },
          { status: 400 }
        );
      }
    }

    const episode = await prisma.episode.findFirst({
      where: { id, series: { userId: user.id } },
      include: { series: true },
    });

    if (!episode) return NextResponse.json({ error: "Episode not found" }, { status: 404 });

    const { series } = episode;

    await prisma.$transaction(async (tx) => {
      if (replaceSeriesMeta && seriesPatch) {
        const sData: { title?: string; visualStyle?: string; tone?: string } = {};
        if (typeof seriesPatch.title === "string") sData.title = seriesPatch.title;
        if (typeof seriesPatch.visualStyle === "string") sData.visualStyle = seriesPatch.visualStyle;
        if (typeof seriesPatch.tone === "string") sData.tone = seriesPatch.tone;
        if (Object.keys(sData).length) {
          await tx.series.update({ where: { id: series.id }, data: sData });
        }
      }

      if (replaceCharacters && Array.isArray(characters)) {
        await tx.character.deleteMany({ where: { seriesId: series.id } });
        for (const c of characters) {
          if (!c?.name) continue;
          const base = {
            name: c.name,
            physicalDescription: c.physicalDescription || "",
            outfit: c.outfit || "",
            personality: c.personality || "",
          };
          const consistencyPrompt =
            c.consistencyPrompt && String(c.consistencyPrompt).trim()
              ? c.consistencyPrompt
              : buildConsistencyPrompt(base);
          await tx.character.create({
            data: {
              seriesId: series.id,
              name: c.name,
              physicalDescription: base.physicalDescription,
              outfit: base.outfit,
              personality: base.personality,
              voiceProfile: c.voiceProfile ?? null,
              heygenVoiceId: c.heygenVoiceId ?? null,
              referenceImageUrl: c.referenceImageUrl ?? null,
              visualDNA: c.visualDNA ?? null,
              consistencyPrompt: String(consistencyPrompt),
            },
          });
        }
      }

      if (replaceEnvironments && Array.isArray(environments)) {
        await tx.environment.deleteMany({ where: { seriesId: series.id } });
        for (const e of environments) {
          if (!e?.name) continue;
          await tx.environment.create({
            data: {
              seriesId: series.id,
              name: e.name,
              description: e.description || "",
              lighting: e.lighting ?? null,
              mood: e.mood ?? null,
              reusable: e.reusable !== false,
              previewImageUrl: e.previewImageUrl ?? null,
            },
          });
        }
      }

      const epData: {
        title?: string;
        script?: string | null;
        status?: string;
        format?: string;
        duration?: number | null;
        bgMusicUrl?: string | null;
        bgMusicName?: string | null;
        bgMusicVolume?: number;
      } = {};
      if (episodePart) {
        if (typeof episodePart.title === "string") epData.title = episodePart.title;
        if (episodePart.synopsis !== undefined) epData.script = episodePart.synopsis;
        if (typeof episodePart.status === "string") epData.status = episodePart.status;
        if (typeof episodePart.format === "string") epData.format = episodePart.format;
        if (episodePart.duration !== undefined) epData.duration = episodePart.duration;
        if (episodePart.bgMusicUrl !== undefined) epData.bgMusicUrl = episodePart.bgMusicUrl;
        if (episodePart.bgMusicName !== undefined) epData.bgMusicName = episodePart.bgMusicName;
        if (episodePart.bgMusicVolume !== undefined) epData.bgMusicVolume = episodePart.bgMusicVolume;
      } else {
        if (replaceSeriesMeta && seriesPatch && typeof seriesPatch.format === "string") {
          epData.format = seriesPatch.format;
        }
      }
      if (Object.keys(epData).length) {
        await tx.episode.update({ where: { id }, data: epData });
      }

      await tx.scene.deleteMany({ where: { episodeId: id } });

      for (const s of scenes) {
        const list = parseSceneCharactersList(s.characters);
        await tx.scene.create({
          data: {
            episodeId: id,
            sceneNumber: s.sceneNumber,
            timecode: s.timecode ?? null,
            location: s.location ?? null,
            charactersJson: JSON.stringify(list),
            action: s.action ?? null,
            narration: s.narration ?? null,
            dialogue: s.dialogue ?? null,
            camera: s.camera ?? null,
            emotion: s.emotion ?? null,
            soundDesign: s.soundDesign ?? null,
            imagePrompt: s.imagePrompt ?? null,
            videoPrompt: s.videoPrompt ?? null,
            audioPrompt: s.audioPrompt ?? null,
            qualityScore: s.qualityScore ?? null,
            imageUrl: s.imageUrl ?? null,
            videoUrl: s.videoUrl ?? null,
            imageHistory: s.imageHistory ?? null,
            status: s.status && s.status.length ? s.status : "scripted",
            voiceProvider: s.voiceProvider ?? null,
            voiceUrl: s.voiceUrl ?? null,
            validatedByUser: s.validatedByUser === true,
          },
        });
      }
    });

    const full = await prisma.episode.findFirst({
      where: { id },
      include: {
        series: { include: { characters: true, environments: true } },
        scenes: { orderBy: { sceneNumber: "asc" } },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Episode restored from export JSON",
      characterCount: full?.series.characters.length ?? 0,
      environmentCount: full?.series.environments.length ?? 0,
      sceneCount: full?.scenes.length ?? 0,
      episode: full,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 }
    );
  }
}
