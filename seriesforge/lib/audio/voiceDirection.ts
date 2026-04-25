export interface VoiceDirection {
  speed: number;
  style: number;
  stability: number;
  similarityBoost: number;
  useSpeakerBoost: boolean;
  label: string;
}

function normalize(text: string): string {
  return text.toLowerCase();
}

export function inferVoiceDirection(params: {
  text: string;
  emotion?: string | null;
  audioPrompt?: string | null;
  voiceProfile?: string | null;
}): VoiceDirection {
  const haystack = normalize([
    params.text,
    params.emotion || "",
    params.audioPrompt || "",
    params.voiceProfile || "",
  ].join(" "));

  const exclamationCount = (params.text.match(/!/g) || []).length;
  const questionCount = (params.text.match(/\?/g) || []).length;

  if (/(whisper|chuchot|murmur|secret|à voix basse)/.test(haystack)) {
    return {
      speed: 0.88,
      style: 0.12,
      stability: 0.72,
      similarityBoost: 0.86,
      useSpeakerBoost: true,
      label: "whisper",
    };
  }

  if (/(cry|pleur|sanglot|sad|triste|fragile|ému|emotional)/.test(haystack)) {
    return {
      speed: 0.93,
      style: 0.58,
      stability: 0.5,
      similarityBoost: 0.86,
      useSpeakerBoost: true,
      label: "crying",
    };
  }

  if (/(shout|scream|crie|hurle|hurlement|furieux|anger|colère|panique|panic)/.test(haystack) || exclamationCount >= 2) {
    return {
      speed: 1.12,
      style: 0.82,
      stability: 0.34,
      similarityBoost: 0.88,
      useSpeakerBoost: true,
      label: "shouting",
    };
  }

  if (/(urgent|vite|cours|danger|alarme|stress)/.test(haystack) || questionCount >= 2) {
    return {
      speed: 1.08,
      style: 0.46,
      stability: 0.42,
      similarityBoost: 0.84,
      useSpeakerBoost: true,
      label: "urgent",
    };
  }

  if (/(menace|froid|calme tendu|intense|grave|authoritative|autoritaire)/.test(haystack)) {
    return {
      speed: 0.98,
      style: 0.34,
      stability: 0.62,
      similarityBoost: 0.9,
      useSpeakerBoost: true,
      label: "tense",
    };
  }

  return {
    speed: 1.0,
    style: 0.22,
    stability: 0.55,
    similarityBoost: 0.84,
    useSpeakerBoost: true,
    label: "neutral",
  };
}
