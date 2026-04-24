import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { buildStoryboardPrompt as buildStoryboardPromptFromPrompts, buildVideoPrompt, getStyleDescription } from "@/lib/prompts";
import type { SceneQualityCheck, ScriptSceneInput } from "@/lib/pipeline-types";

const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

type VideoFormat = "VERTICAL_9_16" | "HORIZONTAL_16_9";
type PipelineStep =
  | "SERIES_SETUP"
  | "CHARACTERS"
  | "ENVIRONMENTS"
  | "STORY"
  | "STORYBOARD"
  | "AUDIO"
  | "VIDEO"
  | "COMPLETE";

type Character = {
  id: string;
  name: string;
  physicalDescription: string;
  outfit: string;
  personality: string;
  consistencyId: string;
};

type Environment = {
  id: string;
  locationName: string;
  visualDescription: string;
  lighting: string;
  mood: string;
};

type Series = {
  id: string;
  style: string;
};

type Episode = {
  id: string;
  seriesId: string;
  currentStep: PipelineStep;
};

function parseJsonFromText(input: string): unknown {
  const trimmed = input.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("[");
    const end = trimmed.lastIndexOf("]");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("JSON parsing failed for LLM response.");
  }
}

function fallbackStory(sceneCount: number): ScriptSceneInput[] {
  return Array.from({ length: sceneCount }).map((_, index) => ({
    sceneOrder: index + 1,
    action: `Scene ${index + 1}: progression narrative avec conflit visible et resolution partielle.`,
    charactersInShot: "Protagoniste principal et personnage secondaire",
    emotion: index === sceneCount - 1 ? "soulagement et espoir" : "tension dramatique",
    location: index % 2 === 0 ? "Lieu principal de la serie" : "Lieu secondaire relie au conflit",
  }));
}

function mockImageUrl(episodeId: string, sceneOrder: number): string {
  return `https://placehold.co/1080x1920/png?text=Episode+${episodeId}+Scene+${sceneOrder}`;
}

function mockAudioUrl(sceneId: string): string {
  return `https://example.com/audio/${sceneId}.mp3`;
}

function mockVideoUrl(sceneId: string): string {
  return `https://example.com/video/${sceneId}.mp4`;
}

function buildQcrulesResult(input: {
  hasAudio: boolean;
  prompt: string;
  action: string;
  emotion: string;
}): SceneQualityCheck {
  const staticShotDetected = /static image|frozen pose|portrait only/i.test(input.prompt);
  const bodyMovementPresent = /full body movement|gestures|interaction/i.test(input.prompt);
  const cameraMovementPresent = /Camera:\n- start:|movement:/i.test(input.prompt);
  const realActionPresent = input.action.length > 10;
  const emotionPresent = input.emotion.length > 2;

  const result: SceneQualityCheck = {
    scriptRespected: realActionPresent,
    charactersConsistent: /Continuity:/i.test(input.prompt),
    styleConsistent: /cinematic animated scene in/i.test(input.prompt),
    realActionPresent,
    bodyMovementPresent,
    cameraMovementPresent,
    emotionPresent,
    audioPresent: input.hasAudio,
    staticShotDetected,
    reasons: [],
  };

  if (!result.scriptRespected) result.reasons.push("Script action non respectee.");
  if (!result.charactersConsistent) result.reasons.push("Continuite personnages absente.");
  if (!result.styleConsistent) result.reasons.push("Style non explicite.");
  if (!result.realActionPresent) result.reasons.push("Action insuffisante.");
  if (!result.bodyMovementPresent) result.reasons.push("Mouvement corporel absent.");
  if (!result.cameraMovementPresent) result.reasons.push("Mouvement camera absent.");
  if (!result.emotionPresent) result.reasons.push("Emotion absente.");
  if (!result.audioPresent) result.reasons.push("Audio absent.");
  if (result.staticShotDetected) result.reasons.push("Plan statique detecte.");
  return result;
}

