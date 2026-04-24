import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buildConsistencyPrompt } from "@/lib/agents/characterConsistencyAgent";

type CharacterSeed = {
  name: string;
  physicalDescription: string;
  outfit: string;
  personality: string;
  voiceProfile: string;
};

type EnvironmentSeed = {
  name: string;
  description: string;
  lighting: string;
  mood: string;
};

type SceneSeed = {
  sceneNumber: number;
  timecode: string;
  location: string;
  characters: string[];
  action: string;
  narration: string;
  dialogue: string;
  camera: string;
  emotion: string;
  soundDesign: string;
  imagePrompt: string;
  videoPrompt: string;
};

const CHARACTERS: CharacterSeed[] = [
  {
    name: "Hassan",
    physicalDescription: "Homme de 28 ans, athlétique, peau halée, cheveux courts noirs, regard vif et sourire confiant.",
    outfit: "Short de survie usé, collier tribal, poignets en corde, torse nu avec traces de sable.",
    personality: "Drôle et provocateur, compétitif mais loyal, détend le groupe pendant les tensions.",
    voiceProfile: "Voix masculine énergique, accent marseillais, débit rapide et enthousiaste.",
  },
  {
    name: "Sarah",
    physicalDescription: "Femme de 25 ans, musculature marquée, cheveux bruns bouclés attachés, posture dominante.",
    outfit: "Brassière sport kaki, short camouflage, baskets résistantes à l'eau, bandeau technique.",
    personality: "Leader naturelle, déterminée, directe, impose le respect et garde la tête froide.",
    voiceProfile: "Voix féminine affirmée, accent marseillais, ton franc et autoritaire.",
  },
  {
    name: "Roger",
    physicalDescription: "Homme de 55 ans, carrure robuste, barbe grise, visage rougi par le soleil.",
    outfit: "Chemise fleurie ouverte, short safari beige, chaussettes hautes avec sandales.",
    personality: "Râleur attachant, dramatise tout, surprend par sa ténacité dans les épreuves.",
    voiceProfile: "Voix grave râpeuse, accent du sud marqué, rythme lent avec soupirs fréquents.",
  },
  {
    name: "Karim",
    physicalDescription: "Homme de 24 ans, silhouette fine, coiffure impeccable, style très soigné même en survie.",
    outfit: "Short premium sombre, lunettes de soleil sur la tête, sandales luxueuses minimalistes.",
    personality: "Stratège sarcastique, calculateur, charmeur, joue en permanence sur les alliances.",
    voiceProfile: "Voix masculine douce, accent marseillais léger, ton ironique et posé.",
  },
  {
    name: "Abel",
    physicalDescription: "Présentateur de 35 ans, allure impeccable, sourire télégénique, prestance très maîtrisée.",
    outfit: "Chemise blanche impeccable, short beige propre, micro main, style animateur premium.",
    personality: "Showman dramatique, booste l'intensité, relance les conflits et maintient le rythme.",
    voiceProfile: "Voix d'animateur TV, articulation claire, énergie élevée et exclamative.",
  },
];

const ENVIRONMENTS: EnvironmentSeed[] = [
  {
    name: "Plage de Konanta",
    description: "Plage tropicale avec eau turquoise, sable blanc, palmiers agités et horizon spectaculaire.",
    lighting: "Soleil tropical fort, reflets dorés, ombres nettes sur le sable.",
    mood: "Compétitif, festif et dramatique.",
  },
  {
    name: "Arène des Cordes",
    description: "Parcours suspendu au-dessus de l'eau avec cordes, filets, plateformes flottantes et rampes glissantes.",
    lighting: "Lumière de midi intense, scintillement sur l'eau, ambiance chaude.",
    mood: "Tension sportive, dépassement de soi.",
  },
  {
    name: "Zone Ballons",
    description: "Terrain de course balisé avec ballons colorés, fanions, zone public et ligne d'arrivée.",
    lighting: "Fin d'après-midi lumineuse, tons chauds et contrastés.",
    mood: "Chaos comique et suspense.",
  },
];

