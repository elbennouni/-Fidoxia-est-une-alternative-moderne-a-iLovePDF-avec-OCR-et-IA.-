import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buildConsistencyPrompt } from "@/lib/agents/characterConsistencyAgent";

const CHARACTERS_DATA = [
  {
    name: "Hassan",
    physicalDescription: "Homme athlétique de 28 ans, traits méditerranéens, cheveux noirs courts, peau bronzée, mâchoire carrée, sourire malicieux",
    outfit: "Short de plage déchiré, collier tribal, torse nu montrant une musculature athlétique, bracelet en corde au poignet",
    personality: "Drôle, déterminé, compétitif mais toujours de bonne humeur, blagueur né qui cache une détermination féroce",
    voiceProfile: "Voix masculine énergique, accent marseillais prononcé, ton enthousiaste et fort",
  },
  {
    name: "Sarah",
    physicalDescription: "Femme athlétique de 25 ans, cheveux bouclés bruns attachés en queue de cheval haute, musculature marquée, regard déterminé, peau mate",
    outfit: "Haut de bikini sport noir, short camouflage kaki, baskets de trail, bandeau dans les cheveux",
    personality: "Forte, compétitive, leader naturelle, ne supporte pas la médiocrité, directe et autoritaire mais loyale",
    voiceProfile: "Voix féminine assurée, ton direct et autoritaire, accent marseillais léger",
  },
  {
    name: "Roger",
    physicalDescription: "Homme de 55 ans, chauve avec barbe grise taillée, corpulence trapue, visage rouge par le soleil, rides d'expression marquées",
    outfit: "Chemise hawaïenne à fleurs ouverte, short de safari beige, sandales avec chaussettes, chapeau bob",
    personality: "Grognon, râleur invétéré qui se plaint de tout mais étonnamment compétitif, cœur tendre sous sa carapace",
    voiceProfile: "Voix masculine grave et grognonne, fort accent du sud, toujours en train de se plaindre",
  },
  {
    name: "Karim",
    physicalDescription: "Jeune homme mince de 24 ans, cheveux noirs coiffés avec style, toujours élégant même sur l'île, peau claire, yeux verts perçants",
    outfit: "Short de bain de marque, lunettes de soleil toujours sur la tête, sandales de luxe, montre clinquante",
    personality: "Stratège calculateur, moqueur, toujours en train de planifier son prochain coup, vaniteux et fashion victim",
    voiceProfile: "Voix masculine lisse et sarcastique, accent marseillais doux, parle lentement pour l'effet dramatique",
  },
  {
    name: "Abel",
    physicalDescription: "Homme charismatique de 35 ans, dents blanches parfaites, apparence impeccable malgré le décor tropical, cheveux parfaitement coiffés",
    outfit: "Chemise blanche impeccable, short chino beige, micro toujours à la main, coiffure parfaite",
    personality: "Présentateur TV surexcité, enthousiaste à l'excès, amateur de drama, pousse toujours la compétition au maximum",
    voiceProfile: "Voix de présentateur TV, enthousiasme exagéré, diction parfaite, ton dramatique",
  },
];

const ENVIRONMENTS_DATA = [
  {
    name: "Plage de Konanta",
    description: "Plage tropicale magnifique avec eau turquoise cristalline, sable blanc fin, palmiers ondulant dans la brise, coquillages éparpillés",
    lighting: "Soleil tropical éclatant, lumière dorée de golden hour, ombres dramatiques des palmiers",
    mood: "Compétition, paradis tropical, drame de survie, ambiance reality TV",
  },
  {
    name: "Parcours de Cordes",
    description: "Parcours d'obstacles nautique avec des cordes au-dessus de l'océan, plateformes flottantes, filets d'escalade, poutres d'équilibre",
    lighting: "Soleil de midi éblouissant, reflets sur l'eau, brume de chaleur intense",
    mood: "Compétition intense, défi physique, enjeux élevés, tension maximale",
  },
  {
    name: "Zone de Course aux Ballons",
    description: "Zone de plage ouverte avec des ballons colorés partout, ligne de départ avec drapeaux, tribunes pour les spectateurs, confettis",
    lighting: "Lumière dorée d'après-midi, atmosphère festive, couleurs vives et saturées",
    mood: "Fun, chaotique, rebondissements inattendus, comique, ambiance carnaval",
  },
];

