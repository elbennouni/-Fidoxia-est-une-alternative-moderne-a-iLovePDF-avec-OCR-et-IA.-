import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface PromptOptimizationResult {
  imagePrompt: string;
  videoPrompt: string;
  alternativeDirection: string;
}

interface PromptOptimizeInput {
  sceneNumber: number;
  title?: string | null;
  location?: string | null;
  action?: string | null;
  narration?: string | null;
  dialogue?: string | null;
  camera?: string | null;
  emotion?: string | null;
  soundDesign?: string | null;
  imagePrompt?: string | null;
  videoPrompt?: string | null;
  characters: Array<{
    name: string;
    physicalDescription?: string | null;
    outfit?: string | null;
    consistencyPrompt?: string | null;
  }>;
  environments: Array<{
    name: string;
    description: string;
    lighting?: string | null;
    mood?: string | null;
  }>;
  manualReferences?: string[];
  visualStyle: string;
  format: string;
}

function buildFallbackResult(input: PromptOptimizeInput): PromptOptimizationResult {
  const charactersBlock = input.characters.length > 0
    ? input.characters.map((character) => `${character.name}: ${character.physicalDescription || "personnage de la scène"}, tenue ${character.outfit || "inchangée"}.`).join(" ")
    : "Aucun personnage précisé.";
  const environmentBlock = input.environments.find((environment) =>
    input.location?.toLowerCase().includes(environment.name.toLowerCase())
  );
  const environmentText = environmentBlock
    ? `${environmentBlock.name}: ${environmentBlock.description}. ${environmentBlock.lighting || ""} ${environmentBlock.mood || ""}`.trim()
    : input.location || "Décor à préciser";
  const manualReferenceBlock = input.manualReferences && input.manualReferences.length > 0
    ? ` Références manuelles obligatoires à respecter: ${input.manualReferences.join(" | ")}.`
    : "";

  return {
    imagePrompt: `${input.visualStyle}, ${input.format}, cinematic keyframe. Scene ${input.sceneNumber}. ${input.action || ""} ${charactersBlock} Décor: ${environmentText}. Caméra: ${input.camera || "medium shot"}. Emotion: ${input.emotion || "cinématique"}.${manualReferenceBlock} Conserver les visages, les tenues, les accessoires uploadés et le cadrage cohérent.`,
    videoPrompt: `${input.visualStyle}, ${input.format}, cinematic motion shot. Scene ${input.sceneNumber}. ${input.action || ""} Dialogue: ${input.dialogue || "none"}. Narration: ${input.narration || "none"}. Caméra: ${input.camera || "push-in cinématique"}.${manualReferenceBlock} Garder le mouvement, la lisibilité des personnages et éviter toute scène statique.`,
    alternativeDirection: `Alternative IA: transformer la scène ${input.sceneNumber} en variation plus cinématique avec un axe caméra plus lisible sur ${input.location || "le décor"} et davantage de contraste émotionnel.`,
  };
}

export async function optimizeScenePrompts(input: PromptOptimizeInput): Promise<PromptOptimizationResult> {
  if (!process.env.OPENAI_API_KEY) return buildFallbackResult(input);

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    temperature: 0.7,
    messages: [
      {
        role: "user",
        content: `Tu es un agent IA spécialisé dans l'optimisation de prompts image et vidéo pour un SaaS de storyboard.
Tu dois améliorer les prompts sans trahir la scène ni le scénario.

Règles:
- conserver la scène, les personnages, le décor et l'intention dramatique
- améliorer le cadrage, la lisibilité, le mouvement, la cohérence visuelle et la qualité du rendu
- proposer une variation de mise en scène directement exploitable
- si des références manuelles de scène sont fournies, elles sont obligatoires et doivent être reprises dans le prompt final
- répondre en français
- retourner uniquement un JSON valide

Retourne exactement:
{
  "imagePrompt": "prompt image amélioré",
  "videoPrompt": "prompt vidéo amélioré",
  "alternativeDirection": "proposition d'autre mise en scène compatible avec la scène"
}

SCÈNE:
${JSON.stringify(input, null, 2)}`
      }
    ]
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return buildFallbackResult(input);

  try {
    const parsed = JSON.parse(content) as Partial<PromptOptimizationResult>;
    return {
      imagePrompt: parsed.imagePrompt || buildFallbackResult(input).imagePrompt,
      videoPrompt: parsed.videoPrompt || buildFallbackResult(input).videoPrompt,
      alternativeDirection: parsed.alternativeDirection || buildFallbackResult(input).alternativeDirection,
    };
  } catch {
    return buildFallbackResult(input);
  }
}
