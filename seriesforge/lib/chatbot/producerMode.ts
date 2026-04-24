export interface ProducerAgentStatus {
  id: string;
  name: string;
  role: string;
  status: "idle" | "ready" | "active" | "warning";
  summary: string;
}

export interface ProducerReference {
  type: "character" | "environment" | "prop" | "audio";
  name: string;
  description: string;
}

export interface ProducerScenePlan {
  sceneNumber: number;
  title: string;
  location: string;
  action: string;
  emotion: string;
  camera: string;
  narration: string;
  dialogue: string;
  durationSec: number;
  lipsync: boolean;
  imagePrompt: string;
  videoPrompt: string;
  negativePrompt: string;
  references: ProducerReference[];
}

export interface ProducerPlan {
  mode: "audio" | "scenario-json" | "brief";
  summary: string;
  constraints: {
    format: string;
    visualStyle: string;
    dialogueRatio: string;
    safetyNote: string;
  };
  agents: ProducerAgentStatus[];
  scenes: ProducerScenePlan[];
  recommendations: string[];
}

type RawScenarioScene = {
  numero?: number;
  sceneNumber?: number;
  lieu?: string;
  location?: string;
  action?: string;
  emotion?: string;
  ambiance?: string;
  camera?: string;
  narration?: string;
  dialogue?: string;
  personnages?: string[];
  characters?: string[];
};

export const AGENT_BLUEPRINT: Array<Pick<ProducerAgentStatus, "id" | "name" | "role">> = [
  { id: "producer", name: "Agent Producteur", role: "Chef d'orchestre de la production" },
  { id: "writer", name: "Agent Scénariste", role: "Structure l'épisode et le drama" },
  { id: "dialogue", name: "Agent Dialoguiste", role: "Nettoie les dialogues pour le lipsync" },
  { id: "director", name: "Agent Réalisateur", role: "Décide la mise en scène et le rythme" },
  { id: "storyboard", name: "Agent Storyboard", role: "Découpe les plans scène par scène" },
  { id: "casting", name: "Agent Casting / Mémoire", role: "Rappelle les personnages, tenues et tribus" },
  { id: "environments", name: "Agent Décors / Lieux", role: "Maintient les décors cohérents" },
  { id: "props", name: "Agent Props / Accessoires", role: "Ajoute totems, foulards et objets utiles" },
  { id: "image-prompts", name: "Agent Prompt Master Image", role: "Construit les prompts image" },
  { id: "video-prompts", name: "Agent Prompt Master Vidéo", role: "Construit les prompts vidéo" },
  { id: "voice", name: "Agent Voix / Lipsync", role: "Prépare voix, sync labiale et timing" },
  { id: "editor", name: "Agent Monteur / Final Cut", role: "Assemble transitions, musique et sortie" },
  { id: "quality", name: "Agent Qualité / Cohérence", role: "Bloque les générations incohérentes" },
];

function extractDialogueSpeakers(dialogue: string): string[] {
  return [
    ...new Set(
      dialogue
        .split("\n")
        .map((line) => line.match(/^\s*([^:\n]{1,40})\s*:/)?.[1]?.trim())
        .filter((value): value is string => Boolean(value))
    ),
  ];
}

function buildNegativePrompt(): string {
  return [
    "no text",
    "no subtitles",
    "no logo",
    "no watermark",
    "no caption",
    "no typography",
    "no extra fingers",
    "no face distortion",
    "no outfit change",
    "no random characters",
  ].join(", ");
}

function inferProps(text: string): string[] {
  const lower = text.toLowerCase();
  const props: string[] = [];
  const dictionary = ["totem", "ballon", "corde", "foulard", "drapeau", "torche", "micro", "collier"];
  for (const item of dictionary) {
    if (lower.includes(item)) props.push(item);
  }
  return props;
}