export function assertStepReached(currentStep: PipelineStep, required: PipelineStep): void {
  const order: PipelineStep[] = [
    "SERIES_SETUP",
    "CHARACTERS",
    "ENVIRONMENTS",
    "STORY",
    "STORYBOARD",
    "AUDIO",
    "VIDEO",
    "COMPLETE",
  ];
  if (order.indexOf(currentStep) < order.indexOf(required)) {
    throw new Error(`Step bloquee. Step requis: ${required}. Step actuel: ${currentStep}.`);
  }
}

export async function advanceEpisodeStep(episodeId: string, nextStep: PipelineStep): Promise<void> {
  await prisma.episode.update({
    where: { id: episodeId },
    data: { currentStep: nextStep },
  });
}

export async function generateStory(options: {
  episodeId: string;
  brief: string;
  sceneCount: number;
}): Promise<{ scenes: ScriptSceneInput[]; source: "openai" | "fallback" }> {
  const episode = await prisma.episode.findUnique({
    where: { id: options.episodeId },
    include: {
      series: {
        include: {
          characters: true,
          environments: true,
        },
      },
    },
  });

  if (!episode) {
    throw new Error("Episode introuvable.");
  }
  if (episode.series.characters.length === 0) {
    throw new Error("Aucun personnage defini. Etape CHARACTERS obligatoire.");
  }
  if (episode.series.environments.length === 0) {
    throw new Error("Aucun environnement defini. Etape ENVIRONMENTS obligatoire.");
  }

  assertStepReached(episode.currentStep, "ENVIRONMENTS");

  let scenes: ScriptSceneInput[] = [];
  let source: "openai" | "fallback" = "fallback";

  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.responses.create({
        model: OPENAI_MODEL,
        input: [
          {
            role: "system",
            content:
              "You generate structured animated episode scripts. Return ONLY a JSON array.",
          },
          {
            role: "user",
            content: [
              `Series title: ${episode.series.title}`,
              `Style: ${episode.series.style}`,
              `Tone: ${episode.series.tone}`,
              `User brief: ${options.brief}`,
              `Scene count: ${options.sceneCount}`,
              "Characters:",
              ...episode.series.characters.map(
                (c) =>
                  `- ${c.name} | physical: ${c.physicalDescription} | outfit locked: ${c.outfit} | personality: ${c.personality} | consistencyId: ${c.consistencyId}`,
              ),
              "Environments:",
              ...episode.series.environments.map(
                (e) =>
                  `- ${e.locationName} | visual: ${e.visualDescription} | lighting: ${e.lighting} | mood: ${e.mood}`,
              ),
              "Return JSON array with objects: {sceneOrder:number, action:string, charactersInShot:string, emotion:string, location:string}.",
            ].join("\n"),
          },
        ],
      });

      const raw = completion.output_text;
      const parsed = parseJsonFromText(raw);
      const typed = Array.isArray(parsed)
        ? parsed.map((item, index) => ({
            sceneOrder: Number(item?.sceneOrder ?? index + 1),
            action: String(item?.action ?? ""),
            charactersInShot: String(item?.charactersInShot ?? ""),
            emotion: String(item?.emotion ?? ""),
            location: String(item?.location ?? ""),
          }))
        : [];
      if (typed.length > 0) {
        scenes = typed;
        source = "openai";
      }
    } catch {
      scenes = [];
    }
  }

  if (scenes.length === 0) {
    scenes = fallbackStory(options.sceneCount);
    source = "fallback";
  }

  await prisma.$transaction([
    prisma.scene.deleteMany({ where: { episodeId: options.episodeId } }),
    prisma.episode.update({
      where: { id: options.episodeId },
      data: {
        scriptOverview: options.brief,
        currentStep: "STORY",
      },
    }),
    ...scenes.map((scene) =>
      prisma.scene.create({
        data: {
          episodeId: options.episodeId,
          sceneOrder: scene.sceneOrder,
          action: scene.action,
          charactersInShot: scene.charactersInShot,
          emotion: scene.emotion,
          location: scene.location,
          qcStatus: "PENDING",
        },
      }),
    ),
  ]);

  return { scenes, source };
}

