import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// Great French voices on ElevenLabs
const FRENCH_VOICES_MOCK = [
  { voice_id: "el-fr-male-1", name: "🇫🇷 Pierre — Narrateur FR naturel", language: "fr", gender: "male", preview_audio: "", provider: "elevenlabs" },
  { voice_id: "el-fr-male-2", name: "🇫🇷 François — FR voix grave dramatique", language: "fr", gender: "male", preview_audio: "", provider: "elevenlabs" },
  { voice_id: "el-fr-female-1", name: "🇫🇷 Camille — FR femme douce naturelle", language: "fr", gender: "female", preview_audio: "", provider: "elevenlabs" },
  { voice_id: "el-fr-female-2", name: "🇫🇷 Sophie — FR femme énergique", language: "fr", gender: "female", preview_audio: "", provider: "elevenlabs" },
  { voice_id: "el-fr-male-3", name: "🇫🇷 Marc — FR présentateur TV", language: "fr", gender: "male", preview_audio: "", provider: "elevenlabs" },
];

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ voices: FRENCH_VOICES_MOCK, source: "mock" });
    }

    // Real ElevenLabs API
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey, "Accept": "application/json" },
    });

    if (!res.ok) {
      return NextResponse.json({ voices: FRENCH_VOICES_MOCK, source: "mock" });
    }

    const data = await res.json();
    const voices = (data.voices || [])
      .map((v: Record<string, unknown>) => ({
        voice_id: `el-${v.voice_id}`,
        name: `🎙 ${v.name}`,
        language: (v.labels as Record<string, string>)?.language || "multilingual",
        gender: (v.labels as Record<string, string>)?.gender || "neutral",
        preview_audio: v.preview_url || "",
        provider: "elevenlabs",
      }))
      .sort((a: { language: string }, b: { language: string }) => {
        const aFr = a.language?.toLowerCase().includes("fr");
        const bFr = b.language?.toLowerCase().includes("fr");
        if (aFr && !bFr) return -1;
        if (!aFr && bFr) return 1;
        return 0;
      });

    return NextResponse.json({ voices, source: "elevenlabs" });
  } catch {
    return NextResponse.json({ voices: FRENCH_VOICES_MOCK, source: "mock" });
  }
}
