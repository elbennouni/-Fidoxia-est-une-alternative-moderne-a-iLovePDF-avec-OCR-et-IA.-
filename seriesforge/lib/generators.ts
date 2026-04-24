export interface ImageGenerator {
  id: string;
  name: string;
  provider: string;
  model: string;
  description: string;
  pricePerImage: number;
  quality: "low" | "medium" | "high" | "ultra";
  speed: "slow" | "medium" | "fast" | "instant";
  supportsImgToImg: boolean;
  supportsReference: boolean;
  style: "realistic" | "artistic" | "3d" | "any";
  free: boolean;
  badge?: string;
  apiKey: string;
  replicateModel?: string;
}

export interface VideoGenerator {
  id: string;
  name: string;
  provider: string;
  description: string;
  pricePer5s: number;
  pricePer10s: number;
  quality: "low" | "medium" | "high" | "ultra";
  maxDuration: number;
  supportsImgToVideo: boolean;
  badge?: string;
  url: string;
}

export const IMAGE_GENERATORS: ImageGenerator[] = [
  {
    id: "dalle3-hd",
    name: "DALL-E 3 HD",
    provider: "OpenAI",
    model: "dall-e-3",
    description: "Meilleure compréhension des prompts complexes, cohérence narrative",
    pricePerImage: 0.080,
    quality: "high",
    speed: "medium",
    supportsImgToImg: false,
    supportsReference: false,
    style: "any",
    free: false,
    badge: "Recommandé",
    apiKey: "OPENAI_API_KEY",
  },
  {
    id: "dalle3-standard",
    name: "DALL-E 3 Standard",
    provider: "OpenAI",
    model: "dall-e-3",
    description: "Bonne qualité, moins cher que HD",
    pricePerImage: 0.040,
    quality: "medium",
    speed: "medium",
    supportsImgToImg: false,
    supportsReference: false,
    style: "any",
    free: false,
    apiKey: "OPENAI_API_KEY",
  },
  {
    id: "flux-schnell",
    name: "FLUX Schnell",
    provider: "Replicate",
    model: "black-forest-labs/flux-schnell",
    description: "Gratuit, ultra rapide, bonne qualité. Pas img2img.",
    pricePerImage: 0.003,
    quality: "medium",
    speed: "instant",
    supportsImgToImg: false,
    supportsReference: false,
    style: "any",
    free: true,
    badge: "Gratuit",
    apiKey: "REPLICATE_API_TOKEN",
    replicateModel: "black-forest-labs/flux-schnell",
  },
  {
    id: "flux-dev",
    name: "FLUX Dev",
    provider: "Replicate",
    model: "black-forest-labs/flux-dev",
    description: "Haute qualité, img2img disponible — cohérence personnages",
    pricePerImage: 0.025,
    quality: "high",
    speed: "medium",
    supportsImgToImg: true,
    supportsReference: true,
    style: "any",
    free: false,
    badge: "img2img",
    apiKey: "REPLICATE_API_TOKEN",
    replicateModel: "black-forest-labs/flux-dev",
  },
  {
    id: "flux-pro",
    name: "FLUX Pro",
    provider: "Replicate / Fal.ai",
    model: "black-forest-labs/flux-1.1-pro",
    description: "Qualité maximale, détails ultra précis, img2img avancé",
    pricePerImage: 0.055,
    quality: "ultra",
    speed: "medium",
    supportsImgToImg: true,
    supportsReference: true,
    style: "any",
    free: false,
    badge: "Ultra",
    apiKey: "FAL_API_KEY",
    replicateModel: "black-forest-labs/flux-1.1-pro",
  },
  {
    id: "sdxl",
    name: "Stable Diffusion XL",
    provider: "Replicate",
    model: "stability-ai/sdxl",
    description: "Classique, très populaire, img2img excellent pour cohérence",
    pricePerImage: 0.008,
    quality: "medium",
    speed: "medium",
    supportsImgToImg: true,
    supportsReference: true,
    style: "any",
    free: false,
    apiKey: "REPLICATE_API_TOKEN",
    replicateModel: "stability-ai/sdxl",
  },
  {
    id: "playground-v3",
    name: "Playground v3",
    provider: "Replicate",
    model: "playgroundai/playground-v2.5-1024px-aesthetic",
    description: "Excellent pour style artistique et animé, très esthétique",
    pricePerImage: 0.012,
    quality: "high",
    speed: "fast",
    supportsImgToImg: false,
    supportsReference: false,
    style: "artistic",
    free: false,
    apiKey: "REPLICATE_API_TOKEN",
    replicateModel: "playgroundai/playground-v2.5-1024px-aesthetic",
  },
  {
    id: "ideogram-v2",
    name: "Ideogram v2",
    provider: "Replicate",
    model: "ideogram-ai/ideogram-v2",
    description: "Excellent pour Pixar 3D et animation, gestion texte dans images",
    pricePerImage: 0.080,
    quality: "ultra",
    speed: "medium",
    supportsImgToImg: false,
    supportsReference: false,
    style: "3d",
    free: false,
    badge: "Pixar 3D",
    apiKey: "REPLICATE_API_TOKEN",
    replicateModel: "ideogram-ai/ideogram-v2",
  },
];