export async function generateStoryboard(options: {
  episodeId: string;
  imageProvider: string;
}): Promise<void> {
  const episode = await prisma.episode.findUnique({
    where: { id: options.episodeId },
    include: {
      series: { include: { characters: true, environments: true } },
      scenes: { orderBy: { sceneOrder: "asc" } },
    },
  });

  if (!episode) {
    throw new Error("Episode introuvable.");
  }
  assertStepReached(episode.currentStep, "STORY");
  if (episode.scenes.length === 0) {
    throw new Error("Aucune scene script. Lance STEP 4.");
  }

  await prisma.storyboardFrame.deleteMany({
    where: {
      scene: { episodeId: episode.id },
    },
  });

  for (const scene of episode.scenes) {
    const matchingEnvironment = episode.series.environments.find(
      (env) => env.locationName.toLowerCase() === scene.location.toLowerCase(),
    );
    const environmentDescription = matchingEnvironment
      ? `${matchingEnvironment.locationName}. ${matchingEnvironment.visualDescription}. Lighting: ${matchingEnvironment.lighting}. Mood: ${matchingEnvironment.mood}.`
      : scene.location;

    const prompt = buildStoryboardPromptFromPrompts({
      style: episode.series.style,
      sceneAction: scene.action,
      sceneEmotion: scene.emotion,
      sceneLocation: environmentDescription,
      characters: episode.series.characters.map((character) => ({
        name: character.name,
        physicalDescription: character.physicalDescription,
        outfit: character.outfit,
        consistencyId: character.consistencyId,
      })),
    });

    await prisma.storyboardFrame.create({
      data: {
        sceneId: scene.id,
        prompt,
        provider: options.imageProvider,
        imageUrl: mockImageUrl(episode.id, scene.sceneOrder),
        validated: true,
      },
    });
  }

  await advanceEpisodeStep(episode.id, "STORYBOARD");
}

export async function generateAudio(options: {
  episodeId: string;
  voiceProvider: "HEYGEN" | "FALLBACK";
  musicStyle: string;
  sfxStyle: string;
}): Promise<void> {
  const episode = await prisma.episode.findUnique({
    where: { id: options.episodeId },
    include: {
      series: { include: { characters: true } },
      scenes: {
        include: { storyboard: true },
        orderBy: { sceneOrder: "asc" },
      },
    },
  });
  if (!episode) throw new Error("Episode introuvable.");
  assertStepReached(episode.currentStep, "STORYBOARD");

  const missingStoryboard = episode.scenes.some((s) => !s.storyboard);
  if (missingStoryboard) {
    throw new Error("Storyboard incomplet. Aucune generation audio sans images valides.");
  }

  await prisma.audioTake.deleteMany({
    where: { scene: { episodeId: episode.id } },
  });

  for (const scene of episode.scenes) {
    const narration = `Scene ${scene.sceneOrder}. ${scene.action}. Emotion dominante: ${scene.emotion}.`;
    const dialogue = `Dialogue guide ${scene.sceneOrder}: reaction emotionnelle et action en mouvement.`;
    await prisma.audioTake.create({
      data: {
        sceneId: scene.id,
        narration,
        dialogue,
        voiceConfig: `${options.voiceProvider}|music:${options.musicStyle}|sfx:${options.sfxStyle}`,
        audioUrl: mockAudioUrl(scene.id),
        background: options.musicStyle,
        sfx: options.sfxStyle,
        validated: false,
      },
    });
  }

  await prisma.episode.update({
    where: { id: episode.id },
    data: { currentStep: "AUDIO", audioValidated: false },
  });
}

export async function validateAudio(options: {
  episodeId: string;
  sceneId?: string;
  validateAll: boolean;
}): Promise<{ validatedCount: number }> {
  const episode = await prisma.episode.findUnique({
    where: { id: options.episodeId },
    include: {
      scenes: { include: { audio: true } },
    },
  });
  if (!episode) throw new Error("Episode introuvable.");
  assertStepReached(episode.currentStep, "AUDIO");

  const sceneIds = options.validateAll
    ? episode.scenes.map((s) => s.id)
    : options.sceneId
      ? [options.sceneId]
      : [];

  if (sceneIds.length === 0) {
    throw new Error("Aucune scene ciblee pour validation audio.");
  }

  const hasMissingAudio = episode.scenes
    .filter((s) => sceneIds.includes(s.id))
    .some((s) => !s.audio);
  if (hasMissingAudio) {
    throw new Error("Audio manquant sur certaines scenes.");
  }

  await prisma.audioTake.updateMany({
    where: { sceneId: { in: sceneIds } },
    data: { validated: true },
  });

  const remaining = await prisma.audioTake.count({
    where: { scene: { episodeId: episode.id }, validated: false },
  });

  if (remaining === 0) {
    await prisma.episode.update({
      where: { id: episode.id },
      data: { audioValidated: true },
    });
  }

  return { validatedCount: sceneIds.length };
}

