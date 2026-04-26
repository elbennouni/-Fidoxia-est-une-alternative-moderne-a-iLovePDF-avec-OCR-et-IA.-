import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import OpenAI from "openai";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { inferVoiceDirection } from "@/lib/audio/voiceDirection";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function saveAudioBuffer(buffer: Buffer, prefix = "voice"): Promise<string> {
  const fileName = `${prefix}-${uuidv4().slice(0, 8)}.mp3`;
  const dir = path.join(process.cwd(), "public", "uploads", "voices");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), buffer);
  return `/uploads/voices/${fileName}`;
}

async function openAITTS(
  text: string,
  voiceName: string,
  direction?: ReturnType<typeof inferVoiceDirection>
): Promise<string | null> {
  try {
    const voiceMap: Record<string, string> = {
      "openai-onyx": "onyx", "openai-echo": "echo", "openai-fable": "fable",
      "openai-shimmer": "shimmer", "openai-nova": "nova", "openai-alloy": "alloy",
    };
    const voice = (voiceMap[voiceName] || (
      voiceName.toLowerCase().includes("narrat") || voiceName.toLowerCase().includes("graves") ? "onyx"
      : voiceName.toLowerCase().includes("femme") || voiceName.toLowerCase().includes("sophie") ? "shimmer"
      : "echo"
    )) as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

    const resp = await openai.audio.speech.create({
      model: "tts-1-hd",
      voice,
      input: text.slice(0, 4096),
      speed: direction?.speed || 1.0,
    });
    const buf = Buffer.from(await resp.arrayBuffer());
    return await saveAudioBuffer(buf);
  } catch { return null; }
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
    const direction = inferVoiceDirection({
      text: text.trim(),
      emotion: scene.emotion,
      audioPrompt: scene.audioPrompt,
      voiceProfile: characterName,
    });

    // ─── OpenAI TTS voices (selected directly) ───────────────────────
    if (voiceId.startsWith("openai-")) {
      const url = await openAITTS(text.trim(), voiceId, direction);
      if (!url) throw new Error("OpenAI TTS échoué — vérifiez OPENAI_API_KEY");
      await prisma.scene.update({ where: { id: sceneId }, data: { voiceUrl: url } });
      return NextResponse.json({ success: true, audioUrl: url, character: characterName, engine: "openai-tts-hd", direction: direction.label });
    }

    // ─── ElevenLabs voices ────────────────────────────────────────────
    if (voiceId.startsWith("el-")) {
      const elKey = process.env.ELEVENLABS_API_KEY;
      if (!elKey) throw new Error("ELEVENLABS_API_KEY manquante — ajoutez-la dans Paramètres");
      const realId = voiceId.replace(/^el-/, "");
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${realId}`, {
        method: "POST",
        headers: { "xi-api-key": elKey, "Content-Type": "application/json", "Accept": "audio/mpeg" },
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
      if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text().then(t => t.slice(0, 200))}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const url = await saveAudioBuffer(buf);
      await prisma.scene.update({ where: { id: sceneId }, data: { voiceUrl: url } });
      return NextResponse.json({ success: true, audioUrl: url, character: characterName, engine: "elevenlabs-v2", direction: direction.label });
    }

    // ─── Mock voices ──────────────────────────────────────────────────
    if (voiceId.startsWith("mock-")) {
      // Use OpenAI TTS as demo
      if (process.env.OPENAI_API_KEY) {
        const url = await openAITTS(text.trim(), characterName, direction);
        if (url) {
          await prisma.scene.update({ where: { id: sceneId }, data: { voiceUrl: url } });
          return NextResponse.json({ success: true, audioUrl: url, character: characterName, engine: "openai-tts-hd-demo", direction: direction.label });
        }
      }
      return NextResponse.json({ success: true, mock: true, message: "Mode démo — ajoutez une clé API" });
    }

    // ─── HeyGen TTS ───────────────────────────────────────────────────
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) throw new Error("HEYGEN_API_KEY manquante");

    const ttsRes = await fetch("https://api.heygen.com/v1/audio/text_to_speech", {
      method: "POST",
      headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim(), voice_id: voiceId, speed: direction.speed }),
    });

    if (ttsRes.ok) {
      const data = await ttsRes.json();
      if (!data.error) {
        const audioUrl = data.data?.audio_url;
        if (audioUrl) {
          await prisma.scene.update({ where: { id: sceneId }, data: { voiceUrl: audioUrl } });
          return NextResponse.json({ success: true, audioUrl, character: characterName, engine: "heygen-starfish", direction: direction.label });
        }
      }
      // HeyGen returned error
      const errCode = data.error?.code;
      const errMsg = data.error?.message || "";

      if (errCode === "voice_unavailable" || errMsg.includes("not supported") || errMsg.includes("invalid_parameter")) {
        // Fallback to OpenAI TTS
        const url = await openAITTS(text.trim(), characterName, direction);
        if (url) {
          await prisma.scene.update({ where: { id: sceneId }, data: { voiceUrl: url } });
          return NextResponse.json({
            success: true, audioUrl: url, character: characterName,
            engine: "openai-tts-fallback",
            direction: direction.label,
            warning: `La voix HeyGen sélectionnée n'est pas compatible avec le moteur Starfish TTS (${voiceId}) — audio généré avec OpenAI TTS HD à la place.`,
          });
        }
      }
      throw new Error(`HeyGen: ${data.error?.message || "Erreur inconnue"}`);
    }

    const errText = await ttsRes.text();
    // Fallback
    const url = await openAITTS(text.trim(), characterName, direction);
    if (url) {
      await prisma.scene.update({ where: { id: sceneId }, data: { voiceUrl: url } });
      return NextResponse.json({ success: true, audioUrl: url, character: characterName, engine: "openai-fallback", direction: direction.label });
    }
    throw new Error(`HeyGen ${ttsRes.status}: ${errText.slice(0, 200)}`);

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur voix";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
