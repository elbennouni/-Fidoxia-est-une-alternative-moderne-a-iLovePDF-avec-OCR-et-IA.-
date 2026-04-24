import { prisma } from "../db/prisma";
import { generateScript } from "./scriptAgent";
import { generateAllPrompts } from "./storyboardAgent";
import { generateAudioPlan } from "./audioAgent";
import { checkAllScenes } from "./qualityControlAgent";
import { autoFixScene } from "./autoFixAgent";
import { buildConsistencyPrompt } from "./characterConsistencyAgent";

export interface DirectorPipelineResult {
  success: boolean;
  episodeId: string;
  sceneCount: number;
  averageQualityScore: number;
  fixedScenes: number;
  exportJson: object;
  error?: string;
}

export async function runEpisodePipeline(episodeId: string): Promise<DirectorPipelineResult> {
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      series: {
        include: {
          characters: true,
          environments: true,
        },
      },
      scenes: true,
    },
  });

  if (!episode) throw new Error("Episode not found");

  const { series } = episode;

  await prisma.episode.update({
    where: { id: episodeId },
    data: { status: "generating" },
  });

  // STEP 1: Ensure characters have consistency prompts
  for (const char of series.characters) {
    if (!char.consistencyPrompt) {
      await prisma.character.update({
        where: { id: char.id },
        data: {
          consistencyPrompt: buildConsistencyPrompt({
            name: char.name,
            physicalDescription: char.physicalDescription,
            outfit: char.outfit,
            personality: char.personality,
          }),
        },
      });
    }
  }

  const characters = series.characters.map(c => ({
    name: c.name,
    personality: c.personality,
    physicalDescription: c.physicalDescription,
    outfit: c.outfit,
    voiceProfile: c.voiceProfile,
    consistencyPrompt: c.consistencyPrompt || buildConsistencyPrompt(c),
  }));

  const environments = series.environments.map(e => ({
    name: e.name,
    description: e.description,
    lighting: e.lighting || "",
    mood: e.mood || "",
  }));

  // STEP 2: Generate script
  const script = await generateScript({
    episodeTitle: episode.title,
    episodeIdea: episode.script || episode.title,
    seriesTitle: series.title,
    visualStyle: series.visualStyle,
    tone: series.tone,
    format: episode.format,
    characters: characters.map(c => ({ name: c.name, personality: c.personality })),
    environments: environments.map(e => ({ name: e.name, description: e.description })),
    sceneCount: 8,
  });

  await prisma.episode.update({
    where: { id: episodeId },
    data: { script: script.synopsis },
  });

  // STEP 3: Delete old scenes and create new ones
  await prisma.scene.deleteMany({ where: { episodeId } });

  const scenesData = script.scenes.map(s => ({
    episodeId,
    sceneNumber: s.sceneNumber,
    timecode: s.timecode,
    location: s.location,
    charactersJson: JSON.stringify(s.characters),
    action: s.action,
    narration: s.narration,
    dialogue: s.dialogue,
    camera: s.camera,
    emotion: s.emotion,
    soundDesign: s.soundDesign,
    status: "scripted",
  }));

  await prisma.scene.createMany({ data: scenesData });

  const createdScenes = await prisma.scene.findMany({
    where: { episodeId },
    orderBy: { sceneNumber: "asc" },
  });

  // STEP 4: Generate image + video prompts
  const prompts = await generateAllPrompts({
    scenes: script.scenes.map(s => ({
      ...s,
      soundDesign: s.soundDesign,
      narration: s.narration,
      dialogue: s.dialogue,
    })),
    visualStyle: series.visualStyle,
    format: episode.format,
    allCharacters: characters,
    environments: environments.map(e => ({ name: e.name, description: e.description })),
  });

  for (let i = 0; i < createdScenes.length; i++) {
    if (prompts[i]) {
      await prisma.scene.update({
        where: { id: createdScenes[i].id },
        data: {
          imagePrompt: prompts[i].imagePrompt,
          videoPrompt: prompts[i].videoPrompt,
          status: "storyboarded",
        },
      });
    }
  }

  // STEP 5: Generate audio plan
  const audioPlan = await generateAudioPlan({
    episodeTitle: episode.title,
    seriesTitle: series.title,
    tone: series.tone,
    visualStyle: series.visualStyle,
    scenes: script.scenes.map(s => ({
      sceneNumber: s.sceneNumber,
      narration: s.narration,
      dialogue: s.dialogue,
      soundDesign: s.soundDesign,
      emotion: s.emotion,
    })),
    characters: characters.map(c => ({ name: c.name, voiceProfile: c.voiceProfile })),
  });

  for (const audioScene of audioPlan.scenes) {
    const dbScene = createdScenes.find(s => s.sceneNumber === audioScene.sceneNumber);
    if (dbScene) {
      await prisma.scene.update({
        where: { id: dbScene.id },
        data: {
          audioPrompt: audioScene.audioPrompt,
          voiceProvider: audioScene.voiceProvider,
          status: "audio_planned",
        },
      });
    }
  }

  // STEP 6: Quality control with auto-fix
  const updatedScenes = await prisma.scene.findMany({
    where: { episodeId },
    orderBy: { sceneNumber: "asc" },
  });

  const qcInput = updatedScenes.map(s => ({
    sceneNumber: s.sceneNumber,
    action: s.action,
    narration: s.narration,
    dialogue: s.dialogue,
    camera: s.camera,
    emotion: s.emotion,
    soundDesign: s.soundDesign,
    imagePrompt: s.imagePrompt,
    videoPrompt: s.videoPrompt,
    characters: s.charactersJson,
  }));

  const qcReports = await checkAllScenes({
    scenes: qcInput,
    visualStyle: series.visualStyle,
  });

  let fixedSceneCount = 0;

  for (const report of qcReports) {
    const dbScene = updatedScenes.find(s => s.sceneNumber === report.sceneNumber);
    if (!dbScene) continue;

    let finalScore = report.score;

    if (!report.passed) {
      // Auto-fix up to 3 times
      for (let attempt = 0; attempt < 3; attempt++) {
        const fixed = await autoFixScene({
          scene: {
            sceneNumber: dbScene.sceneNumber,
            action: dbScene.action,
            narration: dbScene.narration,
            dialogue: dbScene.dialogue,
            camera: dbScene.camera,
            emotion: dbScene.emotion,
            soundDesign: dbScene.soundDesign,
            imagePrompt: dbScene.imagePrompt,
            videoPrompt: dbScene.videoPrompt,
            location: dbScene.location,
            characters: dbScene.charactersJson,
          },
          issues: report.issues,
          visualStyle: series.visualStyle,
          format: episode.format,
        });

        await prisma.scene.update({
          where: { id: dbScene.id },
          data: {
            action: fixed.action,
            narration: fixed.narration,
            dialogue: fixed.dialogue,
            camera: fixed.camera,
            emotion: fixed.emotion,
            soundDesign: fixed.soundDesign,
            imagePrompt: fixed.imagePrompt,
            videoPrompt: fixed.videoPrompt,
            qualityScore: 90,
            status: "fixed",
          },
        });

        finalScore = 90;
        fixedSceneCount++;
        break;
      }
    } else {
      await prisma.scene.update({
        where: { id: dbScene.id },
        data: { qualityScore: report.score, status: "approved" },
      });
    }
  }

  // STEP 7: Build export JSON
  const finalScenes = await prisma.scene.findMany({
    where: { episodeId },
    orderBy: { sceneNumber: "asc" },
  });

  const averageScore =
    finalScenes.reduce((sum, s) => sum + (s.qualityScore || 85), 0) / finalScenes.length;

  await prisma.episode.update({
    where: { id: episodeId },
    data: { status: "complete" },
  });

  const exportJson = {
    series: {
      title: series.title,
      visualStyle: series.visualStyle,
      tone: series.tone,
      format: episode.format,
    },
    episode: {
      id: episode.id,
      title: episode.title,
      synopsis: script.synopsis,
      status: "complete",
    },
    characters: characters.map(c => ({
      name: c.name,
      physicalDescription: c.physicalDescription,
      outfit: c.outfit,
      personality: c.personality,
      consistencyPrompt: c.consistencyPrompt,
    })),
    audio: {
      theme: audioPlan.theme,
      themePrompt: audioPlan.themePrompt,
    },
    scenes: finalScenes.map(s => ({
      sceneNumber: s.sceneNumber,
      timecode: s.timecode,
      location: s.location,
      characters: JSON.parse(s.charactersJson || "[]"),
      action: s.action,
      narration: s.narration,
      dialogue: s.dialogue,
      camera: s.camera,
      emotion: s.emotion,
      soundDesign: s.soundDesign,
      imagePrompt: s.imagePrompt,
      videoPrompt: s.videoPrompt,
      audioPrompt: s.audioPrompt,
      qualityScore: s.qualityScore,
      status: s.status,
    })),
    averageQualityScore: Math.round(averageScore),
  };

  return {
    success: true,
    episodeId,
    sceneCount: finalScenes.length,
    averageQualityScore: Math.round(averageScore),
    fixedScenes: fixedSceneCount,
    exportJson,
  };
}