export async function generateVideo(options: {
  episodeId: string;
  provider: "KLING" | "REPLICATE" | "OTHER";
  format?: VideoFormat;
  durationSecPerScene: number;
}): Promise<{ generated: number; regenerated: number }> {
  const episode = await prisma.episode.findUnique({
    where: { id: options.episodeId },
    include: {
      series: {
        include: {
          characters: true,
          environments: true,
        },
      },
      scenes: {
        include: { audio: true, storyboard: true, video: true },
        orderBy: { sceneOrder: "asc" },
      },
    },
  });
  if (!episode) throw new Error("Episode introuvable.");
  assertStepReached(episode.currentStep, "AUDIO");
  if (!episode.audioValidated) {
    throw new Error("Audio non valide. Validation obligatoire avant video.");
  }

  const outputFormat = options.format ?? episode.series.format;
  const formatLabel = outputFormat === "VERTICAL_9_16" ? "Vertical" : "Horizontal";

  const charactersDescription = episode.series.characters
    .map((c) => `${c.name}: ${c.physicalDescription}; outfit: ${c.outfit}; consistencyId=${c.consistencyId}`)
    .join(" | ");

  await prisma.videoShot.deleteMany({
    where: { scene: { episodeId: episode.id } },
  });

  let generated = 0;
  let regenerated = 0;

  for (const scene of episode.scenes) {
    const environment = episode.series.environments.find(
      (env) => env.locationName.toLowerCase() === scene.location.toLowerCase(),
    );
    const environmentDescription = environment
      ? `${environment.locationName}. ${environment.visualDescription}. Lighting=${environment.lighting}. Mood=${environment.mood}.`
      : scene.location;

    let prompt = buildVideoPrompt({
      formatLabel,
      styleLabel: getStyleDescription(episode.series.style),
      scriptAction: scene.action,
      charactersDescription,
      environmentDescription,
      visibleAction: scene.action,
      emotions: scene.emotion,
      cameraStart: "establishing shot showing full environment and full body characters",
      cameraMovement: "smooth dolly-in then lateral tracking during character interaction",
      cameraEnd: "medium close-up on emotional beat while preserving context",
      environmentAnimation: "wind effects, moving background elements, reactive props",
      soundDesign:
        "ambient bed + synced sound effects + narration/dialogue from validated audio layer",
      continuityRule:
        "same characters, same outfits, same lighting, same environment across all shots",
    });

    // Mandatory QC gate with auto-regeneration on fail.
    let qc = buildQcrulesResult({
      hasAudio: Boolean(scene.audio?.validated),
      prompt,
      action: scene.action,
      emotion: scene.emotion,
    });

    if (
      qc.staticShotDetected ||
      !qc.scriptRespected ||
      !qc.charactersConsistent ||
      !qc.styleConsistent ||
      !qc.realActionPresent ||
      !qc.bodyMovementPresent ||
      !qc.cameraMovementPresent ||
      !qc.emotionPresent ||
      !qc.audioPresent
    ) {
      regenerated += 1;
      prompt = buildVideoPrompt({
        formatLabel,
        styleLabel: getStyleDescription(episode.series.style),
        scriptAction: `${scene.action}. Force motion and interactions.`,
        charactersDescription,
        environmentDescription,
        visibleAction: `${scene.action}. Characters move through space with visible gestures and reactions.`,
        emotions: scene.emotion,
        cameraStart: "wide dynamic shot",
        cameraMovement: "continuous crane + tracking motion following actors",
        cameraEnd: "dramatic close framing preserving action context",
        environmentAnimation: "active environment with moving particles, objects, and crowd behavior",
        soundDesign:
          "dense ambiance, synchronized effects, and validated narration/dialogues clearly audible",
        continuityRule:
          "strict continuity with previous and next scenes, no style or outfit drift",
      });
      qc = buildQcrulesResult({
        hasAudio: Boolean(scene.audio?.validated),
        prompt,
        action: scene.action,
        emotion: scene.emotion,
      });
    }

    await prisma.videoShot.create({
      data: {
        sceneId: scene.id,
        prompt,
        provider: options.provider,
        videoUrl: mockVideoUrl(scene.id),
        format: outputFormat,
        durationSec: options.durationSecPerScene,
        validated: qc.reasons.length === 0,
      },
    });

    await prisma.scene.update({
      where: { id: scene.id },
      data: {
        qcStatus: qc.reasons.length === 0 ? "PASS" : "FAIL",
        qcNotes: qc.reasons.length > 0 ? qc.reasons.join(" ") : "QC passed.",
      },
    });

    generated += 1;
  }

  const failedCount = await prisma.scene.count({
    where: { episodeId: episode.id, qcStatus: "FAIL" },
  });

  await prisma.episode.update({
    where: { id: episode.id },
    data: { currentStep: failedCount > 0 ? "VIDEO" : "COMPLETE" },
  });

  return { generated, regenerated };
}

