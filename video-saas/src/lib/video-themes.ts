export const VIDEO_THEMES = [
  { key: "PIXAR_3D", label: "Pixar 3D", description: "3D stylise chaleureux et expressif" },
  { key: "ANIME", label: "Anime", description: "anime dynamique, traits nets, emotions fortes" },
  { key: "CINEMATIC", label: "Cinematique", description: "rendu filmique avec lumiere dramatique" },
  { key: "FRUIT_DRAMA", label: "Fruit Drama", description: "fruits anthropomorphes avec drama intense" },
  { key: "CARTOON_2D", label: "Dessin anime 2D", description: "2D colore lisible et energique" },
  { key: "REALISTIC", label: "Realiste", description: "textures naturelles et detail physique" },
  { key: "LOW_POLY", label: "Low Poly", description: "formes geometriques propres stylisees" },
  { key: "STOP_MOTION", label: "Stop Motion", description: "look maquette artisanale image par image" },
  { key: "SCI_FI_NEON", label: "Sci-Fi Neon", description: "futurisme neon et ambiance cyberpunk" },
  { key: "DOCUMENTARY", label: "Documentaire anime", description: "camera observation et narration informative" },
] as const;

export type VideoThemeKey = (typeof VIDEO_THEMES)[number]["key"];

export const styleThemes = VIDEO_THEMES.map((theme) => theme.key) as [
  VideoThemeKey,
  ...VideoThemeKey[],
];

export const STYLE_LABELS: Record<VideoThemeKey, string> = Object.fromEntries(
  VIDEO_THEMES.map((theme) => [theme.key, theme.label]),
) as Record<VideoThemeKey, string>;

export const STYLE_DESCRIPTIONS: Record<VideoThemeKey, string> = Object.fromEntries(
  VIDEO_THEMES.map((theme) => [theme.key, theme.description]),
) as Record<VideoThemeKey, string>;
