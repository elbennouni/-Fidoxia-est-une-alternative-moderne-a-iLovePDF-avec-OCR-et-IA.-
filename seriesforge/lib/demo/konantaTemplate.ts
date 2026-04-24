import { prisma } from "@/lib/db/prisma";
import { buildConsistencyPrompt } from "@/lib/agents/characterConsistencyAgent";

const KONANTA_SERIES = {
  title: "Les Marseillais à Konanta",
  description:
    "Une série de téléréalité animée où des candidats marseillais survivent sur une île tropicale avec des défis épiques.",
  visualStyle: "Pixar 3D cinematic reality TV",
  tone: "funny, dramatic, competitive, reality TV",
  defaultFormat: "9:16",
} as const;

const KONANTA_CHARACTERS = [
  {
    name: "Hassan",
    physicalDescription:
      "Athletic young man, 28 years old, Mediterranean features, short dark hair, tanned skin",
    outfit:
      "Beach survivor outfit: torn shorts, tribal necklace, no shirt showing athletic build",
    personality:
      "Funny, determined survivor, athletic, always joking but secretly very competitive",
    voiceProfile: "Male, energetic, Marseille accent, loud and enthusiastic",
  },
  {
    name: "Sarah",
    physicalDescription:
      "Athletic woman, 25 years old, curly brown hair, strong muscular build",
    outfit:
      "Sporty bikini top, camo shorts, athletic sneakers, headband",
    personality:
      "Strong, competitive, takes no nonsense, natural leader who intimidates others",
    voiceProfile: "Female, assertive, Marseille accent, confident and direct",
  },
  {
    name: "Roger",
    physicalDescription:
      "Older man, 55 years old, bald with grey beard, stocky build, red face from sun",
    outfit: "Tourist shirt with flowers, safari shorts, sandals with socks",
    personality:
      "Grumpy older candidate who complains about everything but surprisingly competitive",
    voiceProfile:
      "Male, grumpy, thick Southern French accent, always complaining",
  },
  {
    name: "Karim",
    physicalDescription:
      "Slim young man, 24 years old, stylish dark hair, always looks fashionable even on island",
    outfit:
      "Designer swim shorts, sunglasses always on head, luxury sandals",
    personality:
      "Strategic, mocking, always calculating his next move, fashionable and vain",
    voiceProfile:
      "Male, smooth, sarcastic Marseille accent, speaks slowly for effect",
  },
  {
    name: "Abel",
    physicalDescription:
      "Charismatic TV host, 35 years old, perfect white teeth, immaculate appearance despite island setting",
    outfit:
      "Crisp white shirt, chino shorts, microphone always in hand, perfect hair",
    personality:
      "Energetic TV presenter, overly enthusiastic, drama lover, always hyping the competition",
    voiceProfile:
      "Male, TV presenter voice, exaggerated enthusiasm, perfect diction",
  },
] as const;

const KONANTA_ENVIRONMENTS = [
  {
    name: "Konanta Beach",
    description:
      "A stunning tropical beach with crystal clear turquoise water, white sand, palm trees swaying in breeze",
    lighting: "Bright tropical sun, golden hour light, dramatic shadows",
    mood: "Competitive, tropical paradise, survival drama",
  },
  {
    name: "Rope Challenge Arena",
    description:
      "A water-based rope challenge course over the ocean, with floating platforms, ropes, and obstacles",
    lighting: "Midday sun blazing, reflections on water, intense heat haze",
    mood: "Intense competition, physical challenge, high stakes",
  },
  {
    name: "Balloon Race Zone",
    description:
      "Open beach area with colorful balloons, starting line with flags, crowd area for spectators",
    lighting: "Afternoon golden light, festive atmosphere, bright colors",
    mood: "Fun, chaotic, unexpected twists, comedic",
  },
] as const;

const KONANTA_EPISODES = [
  {
    title: "Le Défi de la Corde et la Course aux Ballons",
    format: "9:16",
    status: "draft",
    script:
      "Hassan, Sarah, Roger, Karim and host Abel compete in two epic beach challenges: first a treacherous rope course over the ocean, then a chaotic balloon race on the beach. Alliances form, betrayals happen, Roger falls in the water multiple times, Karim loses his sunglasses, and Sarah dominates while Hassan tries to make everyone laugh. Abel hypes everything to the max.",
  },
  {
    title: "La Nuit des Alliances",
    format: "9:16",
    status: "draft",
    script:
      "After the rope challenge, the camp splits into tense alliances. Sarah wants discipline, Karim starts plotting in secret, Hassan tries to keep the peace, Roger complains about the food, and Abel announces a surprise night test that exposes betrayals around the fire.",
  },
  {
    title: "Le Conseil Final de Konanta",
    format: "9:16",
    status: "draft",
    script:
      "The finalists face one last emotional showdown on Konanta Beach. Abel organizes a final obstacle race and a public vote. Old conflicts return, Hassan pushes through pain, Sarah stays focused, Karim defends his strategy, and Roger delivers an unexpected speech before the winner is revealed.",
  },
] as const;

export async function createKonantaStarterSeries(
  userId: string,
  options?: { episodeCount?: number }
) {
  const requestedEpisodeCount = options?.episodeCount ?? KONANTA_EPISODES.length;
  const episodeCount = Math.min(
    Math.max(requestedEpisodeCount, 1),
    KONANTA_EPISODES.length
  );

  return prisma.series.create({
    data: {
      userId,
      ...KONANTA_SERIES,
      characters: {
        create: KONANTA_CHARACTERS.map((character) => ({
          ...character,
          consistencyPrompt: buildConsistencyPrompt(character),
        })),
      },
      environments: {
        create: KONANTA_ENVIRONMENTS.map((environment) => ({
          ...environment,
          reusable: true,
        })),
      },
      episodes: {
        create: KONANTA_EPISODES.slice(0, episodeCount),
      },
    },
    include: {
      characters: true,
      environments: true,
      episodes: { orderBy: { createdAt: "asc" } },
    },
  });
}
