"use client";

import { useState, useEffect, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Image,
  CheckCircle,
  Loader2,
  Copy,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Eye,
  Users,
  MapPin,
  Mic,
  X,
} from "lucide-react";
import { IMAGE_GENERATORS } from "@/lib/generators";

interface ImageHistoryEntry {
  url: string;
  generator: string;
  createdAt: string;
}

interface CharacterRef {
  id: string;
  name: string;
  referenceImageUrl?: string | null;
  visualDNA?: string | null;
}

interface EnvironmentRef {
  id: string;
  name: string;
  previewImageUrl?: string | null;
}

interface Scene {
  id: string;
  sceneNumber: number;
  timecode?: string;
  location?: string;
  action?: string;
  emotion?: string;
  imagePrompt?: string;
  videoPrompt?: string;
  imageUrl?: string;
  imageHistory?: string | null;
  charactersJson?: string;
  dialogue?: string | null;
  narration?: string | null;
  audioPrompt?: string | null;
  voiceUrl?: string | null;
  qualityScore?: number;
  status: string;
  validatedByUser: boolean;
}

interface EpisodePayload {
  title: string;
  format: string;
  series: {
    characters: CharacterRef[];
    environments: EnvironmentRef[];
  };
  scenes: Scene[];
}

function parseJsonArray(value?: string | null): string[] {
  try {
    return JSON.parse(value || "[]");
  } catch {
    return [];
  }
}

function getSceneHistory(scene: Scene): ImageHistoryEntry[] {
  try {
    return JSON.parse(scene.imageHistory || "[]");
  } catch {
    return [];
  }
}

function guessSceneGenerator(scene: Scene): string {
  const charNames = parseJsonArray(scene.charactersJson);
  if (charNames.length > 1) return "nano-banana-pro";
  return "ideogram-character";
}

function sceneHasDialogue(scene: Scene): boolean {
  return Boolean(scene.dialogue?.trim());
}

