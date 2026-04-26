export const SCENE_REFERENCE_ASSET_TYPE = "scene_reference";

export interface SceneReferenceAssetMetadata {
  sceneId: string;
  note?: string;
  kind?: "manual" | "prop" | "accessory" | "moodboard" | "team";
  promptAppliedAt?: string | null;
}

export interface SceneReferenceAsset {
  id: string;
  name: string;
  url: string | null;
  createdAt: string;
  metadata: SceneReferenceAssetMetadata;
}

type RawAsset = {
  id: string;
  type: string;
  name: string;
  url?: string | null;
  prompt?: string | null;
  createdAt?: string | Date;
};

function parseMetadata(prompt?: string | null): SceneReferenceAssetMetadata | null {
  if (!prompt) return null;

  try {
    const parsed = JSON.parse(prompt) as Partial<SceneReferenceAssetMetadata>;
    if (!parsed.sceneId) return null;
    return {
      sceneId: parsed.sceneId,
      note: parsed.note || "",
      kind: parsed.kind || "manual",
      promptAppliedAt: parsed.promptAppliedAt || null,
    };
  } catch {
    return null;
  }
}

function toIsoString(value?: string | Date): string {
  if (!value) return new Date(0).toISOString();
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
}

export function serializeSceneReferenceMetadata(metadata: SceneReferenceAssetMetadata): string {
  return JSON.stringify({
    sceneId: metadata.sceneId,
    note: metadata.note || "",
    kind: metadata.kind || "manual",
    promptAppliedAt: metadata.promptAppliedAt || null,
  });
}

export function getSceneReferenceKindLabel(kind?: SceneReferenceAssetMetadata["kind"]): string {
  switch (kind) {
    case "prop":
    case "accessory":
      return "Accessoire";
    case "team":
      return "Equipe";
    case "moodboard":
      return "Moodboard";
    default:
      return "Scene";
  }
}

export function getSceneReferenceAssets(assets: RawAsset[], sceneId?: string): SceneReferenceAsset[] {
  return assets
    .filter((asset) => asset.type === SCENE_REFERENCE_ASSET_TYPE)
    .map((asset) => {
      const metadata = parseMetadata(asset.prompt);
      if (!metadata) return null;
      return {
        id: asset.id,
        name: asset.name,
        url: asset.url || null,
        createdAt: toIsoString(asset.createdAt),
        metadata,
      };
    })
    .filter((asset): asset is SceneReferenceAsset => Boolean(asset))
    .filter((asset) => !sceneId || asset.metadata.sceneId === sceneId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function sceneReferencesNeedPromptRefresh(references: SceneReferenceAsset[]): boolean {
  return references.some((reference) => {
    const appliedAt = reference.metadata.promptAppliedAt ? new Date(reference.metadata.promptAppliedAt) : null;
    const createdAt = new Date(reference.createdAt);
    if (!appliedAt || Number.isNaN(appliedAt.getTime())) return true;
    if (Number.isNaN(createdAt.getTime())) return true;
    return appliedAt.getTime() < createdAt.getTime();
  });
}

export function buildSceneReferencePromptNotes(references: SceneReferenceAsset[]): string[] {
  return references.map((reference, index) => {
    const suffix = reference.metadata.note?.trim()
      ? ` — note: ${reference.metadata.note.trim()}`
      : "";
    const kindLabel = getSceneReferenceKindLabel(reference.metadata.kind);
    return `${kindLabel} reference ${index + 1}: ${reference.name}${suffix}`;
  });
}

export function buildSceneReferencePromptBlock(references: SceneReferenceAsset[]): string {
  if (references.length === 0) return "";

  return [
    "MANUAL SCENE REFERENCES:",
    ...buildSceneReferencePromptNotes(references).map((line) => `- ${line}`),
    "Treat these uploaded scene images as mandatory visual guidance for staging, props/accessories, team composition, framing, styling, outfit accuracy, and environment continuity.",
  ].join("\n");
}
