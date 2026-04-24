import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// Extensive French voice library for mock mode
const MOCK_VOICES = [
  // === VOIX FRANÇAISES MASCULINES ===
  { voice_id: "mock-fr-m-narrateur", name: "🎙 Narrateur TV — FR grave cinématique", language: "fr", gender: "male", preview_audio: "", style: "narrator" },
  { voice_id: "mock-fr-m-jeune", name: "Yanis — FR jeune dynamique 20 ans", language: "fr", gender: "male", preview_audio: "" },
  { voice_id: "mock-fr-m-marseille", name: "Hassan — FR accent marseillais énergique", language: "fr", gender: "male", preview_audio: "" },
  { voice_id: "mock-fr-m-grognon", name: "Roger — FR homme âgé grognon bourru", language: "fr", gender: "male", preview_audio: "" },
  { voice_id: "mock-fr-m-sarcas", name: "Karim — FR sarcastique posé calculateur", language: "fr", gender: "male", preview_audio: "" },
  { voice_id: "mock-fr-m-presentateur", name: "Abel — FR présentateur TV ultra-enthousiaste", language: "fr", gender: "male", preview_audio: "" },
  { voice_id: "mock-fr-m-grave", name: "Marc — FR voix grave autoritaire", language: "fr", gender: "male", preview_audio: "" },
  { voice_id: "mock-fr-m-cool", name: "Thomas — FR voix cool décontractée", language: "fr", gender: "male", preview_audio: "" },
  { voice_id: "mock-fr-m-drama", name: "Victor — FR dramatique théâtral", language: "fr", gender: "male", preview_audio: "" },
  { voice_id: "mock-fr-m-enfant", name: "Léo — FR enfant espiègle 10 ans", language: "fr", gender: "male", preview_audio: "" },
  { voice_id: "mock-fr-m-pro", name: "Laurent — FR professionnel neutre", language: "fr", gender: "male", preview_audio: "" },
  { voice_id: "mock-fr-m-villain", name: "Sébastien — FR voix de méchant menaçante", language: "fr", gender: "male", preview_audio: "" },
  // === VOIX FRANÇAISES FÉMININES ===
  { voice_id: "mock-fr-f-forte", name: "Sarah — FR femme forte compétitive", language: "fr", gender: "female", preview_audio: "" },
  { voice_id: "mock-fr-f-douce", name: "Marie — FR voix douce bienveillante", language: "fr", gender: "female", preview_audio: "" },
  { voice_id: "mock-fr-f-energique", name: "Camille — FR énergique pétillante", language: "fr", gender: "female", preview_audio: "" },
  { voice_id: "mock-fr-f-elegante", name: "Isabelle — FR élégante posée", language: "fr", gender: "female", preview_audio: "" },
  { voice_id: "mock-fr-f-jeune", name: "Léa — FR jeune femme 22 ans", language: "fr", gender: "female", preview_audio: "" },
  { voice_id: "mock-fr-f-mature", name: "Brigitte — FR femme mature 50 ans", language: "fr", gender: "female", preview_audio: "" },
  { voice_id: "mock-fr-f-comique", name: "Amélie — FR comique espiègle", language: "fr", gender: "female", preview_audio: "" },
  { voice_id: "mock-fr-f-presentatrice", name: "Claire — FR présentatrice TV", language: "fr", gender: "female", preview_audio: "" },
  // === VOIX ANGLAISES (quelques-unes) ===
  { voice_id: "mock-en-m-deep", name: "James — EN voix grave profonde", language: "en", gender: "male", preview_audio: "" },
  { voice_id: "mock-en-f-warm", name: "Emma — EN voix chaleureuse", language: "en", gender: "female", preview_audio: "" },
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
        note: `HeyGen API error ${res.status} — vérifiez votre clé dans Paramètres`
      });
    }

    const data = await res.json();
    let voices = (data.data?.voices || data.voices || []).map((v: Record<string, unknown>) => ({
      voice_id: v.voice_id,
      name: v.name,
      language: v.language,
      gender: v.gender,
      preview_audio: v.preview_audio || "",
    }));

    // Sort: French voices first
    voices = voices.sort((a: { language: string }, b: { language: string }) => {
      if (a.language === "fr" && b.language !== "fr") return -1;
      if (a.language !== "fr" && b.language === "fr") return 1;
      return 0;
    });

    return NextResponse.json({ voices, source: "heygen" });
  } catch {
    return NextResponse.json({ voices: MOCK_VOICES, source: "mock" });
  }
}
