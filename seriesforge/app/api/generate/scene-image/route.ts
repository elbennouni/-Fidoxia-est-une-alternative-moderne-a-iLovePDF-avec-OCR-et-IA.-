import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateSceneWithNanoBanana } from "@/lib/imageWorkflows/nanoBanana";
import { persistSceneImageResult } from "@/lib/storage/sceneImages";
import { getCharacterGroupAssets, matchGroupAssetsForScene } from "@/lib/groups/characterGroups";
import {
  buildSceneReferencePromptBlock,
  getSceneReferenceAssets,
} from "@/lib/scenes/sceneReferenceAssets";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { sceneId } = await req.json();

    const scene = await prisma.scene.findFirst({
      where: { id: sceneId, episode: { series: { userId: user.id } } },
      include: {
        episode: {
          include: {
            series: {
              include: {
                characters: true,
                environments: true,
                assets: true,
              },
            },
          },
        },
      },
    });

    if (!scene) return NextResponse.json({ error: "Scene not found" }, { status: 404 });

    const { series } = scene.episode;
    const format = scene.episode.format;
    const groupAssets = getCharacterGroupAssets(series.assets || []);

    // Get characters present in this scene
    const sceneCharNames: string[] = JSON.parse(scene.charactersJson || "[]");
    const presentChars = series.characters.filter((c: typeof series.characters[number]) =>
      sceneCharNames.some((n: string) => n.toLowerCase().includes(c.name.toLowerCase()))
    );
    const charsWithPhoto = presentChars.filter((c: typeof presentChars[number]) => c.referenceImageUrl);
    const matchedGroups = matchGroupAssetsForScene({
      groups: groupAssets,
      sceneCharacters: sceneCharNames,
      sceneText: [scene.location, scene.action, scene.narration, scene.dialogue].filter(Boolean).join(" "),
    });
    const manualSceneReferences = getSceneReferenceAssets(series.assets, scene.id)
      .filter((reference) => Boolean(reference.url))
      .slice(0, 4);

    if (presentChars.length > 1) {
      const multiCharacterResult = await generateSceneWithNanoBanana({
        userId: user.id,
        sceneId,
        model: "nano-banana-pro",
        autoRouted: true,
      });
      return NextResponse.json({
        ...multiCharacterResult,
        autoRoutedToNanoBanana: true,
      });
    }

    // Get environment matching the scene location
    const matchedEnv = series.environments.find((e: typeof series.environments[number]) =>
      scene.location?.toLowerCase().includes(e.name.toLowerCase())
    ) || series.environments[0];

    // Build rich character block with consistency locks + voices
    const charBlock = presentChars.length > 0
      ? presentChars.map((c: typeof presentChars[number]) =>
          `CHARACTER "${c.name}": ${c.physicalDescription}. Outfit: ${c.outfit}. CONSISTENCY LOCK: ${c.consistencyPrompt}${c.voiceProfile ? ` Voice: ${c.voiceProfile}` : ""}.`
        ).join("\n")
      : sceneCharNames.join(", ");
    const groupBlock = matchedGroups.length > 0
      ? `GROUP REFERENCES:\n${matchedGroups.map((group) => `${group.name} (${group.metadata.category}) — members: ${group.metadata.members.join(", ")}`).join("\n")}`
      : "";
    const manualReferenceBlock = buildSceneReferencePromptBlock(manualSceneReferences);

    // Build environment block
    const envBlock = matchedEnv
      ? `LOCATION "${matchedEnv.name}": ${matchedEnv.description}${matchedEnv.lighting ? `. Lighting: ${matchedEnv.lighting}` : ""}${matchedEnv.mood ? `. Mood: ${matchedEnv.mood}` : ""}.`
      : scene.location || "outdoor scene";

    // Use existing image prompt if available, enhanced with character/env data
    const basePrompt = scene.imagePrompt || `${series.visualStyle} cinematic keyframe of ${scene.action}`;

    const richPrompt = `${series.visualStyle} cinematic keyframe, ${format} format.

${charBlock}

${groupBlock}

${manualReferenceBlock}

${envBlock}

Scene action: ${scene.action || "dramatic moment"}.
Emotion/atmosphere: ${scene.emotion || "neutral"}.
Camera: ${scene.camera || "medium shot"}.

Additional context: ${basePrompt.slice(0, 500)}

Requirements: Maintain exact character visual identity as described. Same outfit, same physical appearance. No changes to character design. High quality ${series.visualStyle} animation style. Cinematic lighting and composition.`;

    const epFormat = format === "16:9" ? "16:9" : "9:16"; // default 9:16
    const size = epFormat === "9:16" ? "1024x1792" : "1792x1024";

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: richPrompt.slice(0, 4000),
      n: 1,
      size: size as "1024x1024" | "1024x1792" | "1792x1024",
      quality: "standard",
    });

    const imageUrl = (response.data ?? [])[0]?.url;
    if (!imageUrl) throw new Error("No image generated");
    const durableImageUrl = await persistSceneImageResult({
      sceneId,
      generatorName: "DALL-E 3",
      imageUrl,
    });

    return NextResponse.json({
      imageUrl: durableImageUrl,
      sceneId,
      charactersUsed: presentChars.map((c: typeof presentChars[number]) => c.name),
      charactersWithPhoto: charsWithPhoto.map((c: typeof charsWithPhoto[number]) => c.name),
      groupReferencesUsed: matchedGroups.map((group) => group.name),
      environmentUsed: matchedEnv?.name || null,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