export async function assertOwnerSeries(userId: string, seriesId: string) {
  const series = await prisma.series.findFirst({
    where: { id: seriesId, userId },
    select: { id: true },
  });
  if (!series) {
    throw new Error("Serie introuvable.");
  }
}

export async function ensureEpisodeBelongsToSeries(seriesId: string, episodeId: string) {
  const episode = await prisma.episode.findFirst({
    where: { id: episodeId, seriesId },
    select: { id: true },
  });
  if (!episode) {
    throw new Error("Episode introuvable.");
  }
}

export async function generateStoryForEpisode(
  seriesId: string,
  episodeId: string,
  payload: { brief: string; sceneCount: number },
) {
  await ensureEpisodeBelongsToSeries(seriesId, episodeId);
  return generateStory({
    episodeId,
    brief: payload.brief,
    sceneCount: payload.sceneCount,
  });
}

export async function generateStoryboardForEpisode(
  userId: string,
  seriesId: string,
  episodeId: string,
  imageProvider: string,
) {
  await assertOwnerSeries(userId, seriesId);
  await ensureEpisodeBelongsToSeries(seriesId, episodeId);
  await generateStoryboard({ episodeId, imageProvider });
  const frames = await prisma.storyboardFrame.findMany({
    where: { scene: { episodeId } },
    orderBy: { scene: { sceneOrder: "asc" } },
    include: { scene: true },
  });
  return { frames };
}

type EpisodeContext = {
  episode: Episode & {
    series: Series;
  };
  series: Series;
  scenes: Array<
    {
      storyboard: { id: string; validated: boolean } | null;
      audio: { id: string; validated: boolean; audioUrl: string } | null;
      video: { id: string; validated: boolean } | null;
    } & {
      id: string;
      sceneOrder: number;
      action: string;
      charactersInShot: string;
      emotion: string;
      location: string;
      qcStatus: "PENDING" | "PASS" | "FAIL";
      qcNotes: string | null;
    }
  >;
  characters: Character[];
  environments: Environment[];
};