const SCENES_DATA = [
  {
    sceneNumber: 1,
    timecode: "00:00",
    location: "Plage de Konanta",
    charactersJson: JSON.stringify(["Abel"]),
    action: "Abel se tient debout sur la plage au lever du soleil, micro à la main, face caméra. Il fait un geste dramatique vers l'horizon. La caméra zoom arrière pour révéler le décor paradisiaque de l'île.",
    narration: "Sur l'île de Konanta, au cœur du Pacifique, cinq candidats marseillais vont s'affronter dans les épreuves les plus folles jamais imaginées. Bienvenue dans Les Marseillais à Konanta !",
    dialogue: "Abel: 'Bonjour à tous et bienvenue sur Konanta ! Aujourd'hui, deux épreuves LÉGENDAIRES attendent nos candidats. Préparez-vous, ça va être du LOURD !'",
    camera: "Plan drone large → travelling avant → gros plan visage Abel",
    emotion: "Excitation, anticipation, grandeur",
    soundDesign: "Musique épique d'intro reality TV, bruit des vagues, cris de mouettes",
    imagePrompt: "Pixar 3D cinematic: charismatic male TV host Abel, perfect white teeth, white shirt, holding microphone, standing on stunning tropical beach at sunrise, turquoise water, palm trees, golden hour lighting, dramatic pose facing camera, reality TV atmosphere, ultra detailed, portrait orientation 9:16",
    videoPrompt: "Camera slowly zooming out from TV host on tropical beach, revealing paradise setting, golden sunrise light, cinematic movement",
    audioPrompt: "Epic reality TV intro music, ocean waves crashing, seagulls calling, dramatic orchestral buildup",
    qualityScore: 92,
    status: "approved",
  },
  {
    sceneNumber: 2,
    timecode: "00:30",
    location: "Plage de Konanta",
    charactersJson: JSON.stringify(["Hassan", "Sarah", "Roger", "Karim"]),
    action: "Les quatre candidats arrivent en file sur la plage. Hassan fait des blagues, Sarah s'échauffe sérieusement, Roger se plaint de la chaleur, Karim vérifie son reflet dans ses lunettes de soleil.",
    narration: "Nos quatre candidats découvrent le terrain de jeu du jour. Chacun avec sa stratégie, chacun avec ses forces... et ses faiblesses.",
    dialogue: "Hassan: 'Eh les gars, c'est pas la Corniche ici mais ça envoie !' Sarah: 'Moins de blabla, plus d'action.' Roger: 'Il fait une chaleur... j'aurais dû rester à Marseille.' Karim: 'Tranquille, j'ai ma stratégie.'",
    camera: "Plan séquence suivant les candidats → plans rapprochés sur chaque réaction",
    emotion: "Mélange d'excitation, nervosité, rivalité amicale",
    soundDesign: "Musique dynamique, pas dans le sable, bruits de jungle tropicale",
    imagePrompt: "Pixar 3D cinematic: four contestants walking on tropical beach - athletic young man Hassan with tribal necklace joking, muscular woman Sarah in sports bikini stretching, grumpy old bald man Roger in hawaiian shirt complaining, stylish slim young man Karim checking sunglasses, bright tropical setting, competitive atmosphere, portrait 9:16",
    videoPrompt: "Tracking shot following four contestants walking on beach, each showing personality through body language",
    audioPrompt: "Upbeat competitive music, footsteps in sand, tropical ambiance, character theme hints",
    qualityScore: 88,
    status: "approved",
  },
  {
    sceneNumber: 3,
    timecode: "01:00",
    location: "Parcours de Cordes",
    charactersJson: JSON.stringify(["Abel", "Hassan", "Sarah", "Roger", "Karim"]),
    action: "Abel présente le parcours de cordes au-dessus de l'océan. La caméra montre les obstacles terrifiants. Les candidats regardent avec des expressions variées : Hassan sourit, Sarah analyse, Roger pâlit, Karim recule.",
    narration: "La première épreuve : le Parcours de la Mort ! Quinze mètres de cordes au-dessus de l'océan, trois obstacles, zéro filet de sécurité.",
    dialogue: "Abel: 'Voici le PARCOURS DE LA MORT ! Le premier arrivé de l'autre côté gagne l'immunité !' Roger: 'Vous êtes malades...' Hassan: 'Allez c'est parti, je suis né pour ça !' Sarah: 'Facile.'",
    camera: "Plan panoramique du parcours → contre-plongée sur les obstacles → réactions en gros plan",
    emotion: "Tension, peur, détermination, adrénaline",
    soundDesign: "Musique de suspense, vent qui siffle dans les cordes, vagues en dessous",
    imagePrompt: "Pixar 3D cinematic: TV host Abel presenting terrifying rope obstacle course over turquoise ocean, four contestants looking up in awe, floating platforms, rope bridges, nets, midday blazing sun, water reflections, extreme competition setting, dramatic angle, portrait 9:16",
    videoPrompt: "Dramatic reveal of rope course over ocean, camera panning across obstacles, then cutting to contestants' reactions",
    audioPrompt: "Suspenseful music building, wind whistling through ropes, waves crashing below, dramatic drums",
    qualityScore: 95,
    status: "approved",
  },
  {
    sceneNumber: 4,
    timecode: "01:30",
    location: "Parcours de Cordes",
    charactersJson: JSON.stringify(["Hassan", "Sarah", "Roger"]),
    action: "Hassan se lance en premier sur les cordes avec agilité. Sarah le suit de près, puissante et précise. Roger tente de monter, glisse, tombe à l'eau dans un splash énorme. Il remonte sur la plateforme en pestant.",
    narration: "Hassan prend la tête avec une agilité de singe ! Sarah le talonne, impressionnante de puissance. Quant à Roger... disons que l'eau est bonne !",
    dialogue: "Hassan: 'Woooooh ! C'est comme les barres au Prado !' Sarah: 'Pousse-toi Hassan, je passe !' Roger: *SPLASH* 'PUTAIN DE—' *remonte* 'Je... je glisse, c'est normal, c'est mouillé !'",
    camera: "Travelling latéral suivant les candidats → ralenti sur la chute de Roger → plan sous-marin du splash",
    emotion: "Adrénaline, humour, frustration comique, compétition intense",
    soundDesign: "Musique d'action intense, grincements de cordes, splash géant, rires",
    imagePrompt: "Pixar 3D cinematic: athletic young man Hassan swinging on ropes over ocean with agility, muscular woman Sarah climbing behind him, old bald grumpy man Roger falling into turquoise water with huge splash, rope obstacle course, midday sun, water droplets frozen in air, action scene, portrait 9:16",
    videoPrompt: "Dynamic action sequence on rope course, one contestant falling into water with big splash, others competing intensely",
    audioPrompt: "High energy action music, rope creaking, big water splash, crowd reactions, comedic sound effect for fall",
    qualityScore: 94,
    status: "approved",
  },
  {
    sceneNumber: 5,
    timecode: "02:00",
    location: "Parcours de Cordes",
    charactersJson: JSON.stringify(["Karim", "Hassan", "Sarah"]),
    action: "Karim avance prudemment sur le parcours en essayant de ne pas se mouiller. Ses lunettes de soleil tombent dans l'eau. Il crie de désespoir. Pendant ce temps, Sarah dépasse Hassan dans un mouvement spectaculaire.",
    narration: "Karim perd ses lunettes de marque dans l'océan — un drame personnel. Pendant ce temps, Sarah prend la tête avec un mouvement acrobatique digne des JO !",
    dialogue: "Karim: 'MES LUNETTES ! Nooooon ! Elles coûtent 500 euros !' Hassan: 'Mdr Karim tes lunettes nagent mieux que toi !' Sarah: *passe devant Hassan* 'Ciao les garçons !'",
    camera: "Gros plan lunettes tombant au ralenti → plan large Sarah dépassant Hassan → réaction Karim",
    emotion: "Comédie, désespoir exagéré, triomphe, rivalité",
    soundDesign: "Son comique de chute, musique dramatique ironique pour les lunettes, foule qui acclame Sarah",
    imagePrompt: "Pixar 3D cinematic: stylish young man Karim on rope course reaching desperately toward his sunglasses falling into ocean in slow motion, muscular woman Sarah performing athletic move to pass athletic man Hassan, over turquoise ocean, dramatic comedy moment, golden sunlight, portrait 9:16",
    videoPrompt: "Slow motion of sunglasses falling into ocean, quick cut to athletic woman overtaking man on ropes, comedic contrast",
    audioPrompt: "Comedic dramatic music for falling sunglasses, crowd cheering, splash sound, triumphant music for overtake",
    qualityScore: 91,
    status: "approved",
  },
  {
    sceneNumber: 6,
    timecode: "02:30",
    location: "Zone de Course aux Ballons",
    charactersJson: JSON.stringify(["Abel", "Hassan", "Sarah", "Roger", "Karim"]),
    action: "Abel annonce la deuxième épreuve : la Course aux Ballons. Des centaines de ballons colorés sont attachés partout sur la plage. Chaque candidat doit éclater les ballons de sa couleur le plus vite possible.",
    narration: "Deuxième épreuve : la Course aux Ballons ! Chaque candidat a sa couleur. Le premier à éclater ses 20 ballons remporte le grand prix !",
    dialogue: "Abel: 'Hassan, tu es en ROUGE ! Sarah, BLEU ! Roger, JAUNE ! Karim, VERT ! À vos marques...' Roger: 'J'ai mal au dos moi après vos cordes...' Abel: 'PARTEZ !'",
    camera: "Plan large de l'arène aux ballons → gros plans sur les visages déterminés → plan d'ensemble au signal",
    emotion: "Excitation, chaos organisé, compétition festive",
    soundDesign: "Musique festive, ballons qui éclatent, klaxon de départ, foule excitée",
    imagePrompt: "Pixar 3D cinematic: TV host Abel with microphone announcing challenge, beach covered with hundreds of colorful balloons red blue yellow green, four contestants lined up ready to race, tropical setting, festive atmosphere with flags and banners, golden afternoon light, vibrant saturated colors, portrait 9:16",
    videoPrompt: "Reveal of balloon-covered beach, host announcing, contestants getting ready, starting signal horn blast",
    audioPrompt: "Festive upbeat music, starting horn, crowd cheering, contestants yelling, balloon rustling in wind",
    qualityScore: 89,
    status: "approved",
  },
  {
    sceneNumber: 7,
    timecode: "03:00",
    location: "Zone de Course aux Ballons",
    charactersJson: JSON.stringify(["Hassan", "Sarah", "Roger", "Karim"]),
    action: "Chaos total ! Hassan court partout en éclatant les ballons rouges avec énergie. Sarah est méthodique et efficace avec les bleus. Roger s'assoit sur les jaunes pour les éclater. Karim essaie de tricher en éclatant ceux des autres.",
    narration: "C'est le CHAOS sur la plage ! Chacun sa technique : Hassan court comme un fou, Sarah est une machine, Roger utilise... son postérieur, et Karim joue les stratèges fourbes !",
    dialogue: "Hassan: 'ALLEZ ALLEZ ALLEZ !' Sarah: 'Quinze... seize... dix-sept...' Roger: *assis sur les ballons* 'Comme ça c'est plus simple, hein !' Karim: *éclate un ballon bleu de Sarah* Sarah: 'EH ! KARIM !'",
    camera: "Montage rapide entre les quatre candidats → ralenti sur Roger assis sur les ballons → plan serré sur Karim trichant",
    emotion: "Chaos, humour, frustration, énergie folle",
    soundDesign: "Ballons qui éclatent en rafale, cris, musique de course poursuite, rires du public",
    imagePrompt: "Pixar 3D cinematic: chaotic balloon race on tropical beach - athletic man Hassan running wildly popping red balloons, muscular woman Sarah methodically popping blue balloons, old grumpy man Roger sitting on yellow balloons to pop them, stylish young man Karim sneakily popping someone else's balloons, colorful confetti everywhere, golden afternoon light, extreme fun, portrait 9:16",
    videoPrompt: "Fast-paced montage of contestants popping balloons in different hilarious ways, confetti flying, chaotic energy",
    audioPrompt: "Rapid balloon popping sounds, chaotic fun music, contestants yelling, crowd laughing and cheering",
    qualityScore: 93,
    status: "approved",
  },
  {
    sceneNumber: 8,
    timecode: "03:30",
    location: "Plage de Konanta",
    charactersJson: JSON.stringify(["Abel", "Hassan", "Sarah", "Roger", "Karim"]),
    action: "Abel rassemble tous les candidats pour le résultat final au coucher du soleil. Sarah a gagné les deux épreuves. Hassan la félicite. Roger boude. Karim planifie déjà sa revanche. Tous posent ensemble pour la photo finale.",
    narration: "Au coucher du soleil, le verdict tombe : Sarah remporte les deux épreuves ! Mais sur Konanta, rien n'est jamais fini... Rendez-vous au prochain épisode !",
    dialogue: "Abel: 'Et la grande gagnante du jour est... SARAH !' Hassan: 'Bravo Sarah, tu gères !' Sarah: 'Merci, c'était facile.' Roger: 'Pfff, si j'avais 30 ans de moins...' Karim: 'La prochaine fois, j'aurai ma revanche...' Abel: 'À la semaine prochaine sur KONANTA !'",
    camera: "Plan large coucher de soleil → médailles → photo de groupe → freeze frame final",
    emotion: "Triomphe, camaraderie, humour, suspense pour la suite",
    soundDesign: "Musique de victoire émouvante, applaudissements, vagues douces, générique de fin",
    imagePrompt: "Pixar 3D cinematic: all five characters together on tropical beach at stunning sunset - TV host Abel holding microphone announcing winner, victorious muscular woman Sarah in center, athletic Hassan congratulating her, grumpy Roger arms crossed pouting, stylish Karim plotting, golden sunset sky, palm trees silhouettes, reality TV finale moment, group pose, portrait 9:16",
    videoPrompt: "Sunset beach finale, host announcing winner, group celebration, freeze frame ending with reality TV style graphics",
    audioPrompt: "Emotional victory music, crowd applause, gentle ocean waves, uplifting orchestral finale, end credits theme",
    qualityScore: 96,
    status: "approved",
  },
];

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const existing = await prisma.series.findFirst({
      where: { userId: user.id, title: "Les Marseillais à Konanta" },
    });
    if (existing) {
      return NextResponse.json({
        error: "La série 'Les Marseillais à Konanta' existe déjà dans votre compte.",
        seriesId: existing.id,
      }, { status: 409 });
    }

    const series = await prisma.series.create({
      data: {
        userId: user.id,
        title: "Les Marseillais à Konanta",
        description: "Une série de téléréalité animée où des candidats marseillais survivent sur une île tropicale avec des défis épiques et hilarants.",
        visualStyle: "Pixar 3D cinematic reality TV",
        tone: "funny, dramatic, competitive, reality TV",
        defaultFormat: "9:16",
      },
    });

    for (const charData of CHARACTERS_DATA) {
      await prisma.character.create({
        data: {
          seriesId: series.id,
          ...charData,
          consistencyPrompt: buildConsistencyPrompt(charData),
        },
      });
    }

    for (const envData of ENVIRONMENTS_DATA) {
      await prisma.environment.create({
        data: { ...envData, seriesId: series.id, reusable: true },
      });
    }

    const episode = await prisma.episode.create({
      data: {
        seriesId: series.id,
        title: "Le Défi de la Corde et la Course aux Ballons",
        format: "9:16",
        status: "complete",
        script: "Hassan, Sarah, Roger, Karim et le présentateur Abel s'affrontent dans deux épreuves épiques sur la plage de Konanta : d'abord un parcours de cordes terrifiant au-dessus de l'océan, puis une course aux ballons chaotique. Alliances, trahisons, Roger tombe à l'eau plusieurs fois, Karim perd ses lunettes de soleil, et Sarah domine la compétition pendant qu'Hassan essaie de faire rire tout le monde. Abel pousse le drama au maximum.",
      },
    });

    const scenesToCreate = SCENES_DATA.map((s) => ({
      ...s,
      episodeId: episode.id,
    }));
    await prisma.scene.createMany({ data: scenesToCreate });

    const sceneCount = SCENES_DATA.length;
    const avgScore = Math.round(
      SCENES_DATA.reduce((sum, s) => sum + (s.qualityScore || 85), 0) / sceneCount
    );

    return NextResponse.json({
      success: true,
      message: "Série Konanta restaurée avec personnages, décors, épisode et scènes !",
      seriesId: series.id,
      episodeId: episode.id,
      characters: CHARACTERS_DATA.length,
      environments: ENVIRONMENTS_DATA.length,
      sceneCount,
      averageQualityScore: avgScore,
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Échec de la restauration";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
