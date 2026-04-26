import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { inferVoiceDirection } from "@/lib/audio/voiceDirection";
import { getApiKey } from "@/lib/server/apiKeyOverride";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { sceneId, text, voiceId, characterName } = await req.json();

    if (!sceneId || !text?.trim()) {
      return NextResponse.json({ error: "sceneId et text requis" }, { status: 400 });
    }

    const scene = await prisma.scene.findFirst({
      where: { id: sceneId, episode: { series: { userId: user.id } } },
    });
    if (!scene) return NextResponse.json({ error: "Scène non trouvée" }, { status: 404 });

    const direction = inferVoiceDirection({
      text,
      emotion: scene.emotion,
      audioPrompt: scene.audioPrompt,
    });

    const apiKey = getApiKey(req, "ELEVENLABS_API_KEY");

    // Extract real voice ID (remove "el-" prefix)
    const realVoiceId = voiceId.replace(/^el-/, "");

    if (!apiKey || voiceId.startsWith("el-fr-")) {
      // Mock mode or demo voice — use OpenAI TTS fallback
      const openaiKey = getApiKey(req, "OPENAI_API_KEY");
      if (openaiKey) {
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({ apiKey: openaiKey });
        const voice = characterName?.toLowerCase().includes("narrat") ? "onyx"
          : characterName?.toLowerCase().includes("femme") || characterName?.toLowerCase().includes("sophie") || characterName?.toLowerCase().includes("camille") ? "shimmer"
          : "echo";

        const response = await openai.audio.speech.create({
          model: "tts-1-hd",
          voice: voice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
          input: text.trim().slice(0, 4096),
          speed: direction.speed,
        });

        const buffer = Buffer.from(await response.arrayBuffer());
        const fileName = `voice-${uuidv4().slice(0, 8)}.mp3`;
        const uploadDir = path.join(process.cwd(), "public", "uploads", "voices");
        await mkdir(uploadDir, { recursive: true });
        await writeFile(path.join(uploadDir, fileName), buffer);
        const audioUrl = `/uploads/voices/${fileName}`;

        await prisma.scene.update({ where: { id: sceneId }, data: { voiceUrl: audioUrl } });
        return NextResponse.json({ success: true, audioUrl, character: characterName, engine: "openai-tts-hd" });
      }
      return NextResponse.json({ success: true, mock: true, message: "Ajoutez ELEVENLABS_API_KEY ou OPENAI_API_KEY" });
    }

    // Real ElevenLabs TTS
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${realVoiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text: text.trim().slice(0, 5000),
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: direction.stability,
          similarity_boost: direction.similarityBoost,
          style: direction.style,
          use_speaker_boost: direction.useSpeakerBoost,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`ElevenLabs erreur ${res.status}: ${err.slice(0, 200)}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const fileName = `voice-${uuidv4().slice(0, 8)}.mp3`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "voices");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, fileName), buffer);
    const audioUrl = `/uploads/voices/${fileName}`;

    await prisma.scene.update({ where: { id: sceneId }, data: { voiceUrl: audioUrl } });

    return NextResponse.json({
      success: true,
      audioUrl,
      character: characterName,
      engine: "elevenlabs-multilingual-v2",
      intensity: direction.label,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
