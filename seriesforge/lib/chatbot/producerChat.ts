import { buildProducerPlan, type ProducerPlan } from "./producerMode";

export type ProducerChatScope = "series" | "episode" | "preview";
export type ProducerAttachmentType = "image" | "audio" | "scenario-json" | "note";

export interface ProducerAttachment {
  id: string;
  type: ProducerAttachmentType;
  name: string;
  url?: string;
  content?: string;
}

export interface ProducerCanvas {
  scope: ProducerChatScope;
  seriesName: string;
  episodeTitle?: string;
  approvalMode: "automatic" | "semi-auto";
  currentStep: string;
  summary: string;
  scenesPlanned: number;
  lipsyncScenes: number;
  knownCharacters: string[];
  knownEnvironments: string[];
  knownProps: string[];
  attachments: ProducerAttachment[];
  nextActions: string[];
}

export interface ProducerChatTurn {
  reply: string;
  plan: ProducerPlan;
  canvas: ProducerCanvas;
}

export interface ProducerMessage {
  role: "user" | "producer";
  text: string;
}

export interface ProducerChatResponse {
  reply: string;
  plan: ProducerPlan;
  canvas: ProducerCanvas;
  messages: ProducerMessage[];
}

function detectPlanMode(
  preferredMode: ProducerPlan["mode"],
  attachments: ProducerAttachment[],
  toolInput: string,
  message: string
): ProducerPlan["mode"] {
  const scenarioAttachment = attachments.find((attachment) => attachment.type === "scenario-json" && attachment.content?.trim());
  if (scenarioAttachment?.content?.trim()) return "scenario-json";
  if (preferredMode === "scenario-json" && toolInput.trim().startsWith("{")) return "scenario-json";
  if (attachments.some((attachment) => attachment.type === "audio")) return "audio";
  if (preferredMode === "audio" && toolInput.trim()) return "audio";
  if (/audio|transcript|voix off|podcast|interview|musique/i.test(message)) return "audio";
  return "brief";
}

function buildInputForPlan(params: {
  mode: ProducerPlan["mode"];
  toolInput: string;
  message: string;
  attachments: ProducerAttachment[];
}): string {
  const { mode, toolInput, message, attachments } = params;
  const scenarioAttachment = attachments.find((attachment) => attachment.type === "scenario-json" && attachment.content?.trim());
  if (mode === "scenario-json" && scenarioAttachment?.content?.trim()) return scenarioAttachment.content.trim();
  if (toolInput.trim()) return toolInput.trim();
  return message.trim();
}

function buildNextActions(params: {
  scope: ProducerChatScope;
  plan: ProducerPlan;
  approvalMode: "automatic" | "semi-auto";
  attachments: ProducerAttachment[];
}): string[] {
  const { scope, plan, approvalMode, attachments } = params;
  const actions: string[] = [];
  if (scope === "series") {
    actions.push("Je peux créer l'épisode à partir de cette base et préparer le brief de production.");
  } else if (scope === "episode") {
    actions.push("Je peux écrire le scénario détaillé, puis vous proposer la scène 1 pour validation.");
  } else {
    actions.push("Je peux continuer en mode démonstration sur la scène suivante.");
  }

  if (attachments.some((attachment) => attachment.type === "image")) {
    actions.push("Je réutiliserai les images envoyées comme références pour les personnages, décors ou accessoires.");
  }
  if (attachments.some((attachment) => attachment.type === "audio")) {
    actions.push("Je peux utiliser l'audio fourni pour découper des beats et préparer les scènes lipsync.");
  }

  if (plan.scenes.some((scene) => scene.lipsync)) {
    actions.push("Je vous proposerai les scènes lipsync avant génération vidéo pour valider la voix et le jeu.");
  }

  actions.push(
    approvalMode === "semi-auto"
      ? "Je m'arrête après chaque étape et je vous demande si vous validez."
      : "Je peux enchaîner automatiquement tant que vous me laissez continuer."
  );

  return actions;
}

