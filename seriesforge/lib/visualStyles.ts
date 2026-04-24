export interface VisualStylePreset {
  id: string;
  name: string;
  category: string;
  emoji: string;
  description: string;
  promptKeywords: string;
  negativePrompt: string;
  colorPalette: string;
  reference?: string;
  badge?: string;
}

export const STYLE_CATEGORIES = [
  "Animation 3D",
  "Animation 2D",
  "Cinéma",
  "Manga / Anime",
  "Art",
  "Réaliste",
  "Fantastique",
  "Rétro",
];

export const VISUAL_STYLE_PRESETS: VisualStylePreset[] = [
  // ─── ANIMATION 3D ──────────────────────────────────────
  {
    id: "pixar-3d",
    name: "Pixar 3D",
    category: "Animation 3D",
    emoji: "🎬",
    description: "Style Pixar classique — personnages expressifs, couleurs vibrantes, éclairage cinématique",
    promptKeywords: "Pixar 3D animation style, expressive characters, subsurface skin scattering, vibrant saturated colors, cinematic lighting, smooth 3D render, Pixar movie quality, Finding Nemo color palette",
    negativePrompt: "photorealistic, anime, 2D flat, sketch, watercolor, dark, gritty",
    colorPalette: "Saturé, chaud, vibrant",
    reference: "Coco, Soul, Elemental",
    badge: "Populaire",
  },
  {
    id: "pixar-realtv",
    name: "Pixar 3D Reality TV",
    category: "Animation 3D",
    emoji: "📺",
    description: "Pixar meets réalité télévisée — personnages Pixar dans des situations réalistes drama/competition",
    promptKeywords: "Pixar 3D animation, reality TV show aesthetic, expressive exaggerated characters, dramatic competition setting, vibrant tropical colors, cinematic Pixar render",
    negativePrompt: "photorealistic, anime, dark horror, sketch",
    colorPalette: "Tropical, vibrant, ensoleillé",
    reference: "Survivor rencontre Pixar",
  },
  {
    id: "dreamworks-3d",
    name: "DreamWorks 3D",
    category: "Animation 3D",
    emoji: "🌟",
    description: "Style DreamWorks — personnages stylisés avec humour, plus anguleux que Pixar",
    promptKeywords: "DreamWorks Animation 3D style, stylized characters, angular expressive faces, bold colors, cinematic lighting, Shrek Kung Fu Panda quality",
    negativePrompt: "photorealistic, anime, dark, sketch, flat 2D",
    colorPalette: "Vif, contrasté, dynamique",
    reference: "Shrek, Kung Fu Panda, How to Train Your Dragon",
  },
  {
    id: "claymation",
    name: "Claymation",
    category: "Animation 3D",
    emoji: "🧱",
    description: "Animation en argile — texture mate, formes rondes, look artisanal",
    promptKeywords: "claymation stop motion animation, clay texture, matte surfaces, rounded shapes, handcrafted feel, warm studio lighting, Wallace and Gromit Aardman style",
    negativePrompt: "photorealistic, digital smooth, anime, harsh lighting",
    colorPalette: "Pastel, mat, chaleureux",
    reference: "Wallace & Gromit, Coraline",
  },
  {
    id: "disney-3d",
    name: "Disney 3D",
    category: "Animation 3D",
    emoji: "✨",
    description: "Style Disney moderne — personnages très expressifs, magie visuelle, couleurs féeriques",
    promptKeywords: "Disney 3D animation style, magical expressive characters, princess quality render, sparkle effects, warm magical lighting, Frozen Moana Encanto visual style",
    negativePrompt: "dark, horror, photorealistic, anime, rough sketch",
    colorPalette: "Magique, pastel, lumineux",
    reference: "Frozen, Moana, Encanto, Tangled",
    badge: "Magique",
  },

  // ─── ANIMATION 2D ──────────────────────────────────────
  {
    id: "cartoon-2d",
    name: "Cartoon 2D",
    category: "Animation 2D",
    emoji: "🖍️",
    description: "Cartoon classique American — contours noirs épais, couleurs plates, expressions comiques",
    promptKeywords: "2D cartoon animation style, thick black outlines, flat colors, exaggerated expressions, comic book feel, Saturday morning cartoon aesthetic",
    negativePrompt: "photorealistic, 3D render, anime, watercolor, dark",
    colorPalette: "Primaires, vif, plat",
    reference: "The Simpsons, Family Guy, Looney Tunes",
  },
  {
    id: "south-park",
    name: "South Park",
    category: "Animation 2D",
    emoji: "❄️",
    description: "Style South Park — papier découpé, très simple, comique absurde",
    promptKeywords: "South Park flat cutout animation style, construction paper texture, simple shapes, flat colors, crude humor aesthetic",
    negativePrompt: "detailed, photorealistic, 3D, anime, complex",
    colorPalette: "Colorado, froid, basique",
    reference: "South Park",
  },
  {
    id: "anime-modern",
    name: "Anime Moderne",
    category: "Animation 2D",
    emoji: "⚔️",
    description: "Anime japonais moderne — grands yeux expressifs, action dynamique, détails fins",
    promptKeywords: "modern anime style, large expressive eyes, dynamic action poses, detailed hair, clean line art, vibrant colors, Demon Slayer Attack on Titan quality",
    negativePrompt: "photorealistic, 3D, western cartoon, flat",
    colorPalette: "Contrasté, vibrant, éclairs",
    reference: "Demon Slayer, Attack on Titan, Jujutsu Kaisen",
    badge: "Tendance",
  },

  // ─── MANGA / ANIME ─────────────────────────────────────
  {
    id: "miyazaki",
    name: "Miyazaki / Ghibli",
    category: "Manga / Anime",
    emoji: "🌿",
    description: "Style Studio Ghibli — aquarelle poétique, nature luxuriante, magie douce",
    promptKeywords: "Studio Ghibli Miyazaki animation style, watercolor backgrounds, lush natural environments, soft lighting, painterly textures, whimsical magical atmosphere, Spirited Away My Neighbor Totoro visual style",
    negativePrompt: "photorealistic, dark horror, 3D CGI, harsh lighting, modern digital",
    colorPalette: "Doux, naturel, aquarelle",
    reference: "Spirited Away, Howl's Moving Castle, Princess Mononoke",
    badge: "Poétique",
  },
  {
    id: "manga-bw",
    name: "Manga Noir & Blanc",
    category: "Manga / Anime",
    emoji: "📖",
    description: "Manga traditionnel N&B — encre, hachures, cases dramatiques",
    promptKeywords: "manga black and white ink style, hatching crosshatching, dramatic panel composition, expressive line work, screentone textures, Dragon Ball One Piece manga art",
    negativePrompt: "color, photorealistic, 3D, watercolor",
    colorPalette: "N&B, encre, contrasté",
    reference: "Dragon Ball, Naruto, One Piece (manga)",
  },
  {
    id: "chibi",
    name: "Chibi / Super Deformed",
    category: "Manga / Anime",
    emoji: "🥰",
    description: "Style Chibi — personnages mignons tête surdimensionnée, ultra expressifs",
    promptKeywords: "chibi super deformed anime style, oversized head, tiny body, huge cute eyes, adorable expressions, pastel colors, kawaii aesthetic",
    negativePrompt: "realistic proportions, dark, horror, photorealistic",
    colorPalette: "Pastel, kawaii, rose",
    reference: "Chibi Maruko-chan",
  },

  // ─── CINÉMA ────────────────────────────────────────────
  {
    id: "nolan-cinematic",
    name: "Christopher Nolan",
    category: "Cinéma",
    emoji: "🎞️",
    description: "Style Nolan — IMAX grand format, bleu froid acier, éclairage naturel dramatique, réaliste",
    promptKeywords: "Christopher Nolan cinematography style, IMAX film quality, cold steel blue tones, natural practical lighting, handheld camera feel, dark realistic atmosphere, Inception Interstellar visual style",
    negativePrompt: "cartoon, animation, bright colors, flat, anime",
    colorPalette: "Bleu acier, désaturé, dramatique",
    reference: "Inception, Interstellar, The Dark Knight",
  },
  {
    id: "wes-anderson",
    name: "Wes Anderson",
    category: "Cinéma",
    emoji: "🌸",
    description: "Style Wes Anderson — symétrie parfaite, pastel vintage, composition précise",
    promptKeywords: "Wes Anderson film style, perfect symmetrical composition, pastel color palette, vintage aesthetic, flat perspective, quirky whimsical atmosphere, Grand Budapest Hotel visual style",
    negativePrompt: "asymmetrical, dark, gritty, action, modern digital",
    colorPalette: "Pastel vintage, symétrique",
    reference: "The Grand Budapest Hotel, Isle of Dogs",
    badge: "Signature",
  },
  {
    id: "cinematic-realistic",
    name: "Cinéma Réaliste",
    category: "Cinéma",
    emoji: "🎥",
    description: "Cinéma photoréaliste — qualité film 4K, éclairage naturel, tons cinématiques",
    promptKeywords: "photorealistic cinematic quality, 4K film grain, natural lighting, shallow depth of field, anamorphic lens flare, color graded, Hollywood movie quality",
    negativePrompt: "cartoon, anime, flat, sketch, low quality",
    colorPalette: "Cinématique, film grain",
    reference: "Hollywood blockbuster",
  },
  {
    id: "noir-film",
    name: "Film Noir",
    category: "Cinéma",
    emoji: "🖤",
    description: "Noir américain années 40 — N&B contrasté, ombres dramatiques, ambiance mystère",
    promptKeywords: "film noir black and white photography style, high contrast shadows, venetian blind light patterns, moody detective atmosphere, 1940s Hollywood aesthetic, rain wet streets",
    negativePrompt: "color, bright, cheerful, cartoon, anime",
    colorPalette: "N&B, ombres dures",
    reference: "Double Indemnity, Blade Runner (inspiration)",
  },

  // ─── ART ───────────────────────────────────────────────
  {
    id: "watercolor",
    name: "Aquarelle",
    category: "Art",
    emoji: "🎨",
    description: "Peinture aquarelle — couleurs qui se fondent, textures papier, douceur artistique",
    promptKeywords: "watercolor painting style, wet on wet technique, soft bleeding colors, paper texture, loose brushwork, artistic illustration, gentle romantic atmosphere",
    negativePrompt: "photorealistic, 3D, sharp edges, digital clean, anime",
    colorPalette: "Doux, fondu, transparent",
    reference: "Illustrations de livres d'enfants",
  },
  {
    id: "comic-marvel",
    name: "Comics Marvel/DC",
    category: "Art",
    emoji: "💥",
    description: "Style comics superhéros — couleurs pop, contours épais, action explosive",
    promptKeywords: "American superhero comic book style, bold ink outlines, halftone dots, dramatic action poses, vivid primary colors, Marvel DC Comics aesthetic, dynamic perspective",
    negativePrompt: "realistic, anime, pastel, soft, watercolor",
    colorPalette: "Primaires, pop, explosif",
    reference: "Marvel Comics, DC Comics",
    badge: "Action",
  },
  {
    id: "oil-painting",
    name: "Peinture à l'Huile",
    category: "Art",
    emoji: "🖼️",
    description: "Huile classique — textures riches, coups de pinceau visibles, maîtres anciens",
    promptKeywords: "oil painting style, visible brushstrokes, rich impasto texture, chiaroscuro lighting, classical Renaissance Baroque painting technique, museum quality art",
    negativePrompt: "digital, flat, anime, cartoon, photorealistic",
    colorPalette: "Riche, profond, classique",
    reference: "Rembrandt, Caravaggio",
  },

  // ─── RÉALISTE ──────────────────────────────────────────
  {
    id: "hyperrealistic",
    name: "Hyperréaliste",
    category: "Réaliste",
    emoji: "📸",
    description: "Photo extrêmement réaliste — impossible de distinguer du réel",
    promptKeywords: "hyperrealistic photorealistic rendering, ultra detailed skin pores, professional photography lighting, 8K resolution, RAW photo quality, DSLR camera",
    negativePrompt: "cartoon, anime, painting, sketch, 3D animation",
    colorPalette: "Naturel, photographique",
    reference: "Midjourney v6 photorealistic",
  },
  {
    id: "vintage-photo",
    name: "Photo Vintage",
    category: "Réaliste",
    emoji: "📷",
    description: "Photographie vintage — grain film, tons sépia/désaturés, époque rétro",
    promptKeywords: "vintage film photography, grain noise, faded colors, sepia warm tones, old Kodak film aesthetic, retro 1970s photography style",
    negativePrompt: "modern, clean, sharp, digital, cartoon",
    colorPalette: "Sépia, fade, grain",
    reference: "Années 70-80",
  },

  // ─── FANTASTIQUE ────────────────────────────────────────
  {
    id: "dark-fantasy",
    name: "Dark Fantasy",
    category: "Fantastique",
    emoji: "🐉",
    description: "Fantasy sombre — créatures épiques, magie mystérieuse, atmosphère gothique",
    promptKeywords: "dark fantasy digital art, epic creatures, magical atmosphere, gothic architecture, dramatic lighting, detailed fantasy world, Game of Thrones Lord of the Rings visual quality",
    negativePrompt: "cartoon, cute, bright cheerful, anime kawaii, flat",
    colorPalette: "Sombre, or, mystique",
    reference: "Game of Thrones, Lord of the Rings",
    badge: "Épique",
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk",
    category: "Fantastique",
    emoji: "🌆",
    description: "Cyberpunk futuriste — néons, pluie, Tokyo dystopique, tech-noir",
    promptKeywords: "cyberpunk neon noir aesthetic, rain slicked streets, holographic advertisements, neon pink purple blue lighting, dystopian megacity, Blade Runner Akira visual style",
    negativePrompt: "nature, bright daylight, pastel, medieval, cartoon simple",
    colorPalette: "Néon, bleu-violet, pluie",
    reference: "Blade Runner 2049, Akira",
  },
  {
    id: "fairy-tale",
    name: "Conte de Fées",
    category: "Fantastique",
    emoji: "🧚",
    description: "Univers enchanté — couleurs magiques, lumière féerique, forêts enchantées",
    promptKeywords: "enchanted fairy tale illustration style, magical glowing lights, enchanted forest, soft golden lighting, Disney fairy tale aesthetic, whimsical magical world",
    negativePrompt: "dark, horror, realistic, gritty, urban",
    colorPalette: "Or, mauve, féerique",
    reference: "Disney fairy tales",
  },

  // ─── RÉTRO ─────────────────────────────────────────────
  {
    id: "retro-80s",
    name: "Rétro 80s",
    category: "Rétro",
    emoji: "🕹️",
    description: "Années 80 — synthwave, néons, grille perspective, VHS glitch",
    promptKeywords: "80s retro synthwave aesthetic, neon grid perspective, VHS scan lines, chrome text, sunset gradient, Miami Vice Stranger Things visual style",
    negativePrompt: "modern, clean, flat, natural, organic",
    colorPalette: "Rose-violet néon, gradient",
    reference: "Stranger Things, Miami Vice",
  },
  {
    id: "pixel-art",
    name: "Pixel Art",
    category: "Rétro",
    emoji: "👾",
    description: "Pixel art rétro — sprites carrés, palette limitée, nostalgie jeux vidéo",
    promptKeywords: "pixel art style, 16-bit SNES era graphics, limited color palette, retro video game sprites, isometric pixel art, detailed pixel illustration",
    negativePrompt: "smooth, photorealistic, 3D, painting, blurry",
    colorPalette: "Limité, pixel, rétro",
    reference: "Super Nintendo, SNES games",
  },
];

export function getStyleById(id: string): VisualStylePreset | undefined {
  return VISUAL_STYLE_PRESETS.find(s => s.id === id);
}

export function getStylesByCategory(category: string): VisualStylePreset[] {
  return VISUAL_STYLE_PRESETS.filter(s => s.category === category);
}
