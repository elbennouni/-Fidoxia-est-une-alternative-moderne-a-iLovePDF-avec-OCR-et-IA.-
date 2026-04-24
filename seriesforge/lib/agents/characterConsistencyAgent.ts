export interface CharacterData {
  name: string;
  physicalDescription: string;
  outfit: string;
  personality: string;
  consistencyPrompt: string;
}

export function buildConsistencyPrompt(character: {
  name: string;
  physicalDescription: string;
  outfit: string;
  personality: string;
}): string {
  return `Always keep this exact character identity: ${character.name}, ${character.physicalDescription}, ${character.outfit}, personality: ${character.personality}. Never change face, outfit, age, body type or visual identity.`;
}

export function injectCharactersIntoPrompt(
  prompt: string,
  sceneCharacters: string[],
  allCharacters: CharacterData[]
): string {
  const presentChars = allCharacters.filter(c =>
    sceneCharacters.some(sc => sc.toLowerCase().includes(c.name.toLowerCase()))
  );

  if (presentChars.length === 0) return prompt;

  const consistencyBlock = presentChars
    .map(c => `[${c.name}]: ${c.consistencyPrompt}`)
    .join(" | ");

  return `${prompt}\n\nCHARACTER CONSISTENCY LOCKS:\n${consistencyBlock}`;
}

export function getCharacterDescriptionsBlock(
  sceneCharacters: string[],
  allCharacters: CharacterData[]
): string {
  const presentChars = allCharacters.filter(c =>
    sceneCharacters.some(sc => sc.toLowerCase().includes(c.name.toLowerCase()))
  );

  return presentChars
    .map(c => `- ${c.name}: ${c.physicalDescription}, wearing ${c.outfit}`)
    .join("\n");
}