export default function StoryboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [characters, setCharacters] = useState<CharacterRef[]>([]);
  const [environments, setEnvironments] = useState<EnvironmentRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingSceneId, setGeneratingSceneId] = useState<string | null>(null);
  const [selectedGenerators, setSelectedGenerators] = useState<Record<string, string>>({});
  const [openPromptSceneId, setOpenPromptSceneId] = useState<string | null>(null);
  const [openHistorySceneId, setOpenHistorySceneId] = useState<string | null>(null);
  const [openGeneratorSceneId, setOpenGeneratorSceneId] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, [id]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/episodes/${id}`);
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json() as EpisodePayload;
      setEpisodeTitle(data.title);
      setScenes(data.scenes || []);
      setCharacters(data.series?.characters || []);
      setEnvironments(data.series?.environments || []);
      setSelectedGenerators((prev) => {
        const next = { ...prev };
        for (const scene of data.scenes || []) {
          if (!next[scene.id]) next[scene.id] = guessSceneGenerator(scene);
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copié");
  }

  function getSceneCharacters(scene: Scene): CharacterRef[] {
    const names = parseJsonArray(scene.charactersJson);
    return characters.filter((char) =>
      names.some((name) => name.toLowerCase().includes(char.name.toLowerCase()))
    );
  }

  function getSceneEnvironment(scene: Scene): EnvironmentRef | undefined {
    return environments.find((env) =>
      scene.location?.toLowerCase().includes(env.name.toLowerCase())
    ) || environments[0];
  }

  const validated = scenes.filter((s) => s.validatedByUser).length;

  async function regenerateScene(scene: Scene) {
    const generatorId = selectedGenerators[scene.id] || guessSceneGenerator(scene);
    setGeneratingSceneId(scene.id);
    const t = toast.loading(`Regénération scène ${scene.sceneNumber} avec ${generatorId}...`);
    try {
      const isNano = generatorId === "nano-banana-pro" || generatorId === "nano-banana";
      const isCharacterRoute = ["ideogram-character", "instant-character", "minimax-subject"].includes(generatorId);
      let endpoint = "/api/generate/scene-with-generator";
      let body: Record<string, unknown> = { sceneId: scene.id, generatorId };

      if (isNano) {
        endpoint = "/api/generate/nano-banana";
        body = { sceneId: scene.id, model: generatorId };
      } else if (isCharacterRoute) {
        endpoint = "/api/generate/scene-character-consistent";
        body = { sceneId: scene.id, model: generatorId };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Regénération échouée");
      toast.dismiss(t);
      toast.success(`Scène ${scene.sceneNumber} mise à jour`);
      await fetchData();
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Regénération échouée");
    } finally {
      setGeneratingSceneId(null);
    }
  }

  async function restoreImage(sceneId: string, imageUrl: string, historyIndex: number) {
    try {
      const res = await fetch(`/api/scenes/${sceneId}/restore-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, historyIndex }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Restauration échouée");
      toast.success("Image restaurée");
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Restauration échouée");
    }
  }

  const promptScene = useMemo(
    () => scenes.find((scene) => scene.id === openPromptSceneId) || null,
    [openPromptSceneId, scenes]
  );

  const historyScene = useMemo(
    () => scenes.find((scene) => scene.id === openHistorySceneId) || null,
    [openHistorySceneId, scenes]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {promptScene && (
        <PromptModal
          scene={promptScene}
          characters={getSceneCharacters(promptScene)}
          environment={getSceneEnvironment(promptScene)}
          onClose={() => setOpenPromptSceneId(null)}
          onCopy={copyText}
        />
      )}

      {historyScene && (
        <HistoryModal
          scene={historyScene}
          history={getSceneHistory(historyScene)}
          onClose={() => setOpenHistorySceneId(null)}
          onRestore={restoreImage}
        />
      )}

      <div className="mb-6">
        <Link href={`/episodes/${id}/editor`} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" /> Retour à l&apos;éditeur
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Image className="w-7 h-7 text-blue-400" /> Storyboard
            </h1>
            <p className="text-gray-400 mt-1">{episodeTitle}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-gray-400">{validated}/{scenes.length} validées</span>
            <span className="text-xs px-2 py-1 bg-[#1e1e2e] border border-[#2a2a3e] rounded-full text-gray-400">
              Réaction rapide par scène
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>
      ) : scenes.length === 0 ? (
        <div className="text-center py-16 bg-[#13131a] border border-dashed border-[#2a2a3e] rounded-2xl">
          <Image className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Lancez d&apos;abord le pipeline de l&apos;épisode pour générer le storyboard</p>
          <Link href={`/episodes/${id}/editor`} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all">
            Aller à l&apos;éditeur
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {scenes.map((scene) => {
            const sceneCharacters = getSceneCharacters(scene);
            const history = getSceneHistory(scene);
            const generatorId = selectedGenerators[scene.id] || guessSceneGenerator(scene);
            const generator = IMAGE_GENERATORS.find((item) => item.id === generatorId) || IMAGE_GENERATORS[0];
            const multiChar = sceneCharacters.length > 1;
            const env = getSceneEnvironment(scene);
            const allRefsReady = sceneCharacters.every((char) => Boolean(char.referenceImageUrl));
            const needsVoiceForLipsync = sceneHasDialogue(scene);

            return (
              <div key={scene.id} className={`bg-[#13131a] border rounded-2xl overflow-hidden ${scene.validatedByUser ? "border-green-500/50" : "border-[#2a2a3e]"}`}>
                <div className="aspect-[9/16] bg-[#1e1e2e] relative flex items-center justify-center overflow-hidden">
                  {scene.imageUrl ? (
                    <img src={scene.imageUrl} alt={`Scene ${scene.sceneNumber}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4">
                      <Image className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">Prompt prêt</p>
                      <p className="text-xs text-gray-600">Regénérer directement ici</p>
                    </div>
                  )}

                  <div className="absolute top-2 left-2 flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-black/70 text-white">
                      Scène {scene.sceneNumber}
                    </span>
                    {scene.qualityScore && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${scene.qualityScore >= 85 ? "bg-green-900/80 text-green-300" : "bg-yellow-900/80 text-yellow-300"}`}>
                        {scene.qualityScore}
                      </span>
                    )}
                  </div>

                  <div className="absolute top-2 right-2 flex items-center gap-2">
                    {scene.validatedByUser && (
                      <div className="p-1 bg-green-600 rounded-full">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                    )}
                    {history.length > 0 && (
                      <button
                        onClick={() => setOpenHistorySceneId(scene.id)}
                        className="px-2 py-1 bg-black/70 hover:bg-black/90 text-white text-xs rounded-lg border border-white/10"
                      >
                        {history.length} histo
                      </button>
                    )}
                  </div>

                  {history.length > 0 && (
                    <div className="absolute bottom-2 left-2 right-2">
                      <div className="flex gap-1 overflow-x-auto">
                        {history.slice(0, 4).map((entry, idx) => (
                          <button
                            key={`${entry.url}-${idx}`}
                            onClick={() => setOpenHistorySceneId(scene.id)}
                            className="w-14 h-14 rounded-lg overflow-hidden border border-white/10 bg-black/70 flex-shrink-0"
                            title={entry.generator}
                          >
                    <img src={entry.url} alt={`Historique ${idx + 1}`} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {scene.location && <p className="text-xs text-gray-400">📍 {scene.location}</p>}
                      {scene.action && <p className="text-sm text-white mt-1 line-clamp-2">{scene.action}</p>}
                      {scene.emotion && <p className="text-xs text-gray-500 italic mt-1">{scene.emotion}</p>}
                    </div>
                    {scene.timecode && <span className="text-xs text-gray-500">{scene.timecode}</span>}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${multiChar ? "bg-orange-600/20 border-orange-600/30 text-orange-300" : "bg-blue-600/20 border-blue-600/30 text-blue-300"}`}>
                      <Users className="inline w-3 h-3 mr-1" />
                      {sceneCharacters.length || 0} perso
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full border bg-[#1e1e2e] border-[#2a2a3e] text-gray-400">
                      <MapPin className="inline w-3 h-3 mr-1" />
                      {env?.name || "Décor"}
                    </span>
                    {needsVoiceForLipsync && (
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${scene.voiceUrl ? "bg-green-600/20 border-green-600/30 text-green-300" : "bg-red-600/20 border-red-600/30 text-red-300"}`}>
                        <Mic className="inline w-3 h-3 mr-1" />
                        {scene.voiceUrl ? "audio lipsync prêt" : "audio lipsync manquant"}
                      </span>
                    )}
                  </div>

                  <div className="rounded-xl border border-[#2a2a3e] bg-[#1e1e2e] p-3">
                    <button
                      onClick={() => setOpenGeneratorSceneId(openGeneratorSceneId === scene.id ? null : scene.id)}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Moteur image</p>
                        <p className="text-sm text-white">{generator.name}</p>
                        <p className="text-xs text-gray-500 mt-1">{generator.multiCharacterSafe ? "OK multi-personnages" : "Solo / un visage"}</p>
                      </div>
                      {openGeneratorSceneId === scene.id ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                    </button>

                    {openGeneratorSceneId === scene.id && (
                      <div className="mt-3 space-y-2 max-h-64 overflow-y-auto pr-1">
                        {IMAGE_GENERATORS.map((item) => {
                          const disabledForScene = multiChar && !item.multiCharacterSafe;
                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                if (disabledForScene) {
                                  toast.error("Moteur non fiable pour une scène multi-personnages");
                                  return;
                                }
                                setSelectedGenerators((prev) => ({ ...prev, [scene.id]: item.id }));
                                setOpenGeneratorSceneId(null);
                              }}
                              className={`w-full text-left p-2 rounded-xl border transition-all ${
                                generatorId === item.id
                                  ? "border-purple-500/50 bg-purple-600/10"
                                  : disabledForScene
                                    ? "border-red-900/30 bg-red-900/10 opacity-60"
                                    : "border-[#2a2a3e] bg-[#13131a] hover:border-purple-500/30"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm text-white">{item.name}</span>
                                <span className="text-xs text-yellow-400">~${item.pricePerImage.toFixed(3)}</span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => regenerateScene(scene)}
                      disabled={generatingSceneId === scene.id || (multiChar && !allRefsReady)}
                      className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-3 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-all"
                    >
                      {generatingSceneId === scene.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      {scene.imageUrl ? "Regénérer" : "Générer"}
                    </button>
                    <button
                      onClick={() => setOpenPromptSceneId(scene.id)}
                      className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[#1e1e2e] border border-[#2a2a3e] hover:border-blue-500/50 text-gray-300 text-sm rounded-xl transition-all"
                    >
                      <Eye className="w-4 h-4" /> Prompt
                    </button>
                    {scene.imagePrompt && (
                      <button
                        onClick={() => copyText(scene.imagePrompt!)}
                        className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[#1e1e2e] border border-[#2a2a3e] hover:border-purple-500/50 text-gray-300 text-sm rounded-xl transition-all"
                      >
                        <Copy className="w-4 h-4" /> Copier
                      </button>
                    )}
                  </div>

                  {multiChar && !allRefsReady && (
                    <p className="text-xs text-red-300">
                      Ajoutez une photo de référence pour chaque personnage avant génération multi-personnages.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PromptModal({
  scene,
  characters,
  environment,
  onClose,
  onCopy,
}: {
  scene: Scene;
  characters: CharacterRef[];
  environment?: EnvironmentRef;
  onClose: () => void;
  onCopy: (text: string) => void;
}) {
  const characterNames = parseJsonArray(scene.charactersJson);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#13131a] border border-[#2a2a3e] rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a3e]">
          <div>
            <h2 className="text-xl font-bold text-white">Prompt complet — Scène {scene.sceneNumber}</h2>
            <p className="text-sm text-gray-400 mt-1">Vue exacte des éléments utilisés pour générer un plan cohérent.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] max-h-[calc(90vh-84px)]">
          <div className="border-r border-[#2a2a3e] p-5 overflow-y-auto space-y-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Références personnages</p>
              <div className="grid grid-cols-2 gap-3">
                {characters.map((char) => (
                  <div key={char.id} className="rounded-xl border border-[#2a2a3e] bg-[#1e1e2e] overflow-hidden">
                    <div className="aspect-square bg-[#11111a] flex items-center justify-center overflow-hidden">
                      {char.referenceImageUrl ? (
                        <img src={char.referenceImageUrl} alt={char.name} className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-6 h-6 text-gray-600" />
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium text-white truncate">{char.name}</p>
                      <p className="text-[11px] text-gray-500">{char.visualDNA ? "ADN visuel" : "sans ADN"}</p>
                    </div>
                  </div>
                ))}
                {characters.length === 0 && (
                  <p className="text-sm text-gray-500 col-span-2">Aucun personnage référencé.</p>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Décor / accessoire</p>
              <div className="rounded-xl border border-[#2a2a3e] bg-[#1e1e2e] overflow-hidden">
                <div className="aspect-video bg-[#11111a] flex items-center justify-center overflow-hidden">
                  {environment?.previewImageUrl ? (
                    <img src={environment.previewImageUrl} alt={environment.name} className="w-full h-full object-cover" />
                  ) : (
                    <MapPin className="w-6 h-6 text-gray-600" />
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-white">{environment?.name || scene.location || "Décor"}</p>
                  <p className="text-xs text-gray-500 mt-1">Ajoutez ici aussi un totem, un accessoire ou un visuel de props quand nécessaire.</p>
                </div>
              </div>
            </div>

            {scene.voiceUrl && (
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Audio lipsync</p>
                <div className="rounded-xl border border-green-600/30 bg-green-900/10 p-3">
                  <p className="text-sm text-green-300 mb-2">Audio disponible pour synchronisation labiale</p>
                  <audio controls src={scene.voiceUrl} className="w-full h-10" />
                </div>
              </div>
            )}

            {!scene.voiceUrl && sceneHasDialogue(scene) && (
              <div className="rounded-xl border border-orange-600/30 bg-orange-900/10 p-3">
                <p className="text-sm text-orange-300">Dialogue détecté, mais aucun audio n’est encore prêt pour la lipsync.</p>
              </div>
            )}
          </div>

          <div className="p-5 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Prompt image</p>
                <p className="text-sm text-gray-400 mt-1">Sans texte dans l’image, avec mise en scène propre et cohérence des références.</p>
              </div>
              {scene.imagePrompt && (
                <button onClick={() => onCopy(scene.imagePrompt!)} className="px-3 py-2 bg-blue-600/20 border border-blue-600/30 text-blue-300 text-sm rounded-xl">
                  Copier
                </button>
              )}
            </div>
            <div className="rounded-xl border border-[#2a2a3e] bg-[#1e1e2e] p-4">
              <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                {scene.imagePrompt || "Aucun prompt image."}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Prompt vidéo / mise en scène</p>
                <p className="text-sm text-gray-400 mt-1">Inclut désormais les règles de dialogue, voix off, active speaker et lipsync.</p>
              </div>
              {scene.videoPrompt && (
                <button onClick={() => onCopy(scene.videoPrompt!)} className="px-3 py-2 bg-purple-600/20 border border-purple-600/30 text-purple-300 text-sm rounded-xl">
                  Copier
                </button>
              )}
            </div>
            <div className="rounded-xl border border-[#2a2a3e] bg-[#1e1e2e] p-4">
              <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                {scene.videoPrompt || "Aucun prompt vidéo."}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#2a2a3e] bg-[#1e1e2e] p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Dialogue</p>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{scene.dialogue || "Aucun dialogue"}</p>
              </div>
              <div className="rounded-xl border border-[#2a2a3e] bg-[#1e1e2e] p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Narration</p>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{scene.narration || "Aucune narration"}</p>
              </div>
            </div>

            <div className="rounded-xl border border-[#2a2a3e] bg-[#1e1e2e] p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Références scène détectées</p>
              <p className="text-sm text-gray-300">
                Personnages demandés: {characterNames.length > 0 ? characterNames.join(", ") : "aucun"}.
                {environment?.name ? ` Décor principal: ${environment.name}.` : ""}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Le système prépare maintenant le plan comme Vidmuse: décor + personnage(s) + éventuel accessoire/prop + audio lipsync si la scène parle.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryModal({
  scene,
  history,
  onClose,
  onRestore,
}: {
  scene: Scene;
  history: ImageHistoryEntry[];
  onClose: () => void;
  onRestore: (sceneId: string, imageUrl: string, historyIndex: number) => Promise<void>;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#13131a] border border-[#2a2a3e] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a3e]">
          <h2 className="text-xl font-bold text-white">Historique — Scène {scene.sceneNumber}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[calc(90vh-84px)]">
          {scene.imageUrl && (
            <div className="mb-5">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Image actuelle</p>
              <img src={scene.imageUrl} alt="Image actuelle" className="w-full max-h-72 object-contain rounded-xl border border-green-600/20 bg-[#1e1e2e]" />
            </div>
          )}
          {history.length === 0 ? (
            <div className="text-center py-12 text-gray-500">Pas encore d&apos;historique</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {history.map((entry, idx) => (
                <div key={`${entry.url}-${idx}`} className="rounded-xl overflow-hidden border border-[#2a2a3e] bg-[#1e1e2e]">
                  <img src={entry.url} alt={`Historique ${idx + 1}`} className="w-full aspect-video object-cover" />
                  <div className="p-3">
                    <p className="text-sm text-white truncate">{entry.generator}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      <Clock className="inline w-3 h-3 mr-1" />
                      {new Date(entry.createdAt).toLocaleString("fr-FR")}
                    </p>
                    <button
                      onClick={() => onRestore(scene.id, entry.url, idx)}
                      className="mt-3 w-full py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-xl"
                    >
                      Restaurer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
