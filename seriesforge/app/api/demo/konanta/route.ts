import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import { runEpisodePipeline } from "@/lib/agents/directorAgent";
import { buildConsistencyPrompt } from "@/lib/agents/characterConsistencyAgent";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Create series
    const series = await prisma.series.create({
      data: {
        userId: user.id,
        title: "Les Marseillais à Konanta",
        description: "Une série de téléréalité animée où des candidats marseillais survivent sur une île tropicale avec des défis épiques.",
        visualStyle: "Pixar 3D cinematic reality TV",
        tone: "funny, dramatic, competitive, reality TV",
        defaultFormat: "9:16",
      },
    });

    // Create characters
    const charactersData = [
      {
        name: "Hassan",
        physicalDescription: "Athletic young man, 28 years old, Mediterranean features, short dark hair, tanned skin",
        outfit: "Beach survivor outfit: torn shorts, tribal necklace, no shirt showing athletic build",
        personality: "Funny, determined survivor, athletic, always joking but secretly very competitive",
        voiceProfile: "Male, energetic, Marseille accent, loud and enthusiastic",
      },
      {
        name: "Sarah",
        physicalDescription: "Athletic woman, 25 years old, curly brown hair, strong muscular build",
        outfit: "Sporty bikini top, camo shorts, athletic sneakers, headband",
        personality: "Strong, competitive, takes no nonsense, natural leader who intimidates others",
        voiceProfile: "Female, assertive, Marseille accent, confident and direct",
      },
      {
        name: "Roger",
        physicalDescription: "Older man, 55 years old, bald with grey beard, stocky build, red face from sun",
        outfit: "Tourist shirt with flowers, safari shorts, sandals with socks",
        personality: "Grumpy older candidate who complains about everything but surprisingly competitive",
        voiceProfile: "Male, grumpy, thick Southern French accent, always complaining",
      },
      {
        name: "Karim",
        physicalDescription: "Slim young man, 24 years old, stylish dark hair, always looks fashionable even on island",
        outfit: "Designer swim shorts, sunglasses always on head, luxury sandals",
        personality: "Strategic, mocking, always calculating his next move, fashionable and vain",
        voiceProfile: "Male, smooth, sarcastic Marseille accent, speaks slowly for effect",
      },
      {
        name: "Abel",
        physicalDescription: "Charismatic TV host, 35 years old, perfect white teeth, immaculate appearance despite island setting",
        outfit: "Crisp white shirt, chino shorts, microphone always in hand, perfect hair",
        personality: "Energetic TV presenter, overly enthusiastic, drama lover, always hyping the competition",
        voiceProfile: "Male, TV presenter voice, exaggerated enthusiasm, perfect diction",
      },
    ];

    for (const charData of charactersData) {
      await prisma.character.create({
        data: {
          ...charData,
          seriesId: series.id,
          consistencyPrompt: buildConsistencyPrompt(charData),
        },
      });
    }

    // Create environments
    const environmentsData = [
      {
        name: "Konanta Beach",
        description: "A stunning tropical beach with crystal clear turquoise water, white sand, palm trees swaying in breeze",
        lighting: "Bright tropical sun, golden hour light, dramatic shadows",
        mood: "Competitive, tropical paradise, survival drama",
      },
      {
        name: "Rope Challenge Arena",
        description: "A water-based rope challenge course over the ocean, with floating platforms, ropes, and obstacles",
        lighting: "Midday sun blazing, reflections on water, intense heat haze",
        mood: "Intense competition, physical challenge, high stakes",
      },
      {
        name: "Balloon Race Zone",
        description: "Open beach area with colorful balloons, starting line with flags, crowd area for spectators",
        lighting: "Afternoon golden light, festive atmosphere, bright colors",
        mood: "Fun, chaotic, unexpected twists, comedic",
      },
    ];

    for (const envData of environmentsData) {
      await prisma.environment.create({
        data: { ...envData, seriesId: series.id, reusable: true },
      });
    }

    // Create episode
    const episode = await prisma.episode.create({
      data: {
        seriesId: series.id,
        title: "Le Défi de la Corde et la Course aux Ballons",
        format: "9:16",
        status: "draft",
        script: "Hassan, Sarah, Roger, Karim and host Abel compete in two epic beach challenges: first a treacherous rope course over the ocean, then a chaotic balloon race on the beach. Alliances form, betrayals happen, Roger falls in the water multiple times, Karim loses his sunglasses, and Sarah dominates while Hassan tries to make everyone laugh. Abel hypes everything to the max.",
      },
    });

    // Run the full AI pipeline
    const result = await runEpisodePipeline(episode.id);

    return NextResponse.json({
      message: "Konanta Demo generated successfully!",
      seriesId: series.id,
      episodeId: episode.id,
      success: result.success,
      sceneCount: result.sceneCount,
      averageQualityScore: result.averageQualityScore,
      fixedScenes: result.fixedScenes,
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Demo generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