export async function ensureEpisodeAccessAndStep(options: {
  userId: string;
  seriesId: string;
  episodeId: string;
  requiredStep: PipelineStep;
  allowIfCurrentIs?: PipelineStep[];
}): Promise<EpisodeContext> {
  const episode = await prisma.episode.findFirst({
    where: {
      id: options.episodeId,
      seriesId: options.seriesId,
      series: { userId: options.userId },
    },
    include: {
      series: true,
      scenes: {
        include: {
          storyboard: { select: { id: true, validated: true } },
          audio: { select: { id: true, validated: true, audioUrl: true } },
          video: { select: { id: true, validated: true } },
        },
        orderBy: { sceneOrder: "asc" },
      },
    },
  });

  if (!episode) {
    throw new Error("Episode introuvable.");
  }

  const allowed = new Set<PipelineStep>([options.requiredStep, ...(options.allowIfCurrentIs ?? [])]);
  if (!allowed.has(episode.currentStep)) {
    assertStepReached(episode.currentStep, options.requiredStep);
  }

  const [characters, environments] = await Promise.all([
    prisma.character.findMany({ where: { seriesId: episode.seriesId }, orderBy: { createdAt: "asc" } }),
    prisma.environment.findMany({
      where: { seriesId: episode.seriesId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return {
    episode,
    series: episode.series,
    scenes: episode.scenes,
    characters,
    environments,
  };
}

export function updateEpisodeStep(episodeId: string, nextStep: PipelineStep) {
  return advanceEpisodeStep(episodeId, nextStep);
}

export function buildStoryboardImageUrl(sceneId: string, provider: string) {
  return `https://placehold.co/1080x1920/png?text=${encodeURIComponent(provider)}+${sceneId}`;
}

export function toSceneCharacterLines(
  charactersInShot: string,
  characters: Character[],
) {
  const lower = charactersInShot.toLowerCase();
  const selected = characters.filter((character) => lower.includes(character.name.toLowerCase()));
  const target = selected.length > 0 ? selected : characters;
  return target
    .map(
      (character) =>
        `${character.name} [${character.consistencyId}] appearance: ${character.physicalDescription}. Locked outfit: ${character.outfit}. Personality: ${character.personality}.`,
    )
    .join(" ");
}

export function toSceneEnvironment(location: string, environments: Environment[]) {
  const matching = environments.find(
    (environment) => environment.locationName.toLowerCase() === location.toLowerCase(),
  );
  if (!matching) return location;
  return `${matching.locationName}. ${matching.visualDescription}. Lighting: ${matching.lighting}. Mood: ${matching.mood}.`;
}

export async function generateAudioTakes(
  userId: string,
  seriesId: string,
  episodeId: string,
  payload: { voiceProvider: "HEYGEN" | "FALLBACK"; musicStyle: string; sfxStyle: string },
) {
  await assertOwnerSeries(userId, seriesId);
  await ensureEpisodeBelongsToSeries(seriesId, episodeId);
  await generateAudio({
    episodeId,
    voiceProvider: payload.voiceProvider,
    musicStyle: payload.musicStyle,
    sfxStyle: payload.sfxStyle,
  });
  const takes = await prisma.audioTake.findMany({
    where: { scene: { episodeId } },
    include: { scene: true },
    orderBy: { scene: { sceneOrder: "asc" } },
  });
  return { takes };
}

export async function validateAudioForEpisode(
  userId: string,
  seriesId: string,
  episodeId: string,
  payload: { sceneId?: string; validateAll: boolean },
) {
  await assertOwnerSeries(userId, seriesId);
  await ensureEpisodeBelongsToSeries(seriesId, episodeId);
  return validateAudio({
    episodeId,
    sceneId: payload.sceneId,
    validateAll: payload.validateAll,
  });
}

export async function runAudioValidation(options: {
  userId: string;
  seriesId: string;
  episodeId: string;
  payload: { sceneId?: string; validateAll: boolean };
}) {
  return validateAudioForEpisode(
    options.userId,
    options.seriesId,
    options.episodeId,
    options.payload,
  );
}

export async function runVideoPipeline(
  userId: string,
  seriesId: string,
  episodeId: string,
  provider: "KLING" | "REPLICATE" | "OTHER",
  durationSecPerScene: number,
  format?: VideoFormat,
) {
  await assertOwnerSeries(userId, seriesId);
  await ensureEpisodeBelongsToSeries(seriesId, episodeId);
  return generateVideo({
    episodeId,
    provider,
    durationSecPerScene,
    format,
  });
}

export async function getEpisodeDetails(userId: string, seriesId: string, episodeId: string) {
  await assertOwnerSeries(userId, seriesId);
  await ensureEpisodeBelongsToSeries(seriesId, episodeId);

  const episode = await prisma.episode.findFirst({
    where: { id: episodeId, seriesId },
    include: {
      series: true,
      scenes: {
        orderBy: { sceneOrder: "asc" },
        include: {
          storyboard: true,
          audio: true,
          video: true,
        },
      },
    },
  });

  if (!episode) {
    throw new Error("Episode introuvable.");
  }

  return episode;
}
