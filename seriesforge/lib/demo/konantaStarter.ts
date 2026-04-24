import { prisma } from "@/lib/db/prisma";
import { buildConsistencyPrompt } from "@/lib/agents/characterConsistencyAgent";

const KONANTA_SERIES = {
  title: "Les Marseillais a Konanta",
  description:
    "Une serie de telerealite animee sur une ile tropicale avec des defis, des alliances et beaucoup de drama.",
  visualStyle: "Pixar 3D cinematic reality TV",
  tone: "funny, dramatic, competitive, reality TV",
  defaultFormat: "9:16",
};

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
    outfit: "Sporty bikini top, camo shorts, athletic sneakers, headband",
    personality:
      "Strong, competitive, takes no nonsense, natural leader who intimidates others",
    voiceProfile: "Female, assertive, Marseille accent, confident and direct",
  },
  {
    name: "Roger",
    physicalDescription: "Older man, 55 years old, bald with grey beard, stocky build, sunburned face",
    outfit: "Tourist floral shirt, safari shorts, sandals with socks",
    personality: "Grumpy older candidate who complains about everything but remains surprisingly tough",
    voiceProfile: "Male, grumpy, thick Southern French accent, always complaining",
  },
  {
    name: "Karim",
    physicalDescription: "Slim young man, 24 years old, stylish dark hair, fashionable look",
    outfit: "Designer swim shorts, sunglasses on head, luxury sandals",
    personality: "Strategic, sarcastic, calculating, fashionable and vain",
    voiceProfile: "Male, smooth, sarcastic Marseille accent, speaks slowly for effect",
  },
  {
    name: "Abel",
    physicalDescription:
      "Charismatic TV host, 35 years old, perfect smile, immaculate appearance despite island setting",
    outfit: "Crisp white shirt, chino shorts, microphone always in hand, perfect hair",
    personality: "Energetic TV presenter, drama lover, always hyping the competition",
    voiceProfile: "Male, TV presenter voice, exaggerated enthusiasm, perfect diction",
  },
] as const;

const KONANTA_ENVIRONMENTS = [
  {
    name: "Konanta Beach",
    description: "A tropical beach with turquoise water, white sand and palm trees moving in the breeze",
    lighting: "Bright tropical sun, strong highlights and glossy reflections",
    mood: "Tropical paradise mixed with survival competition",
  },
  {
    name: "Rope Challenge Arena",
    description: "A rope obstacle course suspended above the ocean with floating platforms and splashes",
    lighting: "Hard midday sunlight with sparkling water reflections",
    mood: "High stakes physical challenge and comic tension",
  },
  {
    name: "Balloon Race Zone",
    description: "Open beach race zone with bright balloons, flags and chaotic movement everywhere",
    lighting: "Warm late afternoon sun with festive colors",
    mood: "Chaotic, playful and competitive",
  },
] as const;

const KONANTA_EPISODE = {
  title: "Le Defi de la Corde et la Course aux Ballons",
  format: "9:16",
  status: "complete",
  script:
    "Hassan, Sarah, Roger, Karim et Abel s'affrontent sur l'ile de Konanta dans deux epreuves. Un parcours de corde au-dessus de l'ocean revele les peurs, puis une course aux ballons sur la plage declenche des alliances, des trahisons et des chutes memorables.",
};