const SCENES: SceneSeed[] = [
  {
    sceneNumber: 1,
    timecode: "00:00",
    location: "Plage de Konanta",
    characters: ["Abel", "Hassan", "Sarah", "Roger", "Karim"],
    action: "Abel lance l'épisode et présente les deux défis du jour devant les candidats alignés sur la plage.",
    narration: "Le soleil se lève sur Konanta. L'épisode démarre avec une tension immédiate entre les équipes.",
    dialogue: "Abel: Aujourd'hui, corde extrême puis course aux ballons. Seuls les plus solides survivront !",
    camera: "Plan drone d'ouverture puis travelling frontal sur les candidats.",
    emotion: "Excitation collective avec nervosité sous-jacente.",
    soundDesign: "Vagues, percussions légères, cris du public au loin.",
    imagePrompt: "Wide tropical reality TV opening shot, host presenting challenge, five contestants lined up on beach, cinematic, high detail",
    videoPrompt: "Dynamic opening sequence with drone reveal, host announcement, contestants reacting with tension and smiles, tropical TV show style",
  },
  {
    sceneNumber: 2,
    timecode: "00:30",
    location: "Arène des Cordes",
    characters: ["Hassan", "Sarah", "Roger", "Karim"],
    action: "Les candidats entament le parcours. Sarah prend la tête, Roger glisse, Hassan tente de l'aider en plaisantant.",
    narration: "Le défi des cordes fait sa première victime quand Roger perd l'équilibre.",
    dialogue: "Hassan: Roger, respire ! Si tu tombes encore, je te facture la plongée !",
    camera: "Plans serrés sur les mains, ralentis sur les glissades, contre-plongée dramatique.",
    emotion: "Stress compétitif avec touches d'humour.",
    soundDesign: "Corde qui grince, éclaboussures, respirations haletantes.",
    imagePrompt: "Action challenge over water with ropes and floating platforms, contestants struggling, athletic female leading, reality show cinematic framing",
    videoPrompt: "Fast-paced obstacle sequence with slips and recoveries, intense expressions, spray water effects, suspenseful reality competition",
  },
  {
    sceneNumber: 3,
    timecode: "01:00",
    location: "Arène des Cordes",
    characters: ["Sarah", "Karim", "Roger"],
    action: "Sarah termine première, Karim accuse Roger d'avoir cassé le rythme de l'équipe.",
    narration: "La victoire de Sarah déclenche immédiatement des tensions tactiques.",
    dialogue: "Karim: On aurait gagné plus large sans les ralentissements de Roger.",
    camera: "Champ-contrechamp serré entre Sarah et Karim, coupe réaction sur Roger vexé.",
    emotion: "Conflit, ego et frustration.",
    soundDesign: "Musique de tension, public qui réagit, souffle du vent.",
    imagePrompt: "Reality TV confrontation after challenge, strong female winner, sarcastic stylish male contestant, older man frustrated, dramatic sunlight",
    videoPrompt: "Post-challenge argument scene, emotional close-ups, heated dialogue and competitive energy, beach arena background",
  },
  {
    sceneNumber: 4,
    timecode: "01:30",
    location: "Zone Ballons",
    characters: ["Abel", "Hassan", "Sarah", "Roger", "Karim"],
    action: "Abel lance la course aux ballons. Les candidats courent, éclatent des ballons et cherchent des bonus cachés.",
    narration: "Le second défi commence dans un chaos total où la stratégie compte autant que la vitesse.",
    dialogue: "Abel: Chaque ballon peut tout changer, gardez votre sang-froid !",
    camera: "Caméra épaule mobile, plans rapides latéraux, inserts sur les ballons explosés.",
    emotion: "Adrénaline joyeuse et imprévisible.",
    soundDesign: "Pop de ballons, cris, sifflets, rythme musical accéléré.",
    imagePrompt: "Colorful balloon race on tropical beach, contestants sprinting and popping balloons, reality show excitement, vivid colors",
    videoPrompt: "Chaotic fun race with balloons popping, contestants running and diving, host commentary, energetic competition montage",
  },
  {
    sceneNumber: 5,
    timecode: "02:00",
    location: "Zone Ballons",
    characters: ["Hassan", "Karim", "Roger"],
    action: "Karim perd ses lunettes et accuse Hassan de sabotage pendant que Roger trouve un bonus par hasard.",
    narration: "Le hasard renverse l'épreuve quand Roger récupère un avantage inattendu.",
    dialogue: "Roger: J'ai rien compris, mais j'ai trouvé le bonus !",
    camera: "Focus objet sur les lunettes perdues, zoom comique sur Roger triomphant.",
    emotion: "Comédie, surprise et rivalité.",
    soundDesign: "Rires du public, musique comique, souffle de course.",
    imagePrompt: "Comedic reality TV moment, stylish contestant loses sunglasses, older contestant celebrating random bonus, tropical race atmosphere",
    videoPrompt: "Funny mid-race twist with lost sunglasses and unexpected bonus find, expressive reactions and comedic pacing",
  },
  {
    sceneNumber: 6,
    timecode: "02:30",
    location: "Plage de Konanta",
    characters: ["Abel", "Hassan", "Sarah", "Roger", "Karim"],
    action: "Abel annonce les résultats, Sarah gagne le classement, alliances fragiles pour le prochain épisode.",
    narration: "La journée se termine entre célébration et promesse de revanche.",
    dialogue: "Abel: Sarah domine ce soir, mais Konanta n'a pas encore livré tous ses pièges !",
    camera: "Plan large coucher de soleil puis panoramique lent sur les visages des candidats.",
    emotion: "Soulagement, fierté et suspense final.",
    soundDesign: "Ambiance de fin d'épreuve, vague calme, musique de clôture.",
    imagePrompt: "Sunset elimination ceremony on tropical beach, host announcing winner, contestants emotional, cinematic reality TV ending",
    videoPrompt: "Closing ceremony at sunset with rankings announcement, mixed emotions and cliffhanger tone for next episode",
  },
];