export const VIDEO_GENERATORS: VideoGenerator[] = [
  {
    id: "kling-15-std",
    name: "Kling AI 1.5 Standard",
    provider: "Kling AI",
    description: "Meilleur pour animation de personnages, mouvements naturels",
    pricePer5s: 0.28,
    pricePer10s: 0.56,
    quality: "high",
    maxDuration: 10,
    supportsImgToVideo: true,
    badge: "Recommandé",
    url: "https://klingai.com",
  },
  {
    id: "kling-15-pro",
    name: "Kling AI 1.5 Pro",
    provider: "Kling AI",
    description: "Qualité cinématique, idéal pour scènes épiques",
    pricePer5s: 0.70,
    pricePer10s: 1.40,
    quality: "ultra",
    maxDuration: 10,
    supportsImgToVideo: true,
    badge: "Cinéma",
    url: "https://klingai.com",
  },
  {
    id: "seedance-1",
    name: "SeedDance 1.0",
    provider: "ByteDance",
    description: "Excellent pour chorégraphies et danses, très fluide",
    pricePer5s: 0.35,
    pricePer10s: 0.70,
    quality: "high",
    maxDuration: 10,
    supportsImgToVideo: true,
    badge: "Nouveau",
    url: "https://seedance.ai",
  },
  {
    id: "runway-gen3",
    name: "Runway Gen-3 Alpha",
    provider: "Runway ML",
    description: "Fidèle à l'image de référence, transitions fluides",
    pricePer5s: 0.25,
    pricePer10s: 0.50,
    quality: "high",
    maxDuration: 10,
    supportsImgToVideo: true,
    url: "https://runwayml.com",
  },
  {
    id: "luma-ray2",
    name: "Luma Ray 2",
    provider: "Luma AI",
    description: "Rendu 3D photoréaliste, excellent pour décors",
    pricePer5s: 0.42,
    pricePer10s: 0.84,
    quality: "ultra",
    maxDuration: 9,
    supportsImgToVideo: true,
    badge: "3D",
    url: "https://lumalabs.ai",
  },
  {
    id: "minimax-video",
    name: "MiniMax Video-01",
    provider: "MiniMax",
    description: "Excellent rapport qualité/prix, cohérence personnages",
    pricePer5s: 0.18,
    pricePer10s: 0.36,
    quality: "medium",
    maxDuration: 6,
    supportsImgToVideo: true,
    badge: "Économique",
    url: "https://minimax.io",
  },
  {
    id: "wan-replicate",
    name: "Wan 2.1 (Replicate)",
    provider: "Wan / Replicate",
    description: "Open-source, bon marché, img2video depuis Replicate",
    pricePer5s: 0.08,
    pricePer10s: 0.16,
    quality: "medium",
    maxDuration: 10,
    supportsImgToVideo: true,
    badge: "Pas cher",
    url: "https://replicate.com",
  },
];

export function getDefaultImageGenerator(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("sf_default_img_gen") || "dalle3-hd";
  }
  return "dalle3-hd";
}

export function setDefaultImageGenerator(id: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("sf_default_img_gen", id);
  }
}

export function getDefaultVideoGenerator(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("sf_default_vid_gen") || "kling-15-std";
  }
  return "kling-15-std";
}

export function setDefaultVideoGenerator(id: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("sf_default_vid_gen", id);
  }
}