const KONANTA_SCENES = [
  {
    sceneNumber: 1,
    timecode: "00:00",
    location: "Konanta Beach",
    charactersJson: JSON.stringify(["Abel", "Hassan", "Sarah", "Roger", "Karim"]),
    action:
      "Abel accueille les candidats sur la plage et annonce une journee de competition totale. Les cinq se jaugent pendant que les vagues frappent derriere eux.",
    narration:
      "Bienvenue a Konanta. Ici, le soleil tape fort, les egos encore plus, et personne ne survivra a cette journee sans perdre un peu de dignite.",
    dialogue:
      "Abel: 'Aujourd'hui, deux epreuves, zero pitie !'\nHassan: 'Moi je suis venu pour gagner... et pour bronzer un peu aussi.'",
    camera: "Vertical reality TV intro shot, quick push-in on reactions, drone reveal of the beach",
    emotion: "Excitement, tension, bravado",
    soundDesign: "Waves, gulls, distant percussion, reality TV sting on each reaction",
    imagePrompt:
      "Vertical 9:16 Pixar-style reality TV opening on a tropical island beach, five contestants and a charismatic host lined up on the sand, bright turquoise water, warm cinematic sunlight, energetic expressions, dramatic intro composition, glossy animated realism.",
    videoPrompt:
      "Reality TV opening shot in vertical format. Start with a beach wide shot, then push in on Abel presenting the challenge while Hassan jokes and Sarah stays focused. The ocean sparkles, wind moves palm trees, everyone reacts with competitive energy.",
    status: "storyboarded",
  },
  {
    sceneNumber: 2,
    timecode: "00:18",
    location: "Konanta Beach",
    charactersJson: JSON.stringify(["Hassan", "Sarah", "Roger"]),
    action:
      "Pendant la preparation, Hassan improvise des conseils absurdes, Sarah organise deja l'equipe et Roger rale contre la chaleur et le sable.",
    narration:
      "Avant meme le premier defi, Sarah prend le controle, Hassan fait le show, et Roger declare officiellement la guerre au climat tropical.",
    dialogue:
      "Sarah: 'On se concentre, on respire, on gagne.'\nRoger: 'On gagne surtout un coup de soleil, oui.'",
    camera: "Handheld closeups, playful reaction shots, medium vertical framing",
    emotion: "Humor, irritation, leadership",
    soundDesign: "Laughter, surf wash, dry comedic sting after Roger complains",
    imagePrompt:
      "Pixar 3D close group moment on tropical beach, Sarah leading with confident body language, Hassan joking animatedly, Roger grumpy and overheated, vertical 9:16 framing, bright sand, rich expressions, comedic reality TV energy.",
    videoPrompt:
      "Cut between Sarah giving instructions, Hassan acting overconfident, and Roger complaining under the sun. Keep it fast and comedic with reaction shots and a breezy tropical background.",
    status: "storyboarded",
  },
  {
    sceneNumber: 3,
    timecode: "00:34",
    location: "Rope Challenge Arena",
    charactersJson: JSON.stringify(["Abel", "Hassan", "Sarah", "Roger", "Karim"]),
    action:
      "Abel presente le parcours de corde suspendu au-dessus de l'eau. Karim ajuste ses lunettes comme s'il passait sur un podium plus que dans un defi.",
    narration:
      "Premier test: avancer sur une corde au-dessus de l'ocean. Simple sur le papier. Humiliant dans la realite.",
    dialogue:
      "Abel: 'Une chute et c'est le grand plongeon !'\nKarim: 'Mes lunettes coutent plus cher que ce defi.'",
    camera: "Tall reveal of obstacle course, host foreground, contestants in background, dramatic vertical perspective",
    emotion: "Apprehension, swagger, suspense",
    soundDesign: "Water splashes, rope creaks, rising dramatic percussion",
    imagePrompt:
      "Vertical cinematic reveal of a rope obstacle course above bright ocean water, charismatic host in foreground presenting, contestants reacting behind him, Pixar animated reality TV style, dramatic scale, tropical sun, suspenseful mood.",
    videoPrompt:
      "Reveal the obstacle from top to bottom in a vertical shot, then cut to contestant reactions. Karim adjusts his sunglasses, Roger looks worried, Sarah stays calm, Hassan grins at the camera.",
    status: "storyboarded",
  },
  {
    sceneNumber: 4,
    timecode: "00:52",
    location: "Rope Challenge Arena",
    charactersJson: JSON.stringify(["Hassan", "Sarah"]),
    action:
      "Hassan se lance sur la corde avec trop de confiance, manque de glisser, puis se rattrape en plaisantant. Sarah le suit avec une precision froide.",
    narration:
      "Hassan transforme la peur en spectacle. Sarah, elle, transforme le spectacle en victoire.",
    dialogue:
      "Hassan: 'Je controle ! Je controle !... presque.'\nSarah: 'Parle moins, avance plus.'",
    camera: "Low angle over water, alternating between wobbling rope and focused closeups",
    emotion: "Adrenaline, comic panic, control",
    soundDesign: "Rope tension, splash below, quick whoosh on near-fall",
    imagePrompt:
      "Pixar-style action shot above ocean water, Hassan wobbling on a suspended rope with expressive panic while Sarah follows with calm precision, vertical 9:16 composition, dynamic movement, sun glare on water, reality TV tension.",
    videoPrompt:
      "Show Hassan wobbling dramatically while trying to stay funny, then cut to Sarah moving with perfect balance. Use quick edits, splashing water below and competitive tension.",
    status: "storyboarded",
  },
  {
    sceneNumber: 5,
    timecode: "01:08",
    location: "Rope Challenge Arena",
    charactersJson: JSON.stringify(["Roger", "Abel", "Karim"]),
    action:
      "Roger tente le passage, perd l'equilibre et tombe a l'eau sous les commentaires exaltés d'Abel et le sarcasme de Karim.",
    narration:
      "Le duel entre Roger et la gravite se termine comme souvent: par une victoire totale de la gravite.",
    dialogue:
      "Abel: 'Et Roger plonge dans l'histoire de Konanta !'\nKarim: 'Au moins, il s'est rafraichi.'",
    camera: "Slow build to fall, then splash freeze-like comedic beat, host reaction cutaway",
    emotion: "Shock, comedy, humiliation",
    soundDesign: "Big splash, whistle sting, crowd gasp then laughter",
    imagePrompt:
      "Comic Pixar 3D splash moment with Roger falling from rope challenge into tropical water, Abel reacting like an excited host, Karim smirking nearby, vertical action framing, bright blue ocean, exaggerated comedic expressions.",
    videoPrompt:
      "Build tension as Roger struggles, then show a big splash and instant comedic reaction from Abel and Karim. Keep the pacing playful and over-the-top like reality TV.",
    status: "storyboarded",
  },
  {
    sceneNumber: 6,
    timecode: "01:24",
    location: "Balloon Race Zone",
    charactersJson: JSON.stringify(["Sarah", "Hassan", "Karim", "Roger"]),
    action:
      "La course aux ballons commence. Sarah part comme une sprinteuse, Hassan improvise des trajectoires folles, Karim perd ses lunettes en plein sprint et Roger suit de loin en soufflant.",
    narration:
      "Deuxieme epreuve, nouvelle crise: courir, proteger son ballon, et surtout sauver ce qu'il reste de son image.",
    dialogue:
      "Hassan: 'Je cours pour l'honneur !'\nKarim: 'Mes lunettes ! Mes lunettes avant mon ballon !'",
    camera: "Fast lateral tracking shot with balloons crossing frame in vertical composition",
    emotion: "Chaos, urgency, competitiveness",
    soundDesign: "Running footsteps, balloons squeaking, crowd-like cheers, comic sting when glasses fly off",
    imagePrompt:
      "Colorful balloon race on a tropical beach, Sarah sprinting ahead, Hassan moving wildly, Karim losing his sunglasses mid-run, Roger trailing behind, Pixar 3D reality TV style, saturated colors, vertical 9:16 energy.",
    videoPrompt:
      "Track the contestants during a frantic balloon race. Sarah dominates, Hassan improvises, Karim loses his sunglasses and panics, Roger struggles behind. Use bright festive colors and fast playful motion.",
    status: "storyboarded",
  },
  {
    sceneNumber: 7,
    timecode: "01:40",
    location: "Balloon Race Zone",
    charactersJson: JSON.stringify(["Sarah", "Hassan", "Karim"]),
    action:
      "Sarah coupe la ligne en tete. Hassan arrive deuxieme en celebrant trop tot, pendant que Karim accuse le vent, le sable et l'univers entier.",
    narration:
      "Sarah confirme son statut de machine de guerre. Hassan gagne l'ambiance. Karim, lui, gagne une nouvelle excuse.",
    dialogue:
      "Sarah: 'Je vous avais dit de suivre le rythme.'\nKarim: 'Avec ce vent, personne ne pouvait performer normalement.'",
    camera: "Triumphant finish-line framing, medium closeups on victory and frustration",
    emotion: "Triumph, exhaustion, bitterness",
    soundDesign: "Victory sting, heavy breathing, short sarcastic beat after Karim's excuse",
    imagePrompt:
      "Pixar-style finish line on tropical beach, Sarah victorious and powerful, Hassan celebrating too early with comic charm, Karim frustrated and blaming everything, vertical composition, colorful flags and balloons, reality TV drama.",
    videoPrompt:
      "Show Sarah winning decisively, Hassan celebrating with chaotic energy, and Karim complaining at the finish line. End on strong reaction shots and competitive reality TV flair.",
    status: "storyboarded",
  },
  {
    sceneNumber: 8,
    timecode: "01:56",
    location: "Konanta Beach",
    charactersJson: JSON.stringify(["Abel", "Hassan", "Sarah", "Roger", "Karim"]),
    action:
      "Au coucher du soleil, Abel conclut la journee. Sarah savoure sa domination, Hassan promet une revanche, Roger boude encore trempe et Karim jure qu'il reviendra avec une vraie strategie.",
    narration:
      "Fin de journee a Konanta: des egos froisses, des alliances fragiles et une revanche deja en marche. Le drama ne fait que commencer.",
    dialogue:
      "Abel: 'Ce soir, Konanta a choisi ses heros... et ses victimes.'\nHassan: 'Demain je reviens en mode legende.'",
    camera: "Sunset group tableau with warm rim light and final host closeup",
    emotion: "Aftermath, pride, resentment, anticipation",
    soundDesign: "Gentle surf, warm music rise, teaser sting on final line",
    imagePrompt:
      "Warm sunset closing tableau on a tropical beach, host with contestants after a dramatic competition day, Sarah confident, Hassan playful, Roger soaked and grumpy, Karim plotting revenge, Pixar 3D reality TV mood, vertical 9:16 cinematic finish.",
    videoPrompt:
      "End the episode on a golden-hour beach group shot. Abel wraps up the day, Sarah looks satisfied, Hassan promises a comeback, Roger sulks, Karim plots revenge. Finish with a teaser-style dramatic pause.",
    status: "storyboarded",
  },
] as const;

