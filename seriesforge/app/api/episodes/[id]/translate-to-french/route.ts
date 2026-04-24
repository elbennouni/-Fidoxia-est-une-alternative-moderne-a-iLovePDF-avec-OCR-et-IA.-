import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function translateSceneToFrench(scene: {
  action?: string | null;
  narration?: string | null;
  dialogue?: string | null;
  emotion?: string | null;
  soundDesign?: string | null;
  camera?: string | null;
}): Promise<{
  action: string;
  narration: string;
  dialogue: string;
  emotion: string;
  soundDesign: string;
  camera: string;
}> {
  const prompt = `Tu es un traducteur professionnel de scénarios animés.
Traduis UNIQUEMENT en français les textes ci-dessous. Garde exactement le format, la ponctuation, les noms de personnages tels quels.
NE traduis PAS les noms propres (Hassan, Sarah, Konanta, etc.).
NE change PAS le sens ou le ton — conserve l'humour, le dramatique, les émotions.

TEXTES À TRADUIRE:

ACTION: ${scene.action || ""}
NARRATION: ${scene.narration || ""}
DIALOGUE: ${scene.dialogue || ""}
ÉMOTION: ${scene.emotion || ""}
DESIGN SONORE: ${scene.soundDesign || ""}
CAMÉRA: ${scene.camera || ""}

Retourne UNIQUEMENT du JSON valide:
{
  "action": "traduction française",
  "narration": "traduction française",
  "dialogue": "traduction française (garde format PERSONNAGE: réplique)",
  "emotion": "traduction française",
  "soundDesign": "traduction française",
  "camera": "traduction française"
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  return JSON.parse(response.choices[0].message.content || "{}");
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const episode = await prisma.episode.findFirst({
      where: { id, series: { userId: user.id } },
      include: { scenes: { orderBy: { sceneNumber: "asc" } } },
    });

    if (!episode) return NextResponse.json({ error: "Épisode non trouvé" }, { status: 404 });

    const results = [];

    for (const scene of episode.scenes) {
      try {
        const translated = await translateSceneToFrench({
          action: scene.action,
          narration: scene.narration,
          dialogue: scene.dialogue,
          emotion: scene.emotion,
          soundDesign: scene.soundDesign,
          camera: scene.camera,
        });

        await prisma.scene.update({
          where: { id: scene.id },
          data: {
            action: translated.action || scene.action,
            narration: translated.narration || scene.narration,
            dialogue: translated.dialogue || scene.dialogue,
            emotion: translated.emotion || scene.emotion,
            soundDesign: translated.soundDesign || scene.soundDesign,
            camera: translated.camera || scene.camera,
            // Reset voice since text changed
            voiceUrl: null,
          },
        });

        results.push({ sceneNumber: scene.sceneNumber, success: true });
      } catch (err) {
        results.push({
          sceneNumber: scene.sceneNumber,
          success: false,
          error: err instanceof Error ? err.message : "Erreur",
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      translated: successCount,
      total: episode.scenes.length,
      results,
      message: `${successCount} scènes traduites en français. Les audios ont été réinitialisés — vous pouvez maintenant regénérer les voix.`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Traduction échouée";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