function buildReply(params: {
  scope: ProducerChatScope;
  seriesName: string;
  episodeTitle?: string;
  plan: ProducerPlan;
  approvalMode: "automatic" | "semi-auto";
  attachments: ProducerAttachment[];
  message: string;
}): string {
  const { scope, seriesName, episodeTitle, plan, approvalMode, attachments, message } = params;
  const attachmentSummary = attachments.length > 0
    ? `J'ai bien reçu ${attachments.length} élément(s) de travail: ${attachments.map((attachment) => attachment.name).join(", ")}.`
    : "Je n'ai pas encore de référence jointe.";

  const intro = scope === "episode"
    ? `Je pilote maintenant l'épisode "${episodeTitle || "en cours"}" de ${seriesName}.`
    : scope === "series"
      ? `Je prépare le prochain épisode de la série ${seriesName}.`
      : `Je suis votre Producteur IA en mode preview pour ${seriesName}.`;

  const planSummary = `Je vous propose ${plan.scenes.length} scène(s), dont ${plan.scenes.filter((scene) => scene.lipsync).length} scène(s) lipsync.`;
  const question = scope === "episode"
    ? "Voulez-vous que je commence par verrouiller le scénario, ou que je prépare d'abord décors et accessoires ?"
    : "Êtes-vous d'accord pour que je crée l'épisode à partir de ce plan, puis que j'ouvre la production détaillée scène par scène ?";

  const modeLine = approvalMode === "semi-auto"
    ? "Je resterai en mode semi-automatique: je vous proposerai chaque étape avant exécution."
    : "Je peux avancer en automatique, mais je vous signalerai quand une validation critique est nécessaire.";

  const userIntent = message.trim()
    ? `Votre demande: ${message.trim().slice(0, 240)}.`
    : "";

  return [intro, userIntent, attachmentSummary, planSummary, modeLine, question]
    .filter(Boolean)
    .join("\n\n");
}

export function buildProducerChatTurn(params: {
  scope: ProducerChatScope;
  seriesName: string;
  episodeTitle?: string;
  preferredMode: ProducerPlan["mode"];
  approvalMode: "automatic" | "semi-auto";
  toolInput: string;
  message: string;
  attachments: ProducerAttachment[];
}): ProducerChatTurn {
  const mode = detectPlanMode(params.preferredMode, params.attachments, params.toolInput, params.message);
  const input = buildInputForPlan({
    mode,
    toolInput: params.toolInput,
    message: params.message,
    attachments: params.attachments,
  });
  const plan = buildProducerPlan({ mode, input });

  const knownCharacters = [
    ...new Set(
      plan.scenes.flatMap((scene) =>
        scene.references.filter((reference) => reference.type === "character").map((reference) => reference.name)
      )
    ),
  ];
  const knownEnvironments = [
    ...new Set(
      plan.scenes.flatMap((scene) =>
        scene.references.filter((reference) => reference.type === "environment").map((reference) => reference.name)
      )
    ),
  ];
  const knownProps = [
    ...new Set(
      plan.scenes.flatMap((scene) =>
        scene.references.filter((reference) => reference.type === "prop").map((reference) => reference.name)
      )
    ),
  ];

  const nextActions = buildNextActions({
    scope: params.scope,
    plan,
    approvalMode: params.approvalMode,
    attachments: params.attachments,
  });

  const canvas: ProducerCanvas = {
    scope: params.scope,
    seriesName: params.seriesName,
    episodeTitle: params.episodeTitle,
    approvalMode: params.approvalMode,
    currentStep: params.scope === "episode" ? "Pilotage de l'épisode courant" : "Préparation d'épisode",
    summary: plan.summary,
    scenesPlanned: plan.scenes.length,
    lipsyncScenes: plan.scenes.filter((scene) => scene.lipsync).length,
    knownCharacters,
    knownEnvironments,
    knownProps,
    attachments: params.attachments,
    nextActions,
  };

  return {
    reply: buildReply({
      scope: params.scope,
      seriesName: params.seriesName,
      episodeTitle: params.episodeTitle,
      plan,
      approvalMode: params.approvalMode,
      attachments: params.attachments,
      message: params.message,
    }),
    plan,
    canvas,
  };
}

export function buildProducerChatReply(params: {
  scope: ProducerChatScope;
  seriesName: string;
  episodeTitle?: string;
  preferredMode: ProducerPlan["mode"];
  approvalMode: "automatic" | "semi-auto";
  toolInput: string;
  message: string;
  attachments: ProducerAttachment[];
  messages?: ProducerMessage[];
}): ProducerChatResponse {
  const turn = buildProducerChatTurn({
    scope: params.scope,
    seriesName: params.seriesName,
    episodeTitle: params.episodeTitle,
    preferredMode: params.preferredMode,
    approvalMode: params.approvalMode,
    toolInput: params.toolInput,
    message: params.message,
    attachments: params.attachments,
  });

  const nextMessages: ProducerMessage[] = [...(params.messages || [])];
  if (params.message.trim()) {
    nextMessages.push({ role: "user", text: params.message.trim() });
  } else if (params.attachments.length > 0) {
    nextMessages.push({
      role: "user",
      text: `Pièces jointes envoyées: ${params.attachments.map((attachment) => attachment.name).join(", ")}`,
    });
  }
  nextMessages.push({ role: "producer", text: turn.reply });

  return {
    reply: turn.reply,
    plan: turn.plan,
    canvas: turn.canvas,
    messages: nextMessages,
  };
}
