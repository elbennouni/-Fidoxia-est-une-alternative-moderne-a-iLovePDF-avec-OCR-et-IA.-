import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import { runEpisodePipeline } from "@/lib/agents/directorAgent";
import { buildConsistencyPrompt } from "@/lib/agents/characterConsistencyAgent";

const KONANTA_TITLE = "Les Marseillais à Konanta";
const KONANTA_CONFIGURED_TITLE = "Les Marseillais à Konanta (Préconfiguré)";

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

const configuredScenes = [
  {
    sceneNumber: 1,
    timecode: "00:00-00:12",
    location: "Konanta Beach",
    charactersJson: JSON.stringify(["Abel", "Hassan", "Sarah", "Roger", "Karim"]),
    action: "Abel introduces the challenge while candidates arrive on the beach and react dramatically.",
    narration: "On Konanta, every second counts and every alliance can explode at any moment.",
    dialogue: "Abel: Bienvenue sur Konanta ! Aujourd'hui, double défi sur la plage !",
    camera: "Wide cinematic drone push-in followed by energetic handheld close-ups.",
    emotion: "Excitement and tension",
    soundDesign: "Ocean ambience, crowd shouts, energetic reality-TV intro stinger.",
    status: "draft",
  },
  {
    sceneNumber: 2,
    timecode: "00:12-00:28",
    location: "Rope Challenge Arena",
    charactersJson: JSON.stringify(["Hassan", "Sarah", "Roger"]),
    action: "Hassan jumps first on the rope course, Sarah follows aggressively, Roger hesitates.",
    narration: "The rope challenge starts at full speed while fear appears instantly.",
    dialogue: "Hassan: Let's go ! Sarah: Personne ne me bat aujourd'hui ! Roger: C'est trop glissant ce truc...",
    camera: "Fast lateral tracking with splash-level inserts and whip pans.",
    emotion: "Competitive pressure",
    soundDesign: "Water splashes, rope tension creaks, rhythmic percussions.",
    status: "draft",
  },
  {
    sceneNumber: 3,
    timecode: "00:28-00:42",
    location: "Rope Challenge Arena",
    charactersJson: JSON.stringify(["Roger", "Karim"]),
    action: "Roger slips and falls into the water while Karim mocks him from a platform.",
    narration: "One mistake turns into instant humiliation under the cameras.",
    dialogue: "Karim: Même mes lunettes tiennent mieux que toi ! Roger: J'vais te montrer moi !",
    camera: "Slow-motion fall replay then punch-in on Karim's grin.",
    emotion: "Comedic frustration",
    soundDesign: "Comic boing accent, splash reverb, contestant laughter.",
    status: "draft",
  },
  {
    sceneNumber: 4,
    timecode: "00:42-00:58",
    location: "Konanta Beach",
    charactersJson: JSON.stringify(["Sarah", "Hassan", "Abel"]),
    action: "Sarah wins the rope section; Hassan congratulates her while Abel hypes the next challenge.",
    narration: "Sarah dominates physically, forcing everyone to reassess alliances.",
    dialogue: "Abel: Sarah écrase la concurrence ! Hassan: Respect, t'es une machine.",
    camera: "Hero close-up on Sarah with quick reaction cuts.",
    emotion: "Triumph",
    soundDesign: "Victory sting, heavy breaths, beach wind.",
    status: "draft",
  },
  {
    sceneNumber: 5,
    timecode: "00:58-01:14",
    location: "Balloon Race Zone",
    charactersJson: JSON.stringify(["Hassan", "Karim", "Roger"]),
    action: "The balloon race begins; Hassan laughs while Karim loses control of his lane.",
    narration: "The second challenge replaces strength with chaos and speed.",
    dialogue: "Abel: Top départ ! Hassan: C'est n'importe quoi ce jeu ! Karim: Mes lunettes, mes lunettes !",
    camera: "Dynamic steadicam run beside contestants, frequent jump cuts.",
    emotion: "Chaos and fun",
    soundDesign: "Crowd chants, balloon pops, comedic whooshes.",
    status: "draft",
  },
  {
    sceneNumber: 6,
    timecode: "01:14-01:28",
    location: "Balloon Race Zone",
    charactersJson: JSON.stringify(["Sarah", "Karim"]),
    action: "Karim tries a strategic shortcut; Sarah intercepts and outpaces him.",
    narration: "Strategy fails when execution collapses under pressure.",
    dialogue: "Karim: Je prends le côté court. Sarah: Pas aujourd'hui.",
    camera: "Overhead map-like view then low-angle sprint close-ups.",
    emotion: "Rivalry",
    soundDesign: "Heartbeat bass, short risers, breathing layers.",
    status: "draft",
  },
  {
    sceneNumber: 7,
    timecode: "01:28-01:44",
    location: "Konanta Beach",
    charactersJson: JSON.stringify(["Abel", "Roger", "Hassan"]),
    action: "Roger protests the rules while Hassan tries to calm him and Abel escalates drama for TV.",
    narration: "Fatigue and ego spark open conflict before the final reveal.",
    dialogue: "Roger: C'est truqué ! Hassan: Respire un coup. Abel: Le public veut du spectacle !",
    camera: "Tight handheld argument coverage with rapid reaction inserts.",
    emotion: "Conflict",
    soundDesign: "Tension pad, overlapping voices, wind gust accents.",
    status: "draft",
  },
  {
    sceneNumber: 8,
    timecode: "01:44-02:00",
    location: "Konanta Beach",
    charactersJson: JSON.stringify(["Abel", "Sarah", "Hassan", "Roger", "Karim"]),
    action: "Abel announces results: Sarah wins, Hassan second, Roger and Karim vow revenge.",
    narration: "The episode ends with a winner crowned and new conflicts ready for next round.",
    dialogue: "Abel: Sarah remporte l'épisode ! Karim: La revanche arrive. Roger: J'abandonne jamais.",
    camera: "Sunset wide shot with dramatic push on the podium and final freeze frame.",
    emotion: "Closure and anticipation",
    soundDesign: "Final theme swell, applause, ocean ambience fade-out.",
    status: "draft",
  },
];

type DemoMode = "pipeline" | "configured";

async function createKonantaBase(userId: string, title: string) {
  return prisma.series.create({
    data: {
      userId,
      title,
      description: "Une série de téléréalité animée où des candidats marseillais survivent sur une île tropicale avec des défis épiques.",
      visualStyle: "Pixar 3D cinematic reality TV",
      tone: "funny, dramatic, competitive, reality TV",
      defaultFormat: "9:16",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const mode: DemoMode = payload?.mode === "configured" ? "configured" : "pipeline";

    if (mode === "configured") {
      await prisma.series.deleteMany({
        where: {
          userId: user.id,
          title: { in: [KONANTA_TITLE, KONANTA_CONFIGURED_TITLE] },
        },
      });
    }

    const series = await createKonantaBase(
      user.id,
      mode === "configured" ? KONANTA_CONFIGURED_TITLE : KONANTA_TITLE,
    );

    for (const charData of charactersData) {
      await prisma.character.create({
        data: {
          ...charData,
          seriesId: series.id,
          consistencyPrompt: buildConsistencyPrompt(charData),
        },
      });
    }

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

    if (mode === "configured") {
      await prisma.scene.createMany({
        data: configuredScenes.map((scene) => ({
          ...scene,
          episodeId: episode.id,
        })),
      });

      return NextResponse.json({
        message: "Konanta preconfigured demo restored!",
        seriesId: series.id,
        episodeId: episode.id,
        success: true,
        sceneCount: configuredScenes.length,
        averageQualityScore: null,
        fixedScenes: 0,
      });
    }

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
