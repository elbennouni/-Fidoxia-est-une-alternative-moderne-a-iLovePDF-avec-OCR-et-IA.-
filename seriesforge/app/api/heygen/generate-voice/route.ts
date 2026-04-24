import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import OpenAI from "openai";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Fallback: OpenAI TTS when HeyGen voice doesn't support Starfish
async function generateWithOpenAI(text: string, characterName: string, forceVoice?: string): Promise<string | null> {
  try {
    const voice = forceVoice || (
      characterName.toLowerCase().includes("narrat") ? "onyx"
      : characterName.toLowerCase().includes("femme") || characterName.toLowerCase().includes("sarah") || characterName.toLowerCase().includes("marie") ? "shimmer"
      : "echo"
    );

    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
      input: text.slice(0, 4096),
      speed: 1.0,
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    const fileName = `voice-${uuidv4().slice(0, 8)}.mp3`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "voices");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, fileName), buffer);
    return `/uploads/voices/${fileName}`;
  } catch {
    return null;
  }
}

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

    // OpenAI TTS voices (selected directly)
    if (voiceId.startsWith("openai-")) {
      const openaiVoiceName = voiceId.replace("openai-", "") as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
      const localUrl = await generateWithOpenAI(text.trim(), characterName, openaiVoiceName);
      if (localUrl) {
        await prisma.scene.update({ where: { id: sceneId }, data: { voiceUrl: localUrl } });
        return NextResponse.json({ success: true, audioUrl: localUrl, character: characterName, engine: "openai-tts" });
      }
      return NextResponse.json({ error: "OpenAI TTS échoué — vérifiez OPENAI_API_KEY" }, { status: 500 });
    }

    // Demo mode
    if (!apiKey || voiceId.startsWith("mock-")) {
      // Try OpenAI TTS as demo
      if (process.env.OPENAI_API_KEY) {
        const localUrl = await generateWithOpenAI(text.trim(), characterName);
        if (localUrl) {
          await prisma.scene.update({ where: { id: sceneId }, data: { voiceUrl: localUrl } });
          return NextResponse.json({ success: true, audioUrl: localUrl, character: characterName, engine: "openai-tts" });
        }
      }
      return NextResponse.json({
        success: true, mock: true,
        message: "Mode démo — ajoutez HEYGEN_API_KEY ou OPENAI_API_KEY",
        audioUrl: null, character: characterName,
      });
    }

    // Try HeyGen Starfish TTS
    const ttsRes = await fetch("https://api.heygen.com/v1/audio/text_to_speech", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ text: text.trim(), voice_id: voiceId, speed: 1.0 }),
    });

    if (ttsRes.ok) {
      const data = await ttsRes.json();
      if (data.error) throw new Error(JSON.stringify(data.error));
      const audioUrl = data.data?.audio_url || data.audio_url;
      if (audioUrl) {
        await prisma.scene.update({ where: { id: sceneId }, data: { voiceUrl: audioUrl } });
        return NextResponse.json({ success: true, audioUrl, character: characterName, engine: "heygen-starfish" });
      }
    }

    // HeyGen failed — check if it's "not supported" error
    const errText = await ttsRes.text().catch(() => "");
    const isNotSupported = errText.includes("not supported") || errText.includes("invalid_parameter");

    if (isNotSupported && process.env.OPENAI_API_KEY) {
      // Fallback to OpenAI TTS
      const localUrl = await generateWithOpenAI(text.trim(), characterName);
      if (localUrl) {
        await prisma.scene.update({ where: { id: sceneId }, data: { voiceUrl: localUrl } });
        return NextResponse.json({
          success: true,
          audioUrl: localUrl,
          character: characterName,
          engine: "openai-tts-fallback",
          note: `La voix HeyGen "${voiceId.slice(0, 8)}..." ne supporte pas Starfish TTS. Audio généré avec OpenAI TTS à la place.`,
        });
      }
    }

    throw new Error(`HeyGen TTS erreur ${ttsRes.status}: ${errText.slice(0, 200)}`);

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur génération voix";
    console.error("generate-voice error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
