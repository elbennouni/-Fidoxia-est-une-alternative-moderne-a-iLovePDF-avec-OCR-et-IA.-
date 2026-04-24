import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { sceneId, text, voiceId, characterName } = await req.json();

    if (!sceneId || !text?.trim() || !voiceId) {
      return NextResponse.json({ error: "sceneId, text et voiceId requis" }, { status: 400 });
    }

    const scene = await prisma.scene.findFirst({
      where: { id: sceneId, episode: { series: { userId: user.id } } },
    });
    if (!scene) return NextResponse.json({ error: "Scène non trouvée" }, { status: 404 });

    const apiKey = process.env.HEYGEN_API_KEY;

    // Demo mode
    if (!apiKey || voiceId.startsWith("mock-")) {
      return NextResponse.json({
        success: true,
        mock: true,
        message: "Mode démo — ajoutez HEYGEN_API_KEY dans Paramètres pour les vraies voix",
        audioUrl: null,
        character: characterName,
      });
    }

    // CORRECT endpoint: POST https://api.heygen.com/v1/audio/text_to_speech
    // CORRECT header: X-Api-Key (case-sensitive!)
    const ttsRes = await fetch("https://api.heygen.com/v1/audio/text_to_speech", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,  // IMPORTANT: X-Api-Key not X-API-KEY
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        text: text.trim(),
        voice_id: voiceId,
        speed: 1.0,
      }),
    });

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      console.error("HeyGen TTS error:", ttsRes.status, errText.slice(0, 300));
      throw new Error(`HeyGen TTS erreur ${ttsRes.status}: ${errText.slice(0, 200)}`);
    }

    const data = await ttsRes.json();

    if (data.error) {
      throw new Error(`HeyGen TTS: ${JSON.stringify(data.error)}`);
    }

    const audioUrl = data.data?.audio_url || data.audio_url || data.url;

    if (audioUrl) {
      await prisma.scene.update({ where: { id: sceneId }, data: { voiceUrl: audioUrl } });
    }

    return NextResponse.json({
      success: true,
      audioUrl,
      character: characterName,
      duration: data.data?.duration,
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur génération voix";
    console.error("generate-voice error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
