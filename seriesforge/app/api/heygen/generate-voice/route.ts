import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { sceneId, text, voiceId, characterName } = await req.json();

    if (!sceneId || !text || !voiceId) {
      return NextResponse.json({ error: "sceneId, text and voiceId required" }, { status: 400 });
    }

    const scene = await prisma.scene.findFirst({
      where: { id: sceneId, episode: { series: { userId: user.id } } },
    });
    if (!scene) return NextResponse.json({ error: "Scene not found" }, { status: 404 });

    const apiKey = process.env.HEYGEN_API_KEY;

    if (!apiKey || voiceId.startsWith("mock-")) {
      // Return mock response
      return NextResponse.json({
        success: true,
        mock: true,
        message: "Mode démo — ajoutez HEYGEN_API_KEY pour générer les vraies voix",
        audioUrl: null,
        character: characterName,
        text: text.slice(0, 100) + (text.length > 100 ? "..." : ""),
      });
    }

    // Real HeyGen TTS API
    const res = await fetch("https://api.heygen.com/v1/voice.generate", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        voice_id: voiceId,
        text: text,
        speed: 1.0,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`HeyGen API error: ${err}`);
    }

    const data = await res.json();
    const audioUrl = data.data?.audio_url || data.audio_url;

    if (audioUrl) {
      await prisma.scene.update({
        where: { id: sceneId },
        data: { voiceUrl: audioUrl },
      });
    }

    return NextResponse.json({
      success: true,
      audioUrl,
      character: characterName,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
