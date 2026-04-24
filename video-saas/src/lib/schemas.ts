import { z } from "zod";
import { styleThemes } from "@/lib/video-themes";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z.string().min(8).max(120),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(120),
});

export const createSeriesSchema = z.object({
  title: z.string().trim().min(2).max(120),
  style: z.enum(styleThemes),
  format: z.enum(["VERTICAL_9_16", "HORIZONTAL_16_9"]),
  defaultDuration: z.number().int().min(15).max(1200),
  tone: z.string().trim().min(2).max(80),
});

export const createEpisodeSchema = z.object({
  title: z.string().trim().min(2).max(120),
  episodeNumber: z.number().int().min(1).max(9999),
});

export const createCharacterSchema = z.object({
  name: z.string().trim().min(2).max(120),
  physicalDescription: z.string().trim().min(15).max(800),
  outfit: z.string().trim().min(10).max(500),
  personality: z.string().trim().min(10).max(500),
  voiceProvider: z.enum(["HEYGEN", "FALLBACK"]),
  voiceConfig: z.string().trim().min(2).max(500),
  referenceImage: z.string().url().optional().or(z.literal("")),
  consistencyId: z.string().trim().min(2).max(100),
});

export const createEnvironmentSchema = z.object({
  locationName: z.string().trim().min(2).max(120),
  visualDescription: z.string().trim().min(15).max(800),
  lighting: z.string().trim().min(2).max(120),
  mood: z.string().trim().min(2).max(120),
  reusable: z.boolean(),
});

export const generateStorySchema = z.object({
  brief: z.string().trim().min(20).max(3000),
  sceneCount: z.number().int().min(1).max(12),
});

export const generateStoryboardSchema = z.object({
  imageProvider: z.string().trim().min(2).max(80).default("placeholder-image-ai"),
});

export const generateAudioSchema = z.object({
  voiceProvider: z.enum(["HEYGEN", "FALLBACK"]).default("FALLBACK"),
  musicStyle: z.string().trim().min(2).max(120),
  sfxStyle: z.string().trim().min(2).max(120),
});

export const validateAudioSchema = z.object({
  sceneId: z.string().cuid().optional(),
  validateAll: z.boolean().default(true),
});

export const generateVideoSchema = z.object({
  provider: z.enum(["KLING", "REPLICATE", "OTHER"]),
  format: z.enum(["VERTICAL_9_16", "HORIZONTAL_16_9"]).optional(),
  durationSecPerScene: z.number().int().min(2).max(40).default(6),
});

export const createAssetSchema = z.object({
  seriesId: z.string().cuid().optional(),
  type: z.enum(["INTRO", "OUTRO", "RECURRING_SCENE", "TRANSITION", "MUSIC", "SFX"]),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(2).max(400),
  fileUrl: z.string().url(),
  reusable: z.boolean().default(true),
  metadata: z.string().max(1000).optional(),
});