function buildImagePrompt(scene: ProducerScenePlan): string {
  const referenceLine = scene.references
    .map((ref) => `${ref.type.toUpperCase()}: ${ref.name} — ${ref.description}`)
    .join(" | ");

  return [
    "Pixar 3D cinematic animated keyframe, vertical 9:16.",
    `Location: ${scene.location}.`,
    `Action: ${scene.action}.`,
    `Emotion: ${scene.emotion}.`,
    `Camera: ${scene.camera}.`,
    scene.lipsync
      ? `Dialogue on screen: ${scene.dialogue}. Keep active speaker readable, mouth ready for lipsync.`
      : `Narration / action driven scene: ${scene.narration || scene.action}.`,
    `References to use exactly: ${referenceLine || "no explicit references"}.`,
    "Maintain strict character resemblance, exact outfits, coherent props and no visible text in the image.",
  ].join(" ");
}

function buildVideoPrompt(scene: ProducerScenePlan): string {
  const speakers = extractDialogueSpeakers(scene.dialogue);
  const speechBlock = scene.lipsync
    ? `Visible speakers: ${speakers.join(", ") || "main speaker"}. Only the active speaker moves lips. Keep listeners' mouths mostly closed.`
    : "No visible dialogue performance required. Use eyes, body language and reactions under narration.";

  return [
    "Cinematic animated vertical 9:16 video scene.",
    `Main action: ${scene.action}.`,
    `Camera progression: ${scene.camera}.`,
    `Emotional tone: ${scene.emotion}.`,
    `Environment: ${scene.location}.`,
    speechBlock,
    scene.lipsync
      ? `Dialogue lines to stage: ${scene.dialogue}.`
      : `Narration to support: ${scene.narration || "none"}.`,
    "No visible text, no subtitles, no logo, keep exact character resemblance and same outfits across the whole clip.",
  ].join(" ");
}

function normalizeScene(raw: RawScenarioScene, index: number): ProducerScenePlan {
  const characters = raw.personnages || raw.characters || [];
  const location = raw.lieu || raw.location || "Zone inconnue";
  const action = raw.action || "Action à détailler";
  const dialogue = raw.dialogue || "";
  const narration = raw.narration || "";
  const emotion = raw.emotion || raw.ambiance || "Tension dramatique";
  const camera = raw.camera || (dialogue ? "medium close-up on active speaker, reaction cutaways" : "wide establishing shot then push-in");
  const props = inferProps(`${action} ${dialogue} ${narration}`);

  const references: ProducerReference[] = [
    ...characters.map((name) => ({
      type: "character" as const,
      name,
      description: "Visage, tenue, expression et silhouette exacts a fournir au moteur image",
    })),
    {
      type: "environment",
      name: location,
      description: "Décor principal de la scène à fournir en référence si disponible",
    },
    ...props.map((name) => ({
      type: "prop" as const,
      name,
      description: "Accessoire de cohérence à injecter dans le prompt et les références",
    })),
  ];

  if (dialogue.trim()) {
    references.push({
      type: "audio",
      name: "Voix de la scène",
      description: "Audio du locuteur à fournir pour un vrai lipsync / avatar vidéo",
    });
  }

  const plan: ProducerScenePlan = {
    sceneNumber: raw.numero || raw.sceneNumber || index + 1,
    title: `${location} — scène ${raw.numero || raw.sceneNumber || index + 1}`,
    location,
    action,
    emotion,
    camera,
    narration,
    dialogue,
    durationSec: dialogue.trim() ? 6 : 5,
    lipsync: Boolean(dialogue.trim()),
    imagePrompt: "",
    videoPrompt: "",
    negativePrompt: buildNegativePrompt(),
    references,
  };

  plan.imagePrompt = buildImagePrompt(plan);
  plan.videoPrompt = buildVideoPrompt(plan);
  return plan;
}

function buildAudioScenes(input: string): ProducerScenePlan[] {
  const chunks = input
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .slice(0, 6);

  return chunks.map((chunk, index) => {
    const dialogue = chunk.includes(":") ? chunk : "";
    const narration = dialogue ? "" : chunk;
    return normalizeScene(
      {
        numero: index + 1,
        lieu: `Beat audio ${index + 1}`,
        action: dialogue ? "Conversation guidée par l'audio analysé" : "Clip narratif construit à partir de l'audio",
        narration,
        dialogue,
        ambiance: dialogue ? "jeu d'acteur, plans de réaction, sync labiale" : "voix off cinématique",
      },
      index
    );
  });
}

