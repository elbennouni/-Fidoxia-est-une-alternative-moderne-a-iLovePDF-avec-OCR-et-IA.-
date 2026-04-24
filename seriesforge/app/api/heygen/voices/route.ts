import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

const MOCK_VOICES = [
  { voice_id: "mock-fr-male-1", name: "Pierre — Homme FR dynamique", language: "fr", gender: "male", preview_audio: "" },
  { voice_id: "mock-fr-male-2", name: "Marc — Homme FR grave", language: "fr", gender: "male", preview_audio: "" },
  { voice_id: "mock-fr-male-3", name: "Antoine — Homme FR jeune", language: "fr", gender: "male", preview_audio: "" },
  { voice_id: "mock-fr-female-1", name: "Sophie — Femme FR douce", language: "fr", gender: "female", preview_audio: "" },
  { voice_id: "mock-fr-female-2", name: "Camille — Femme FR assertive", language: "fr", gender: "female", preview_audio: "" },
  { voice_id: "mock-en-male-1", name: "James — Male EN deep", language: "en", gender: "male", preview_audio: "" },
  { voice_id: "mock-en-female-1", name: "Emma — Female EN warm", language: "en", gender: "female", preview_audio: "" },
  { voice_id: "mock-presenter", name: "Alex — Présentateur TV énergique", language: "fr", gender: "male", preview_audio: "" },
];

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiKey = process.env.HEYGEN_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        voices: MOCK_VOICES,
        source: "mock",
        note: "Ajoutez HEYGEN_API_KEY dans Paramètres pour les vraies voix HeyGen"
      });
    }

    // Real HeyGen API call
    const res = await fetch("https://api.heygen.com/v2/voices", {
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      return NextResponse.json({
        voices: MOCK_VOICES,
        source: "mock",
        note: `HeyGen API error ${res.status} — clé invalide ou expirée`
      });
    }

    const data = await res.json();
    const voices = (data.data?.voices || data.voices || []).map((v: Record<string, unknown>) => ({
      voice_id: v.voice_id,
      name: v.name,
      language: v.language,
      gender: v.gender,
      preview_audio: v.preview_audio || "",
    }));

    return NextResponse.json({ voices, source: "heygen" });
  } catch (error) {
    return NextResponse.json({ voices: MOCK_VOICES, source: "mock" });
  }
}
