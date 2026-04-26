export const CHARACTER_GROUP_ASSET_TYPE = "character_group";

export interface CharacterGroupMetadata {
  category: string;
  description?: string;
  members: string[];
  keywords?: string[];
}

export interface CharacterGroupAsset {
  id: string;
  name: string;
  url?: string | null;
  metadata: CharacterGroupMetadata;
}

type RawAsset = {
  id: string;
  type: string;
  name: string;
  url?: string | null;
  prompt?: string | null;
};

function parseMetadata(prompt?: string | null): CharacterGroupMetadata {
  if (!prompt) {
    return { category: "group", members: [] };
  }

  try {
    const parsed = JSON.parse(prompt) as Partial<CharacterGroupMetadata>;
    return {
      category: parsed.category || "group",
      description: parsed.description || "",
      members: Array.isArray(parsed.members) ? parsed.members.filter(Boolean) : [],
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.filter(Boolean) : [],
    };
  } catch {
    return {
      category: "group",
      description: prompt,
      members: [],
      keywords: [],
    };
  }
}

export function getCharacterGroupAssets(assets: RawAsset[]): CharacterGroupAsset[] {
  return assets
    .filter((asset) => asset.type === CHARACTER_GROUP_ASSET_TYPE)
    .map((asset) => ({
      id: asset.id,
      name: asset.name,
      url: asset.url || null,
      metadata: parseMetadata(asset.prompt),
    }));
}

export function serializeCharacterGroupMetadata(metadata: CharacterGroupMetadata): string {
  return JSON.stringify({
    category: metadata.category,
    description: metadata.description || "",
    members: metadata.members,
    keywords: metadata.keywords || [],
  });
}

export function matchGroupAssetsForScene(params: {
  groups: CharacterGroupAsset[];
  sceneCharacters: string[];
  sceneText: string;
}): CharacterGroupAsset[] {
  const normalizedText = params.sceneText.toLowerCase();

  return params.groups
    .map((group) => {
      const memberMatches = group.metadata.members.filter((member) =>
        params.sceneCharacters.some((name) => name.toLowerCase().includes(member.toLowerCase()))
      ).length;
      const nameMatch = normalizedText.includes(group.name.toLowerCase());
      const keywordMatch = (group.metadata.keywords || []).some((keyword) =>
        normalizedText.includes(keyword.toLowerCase())
      );
      const categoryMatch = group.metadata.category
        ? normalizedText.includes(group.metadata.category.toLowerCase())
        : false;

      const score =
        (nameMatch ? 100 : 0) +
        (keywordMatch ? 60 : 0) +
        (categoryMatch ? 30 : 0) +
        (memberMatches >= 2 ? 50 + memberMatches : memberMatches);

      return { group, score };
    })
    .filter((item) => item.score > 0 && item.group.url)
    .sort((left, right) => right.score - left.score)
    .map((item) => item.group);
}
