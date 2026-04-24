import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function enhanceVideoPrompt(params: {
  basePrompt: string;
  visualStyle: string;
  format: string;
  sceneAction: string;
}): Promise<string> {
  const { basePrompt, visualStyle, format, sceneAction } = params;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: `Enhance this video generation prompt to be more cinematic and dynamic for ${visualStyle} style in ${format} format.
Scene action: ${sceneAction}
Base prompt: ${basePrompt}

Return only the enhanced prompt text, no explanation.`,
      },
    ],
    temperature: 0.7,
  });

  return response.choices[0].message.content || basePrompt;
}
