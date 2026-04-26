import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

const MOCK_VOICES = [
  { voice_id: "mock-fr-m-narrateur", name: "🎙 Narrateur TV — FR grave cinématique", language: "French", gender: "male", preview_audio: "" },
  { voice_id: "mock-fr-m-jeune", name: "Yanis — FR jeune dynamique", language: "French", gender: "male", preview_audio: "" },
  { voice_id: "mock-fr-m-marseille", name: "Hassan — FR accent marseillais", language: "French", gender: "male", preview_audio: "" },
  { voice_id: "mock-fr-m-grognon", name: "Roger — FR homme âgé grognon", language: "French", gender: "male", preview_audio: "" },
  { voice_id: "mock-fr-m-sarcas", name: "Karim — FR sarcastique posé", language: "French", gender: "male", preview_audio: "" },
  { voice_id: "mock-fr-m-presentateur", name: "Abel — FR présentateur TV", language: "French", gender: "male", preview_audio: "" },
  { voice_id: "mock-fr-f-forte", name: "Sarah — FR femme forte compétitive", language: "French", gender: "female", preview_audio: "" },
  { voice_id: "mock-fr-f-douce", name: "Marie — FR voix douce", language: "French", gender: "female", preview_audio: "" },
  { voice_id: "mock-fr-f-energique", name: "Camille — FR énergique pétillante", language: "French", gender: "female", preview_audio: "" },
  { voice_id: "mock-en-m-deep", name: "James — EN voix grave profonde", language: "English", gender: "male", preview_audio: "" },
  { voice_id: "mock-en-f-warm", name: "Emma — EN voix chaleureuse", language: "English", gender: "female", preview_audio: "" },
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

    // CORRECT: X-Api-Key header (not X-API-KEY)
    // Use v2/voices which has 2325 voices including 58 French
    const res = await fetch("https://api.heygen.com/v2/voices", {
      headers: {
        "X-Api-Key": apiKey,
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("HeyGen voices error:", res.status, err.slice(0, 100));
      return NextResponse.json({
        voices: MOCK_VOICES,
        source: "mock",
        note: `HeyGen API erreur ${res.status} — vérifiez votre clé dans Paramètres`
      });
    }

    const data = await res.json();
    const allVoices = data.data?.voices || data.voices || [];

    // Show ALL voices, including custom/user-created voices.
    // Compatibility with Starfish TTS is surfaced as metadata instead of silently hiding voices.
    let voices = allVoices.map((v: Record<string, unknown>) => {
      const language = String(v.language || "");
      const starfishCompatible =
        v.emotion_support === true ||
        v.support_interactive_avatar === true ||
        language.toLowerCase().includes("multilingual");

      return {
        voice_id: v.voice_id,
        name: v.name,
        language: v.language,
        gender: v.gender,
        preview_audio: v.preview_audio || "",
        starfish_compatible: starfishCompatible,
        provider: "heygen",
        visibility: v.is_public === false ? "custom" : "catalog",
      };
    });

    // Add OpenAI TTS voices as fallback option (always work)
    const openaiVoices = [
      { voice_id: "openai-onyx", name: "🤖 OpenAI — Onyx (Homme grave FR)", language: "Multilingual", gender: "male", preview_audio: "", starfish_compatible: true, provider: "openai" },
      { voice_id: "openai-echo", name: "🤖 OpenAI — Echo (Homme dynamique FR)", language: "Multilingual", gender: "male", preview_audio: "", starfish_compatible: true, provider: "openai" },
      { voice_id: "openai-fable", name: "🤖 OpenAI — Fable (Narrateur FR)", language: "Multilingual", gender: "male", preview_audio: "", starfish_compatible: true, provider: "openai" },
      { voice_id: "openai-shimmer", name: "🤖 OpenAI — Shimmer (Femme FR)", language: "Multilingual", gender: "female", preview_audio: "", starfish_compatible: true, provider: "openai" },
      { voice_id: "openai-nova", name: "🤖 OpenAI — Nova (Femme jeune FR)", language: "Multilingual", gender: "female", preview_audio: "", starfish_compatible: true, provider: "openai" },
      { voice_id: "openai-alloy", name: "🤖 OpenAI — Alloy (Neutre FR)", language: "Multilingual", gender: "male", preview_audio: "", starfish_compatible: true, provider: "openai" },
    ];

    // Sort: French first, then multilingual, then Starfish-compatible, then custom voices, then others
    voices = [...openaiVoices, ...voices].sort((a: { language: string; starfish_compatible?: boolean; visibility?: string }, b: { language: string; starfish_compatible?: boolean; visibility?: string }) => {
      const aFr = String(a.language).toLowerCase().includes("french");
      const bFr = String(b.language).toLowerCase().includes("french");
      const aMulti = String(a.language).toLowerCase().includes("multilingual");
      const bMulti = String(b.language).toLowerCase().includes("multilingual");
      const aStarfish = a.starfish_compatible === true;
      const bStarfish = b.starfish_compatible === true;
      const aCustom = a.visibility === "custom";
      const bCustom = b.visibility === "custom";
      if (aFr && !bFr) return -1;
      if (!aFr && bFr) return 1;
      if (aMulti && !bMulti) return -1;
      if (!aMulti && bMulti) return 1;
      if (aStarfish && !bStarfish) return -1;
      if (!aStarfish && bStarfish) return 1;
      if (aCustom && !bCustom) return -1;
      if (!aCustom && bCustom) return 1;
      return 0;
    });

    return NextResponse.json({
      voices,
      source: "heygen",
      totalHeyGen: allVoices.length,
      note: "Toutes les voix HeyGen sont affichées. Les voix marquées non compatibles Starfish peuvent nécessiter un fallback OpenAI pour la génération audio.",
    });
  } catch (error) {
    console.error("HeyGen voices error:", error);
    return NextResponse.json({ voices: MOCK_VOICES, source: "mock" });
  }
}