export const KONANTA_STARTER_SUMMARY = {
  seriesTitle: KONANTA_SERIES.title,
  episodeTitle: KONANTA_EPISODE.title,
  characterCount: KONANTA_CHARACTERS.length,
  environmentCount: KONANTA_ENVIRONMENTS.length,
  sceneCount: KONANTA_SCENES.length,
};

export async function createKonantaStarterSeries(userId: string) {
  return prisma.$transaction(async (tx) => {
    const series = await tx.series.create({
      data: {
        userId,
        ...KONANTA_SERIES,
      },
    });

    await tx.character.createMany({
      data: KONANTA_CHARACTERS.map((character) => ({
        ...character,
        seriesId: series.id,
        consistencyPrompt: buildConsistencyPrompt(character),
      })),
    });

    await tx.environment.createMany({
      data: KONANTA_ENVIRONMENTS.map((environment) => ({
        ...environment,
        seriesId: series.id,
        reusable: true,
      })),
    });

    const episode = await tx.episode.create({
      data: {
        seriesId: series.id,
        ...KONANTA_EPISODE,
      },
    });

    await tx.scene.createMany({
      data: KONANTA_SCENES.map((scene) => ({
        ...scene,
        episodeId: episode.id,
      })),
    });

    return {
      seriesId: series.id,
      episodeId: episode.id,
      seriesTitle: series.title,
      episodeTitle: episode.title,
      characterCount: KONANTA_CHARACTERS.length,
      environmentCount: KONANTA_ENVIRONMENTS.length,
      sceneCount: KONANTA_SCENES.length,
    };
  });
}