function buildBriefScenes(input: string): ProducerScenePlan[] {
  const sentences = input
    .split(/[.!?]\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 5);

  return sentences.map((sentence, index) =>
    normalizeScene(
      {
        numero: index + 1,
        lieu: `Lieu ${index + 1}`,
        action: sentence,
        ambiance: "storyboard automatique depuis brief",
      },
      index
    )
  );
}

function parseScenarioJson(input: string): ProducerScenePlan[] {
  const parsed = JSON.parse(input) as { scenes?: RawScenarioScene[]; episode?: string };
  const scenes = parsed.scenes || [];
  return scenes.slice(0, 12).map((scene, index) => normalizeScene(scene, index));
}

function buildAgentStatuses(mode: ProducerPlan["mode"], scenes: ProducerScenePlan[]): ProducerAgentStatus[] {
  return AGENT_BLUEPRINT.map((agent, index) => {
    const hasDialogue = scenes.some((scene) => scene.lipsync);
    const hasProps = scenes.some((scene) => scene.references.some((ref) => ref.type === "prop"));
    const status: ProducerAgentStatus["status"] =
      agent.id === "voice" && hasDialogue ? "active"
      : agent.id === "props" && !hasProps ? "warning"
      : index < 6 ? "active"
      : "ready";

    const summary =
      agent.id === "quality"
        ? "Bloque les routes chères qui ne savent pas garder plusieurs personnages."
        : agent.id === "voice"
          ? hasDialogue
            ? "Dialogue détecté : préparation lipsync / voix à fournir."
            : "Pas de dialogue à synchroniser sur ce lot."
          : agent.id === "producer"
            ? `Mode ${mode} prêt avec ${scenes.length} scènes à orchestrer.`
            : agent.role;

    return {
      ...agent,
      status,
      summary,
    };
  });
}

export function buildProducerPlan(params: {
  mode: ProducerPlan["mode"];
  input: string;
}): ProducerPlan {
  const { mode, input } = params;
  let scenes: ProducerScenePlan[] = [];

  if (mode === "scenario-json") {
    scenes = parseScenarioJson(input);
  } else if (mode === "audio") {
    scenes = buildAudioScenes(input);
  } else {
    scenes = buildBriefScenes(input);
  }

  const recommendations = [
    "Toujours fournir une photo par personnage pour les scènes multi-personnages.",
    "Ajouter le décor et les accessoires critiques dans les références de scène.",
    "Fournir l'audio du locuteur pour les clips lipsync / avatar.",
    "Bloquer tout moteur image solo sur les scènes avec plusieurs candidats.",
  ];

  return {
    mode,
    summary: `Plan de production prêt : ${scenes.length} scènes, ${scenes.filter((scene) => scene.lipsync).length} scènes lipsync, style Pixar 3D 9:16.`,
    constraints: {
      format: "9:16",
      visualStyle: "Pixar 3D cinématique",
      dialogueRatio: "70% action / narration · 30% dialogue lipsync",
      safetyNote: "Toujours éviter le texte visible dans les images et vidéos.",
    },
    agents: buildAgentStatuses(mode, scenes),
    scenes,
    recommendations,
  };
}

export const PRODUCER_AGENTS: ProducerAgentStatus[] = AGENT_BLUEPRINT.map((agent) => ({
  ...agent,
  status: "ready",
  summary: agent.role,
}));

export function buildProducerExecutionPlan(params: {
  mode: "audio" | "scenario";
  input: string;
  seriesName?: string;
}): {
  summary: string;
  seriesName: string;
  pipelineSteps: Array<{ name: string; detail: string }>;
  guards: string[];
  agents: ProducerAgentStatus[];
  scenes: ProducerScenePlan[];
} {
  const normalizedMode: ProducerPlan["mode"] = params.mode === "scenario" ? "scenario-json" : "audio";
  const plan = buildProducerPlan({
    mode: normalizedMode,
    input: params.input || (params.mode === "audio" ? "Aucun audio fourni" : "Aucun scénario fourni"),
  });

  return {
    summary: plan.summary,
    seriesName: params.seriesName || "Konanta",
    pipelineSteps: plan.scenes.map((scene) => ({
      name: `Scène ${scene.sceneNumber}`,
      detail: `${scene.title} · ${scene.action}`,
    })),
    guards: plan.recommendations,
    agents: plan.agents,
    scenes: plan.scenes,
  };
}