function createEpisodeScript(): string {
  return [
    "Épisode pilote : Les candidats affrontent deux défis sur l'île de Konanta.",
    "Défi 1 : parcours de cordes au-dessus de l'eau avec pression collective.",
    "Défi 2 : course aux ballons avec bonus cachés et renversements de situation.",
    "Résultat : Sarah prend l'avantage, mais les alliances restent instables.",
  ].join("\n");
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const series = await prisma.series.findFirst({ where: { id, userId: user.id } });
    if (!series) return NextResponse.json({ error: "Series not found" }, { status: 404 });

    let replaceExisting = true;
    try {
      const body = await req.json();
      if (typeof body?.replaceExisting === "boolean") {
        replaceExisting = body.replaceExisting;
      }
    } catch {
      // Empty body defaults to replace=true.
    }

    if (!replaceExisting) {
      const existing = await prisma.series.findFirst({
        where: { id, userId: user.id },
        select: {
          _count: {
            select: {
              characters: true,
              episodes: true,
              environments: true,
            },
          },
        },
      });

      const hasData = !!existing && (
        existing._count.characters > 0 ||
        existing._count.episodes > 0 ||
        existing._count.environments > 0
      );
      if (hasData) {
        return NextResponse.json(
          { error: "Series already contains data. Use replaceExisting=true." },
          { status: 409 },
        );
      }
    }

    const result = await prisma.$transaction(async tx => {
      if (replaceExisting) {
        await tx.episode.deleteMany({ where: { seriesId: id } });
        await tx.character.deleteMany({ where: { seriesId: id } });
        await tx.environment.deleteMany({ where: { seriesId: id } });
      }

      await tx.character.createMany({
        data: CHARACTERS.map(character => ({
          seriesId: id,
          name: character.name,
          physicalDescription: character.physicalDescription,
          outfit: character.outfit,
          personality: character.personality,
          voiceProfile: character.voiceProfile,
          consistencyPrompt: buildConsistencyPrompt(character),
        })),
      });

      await tx.environment.createMany({
        data: ENVIRONMENTS.map(environment => ({
          seriesId: id,
          name: environment.name,
          description: environment.description,
          lighting: environment.lighting,
          mood: environment.mood,
          reusable: true,
        })),
      });

      const episode = await tx.episode.create({
        data: {
          seriesId: id,
          title: "Épisode pilote restauré",
          format: series.defaultFormat || "9:16",
          status: "complete",
          script: createEpisodeScript(),
        },
      });

      await tx.scene.createMany({
        data: SCENES.map(scene => ({
          episodeId: episode.id,
          sceneNumber: scene.sceneNumber,
          timecode: scene.timecode,
          location: scene.location,
          charactersJson: JSON.stringify(scene.characters),
          action: scene.action,
          narration: scene.narration,
          dialogue: scene.dialogue,
          camera: scene.camera,
          emotion: scene.emotion,
          soundDesign: scene.soundDesign,
          imagePrompt: scene.imagePrompt,
          videoPrompt: scene.videoPrompt,
          status: "storyboarded",
        })),
      });

      return {
        episodeId: episode.id,
        characterCount: CHARACTERS.length,
        environmentCount: ENVIRONMENTS.length,
        sceneCount: SCENES.length,
      };
    });

    return NextResponse.json({
      success: true,
      message: "Configuration restaurée",
      ...result,
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Restore failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
