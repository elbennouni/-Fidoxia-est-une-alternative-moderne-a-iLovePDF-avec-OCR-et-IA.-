"use client";

import { useState, useEffect, use, useMemo, useRef } from "react";
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
  Upload,
  Sparkles,
  Trash2,
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
  faceReferenceImages?: string[] | null;
  fullBodyReferenceImages?: string[] | null;
  outfitReferenceImages?: string[] | null;
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
  generationPayload?: {
    promptImage: string;
    promptVideo: string;
    negativePrompt: string;
    referenceImages: Array<{
      type: "face" | "full_body" | "outfit" | "environment" | "pose";
      characterId?: string;
      url: string;
      strength: number;
    }>;
    audio: {
      activeSpeakerCharacterId?: string;
      fileUrl?: string;
      lipsync: boolean;
    };
  };
  lipSyncShots?: Array<{
    title: string;
    dialogue: string;
    narration: string;
    activeSpeakerCharacterId?: string;
    lipSyncRequired: boolean;
    characters: Array<{ name: string }>;
  }>;
  consistency?: {
    ok: boolean;
    requiresAdminOverride: boolean;
    issues: Array<{ level: "warning" | "error"; code: string; message: string }>;
  };
  sceneReferences?: Array<{
    id: string;
    name: string;
    url: string | null;
    createdAt: string;
    metadata: {
      sceneId: string;
      note?: string;
      kind?: "manual" | "prop" | "accessory" | "moodboard" | "team";
      promptAppliedAt?: string | null;
    };
  }>;
  sceneReferencesNeedPromptRefresh?: boolean;
}

interface EpisodePayload {
  title: string;
  format: string;
  seriesId?: string;
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
  const [seriesId, setSeriesId] = useState("");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [characters, setCharacters] = useState<CharacterRef[]>([]);
  const [environments, setEnvironments] = useState<EnvironmentRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingSceneId, setGeneratingSceneId] = useState<string | null>(null);
  const [selectedGenerators, setSelectedGenerators] = useState<Record<string, string>>({});
  const [openPromptSceneId, setOpenPromptSceneId] = useState<string | null>(null);
  const [openHistorySceneId, setOpenHistorySceneId] = useState<string | null>(null);
  const [openGeneratorSceneId, setOpenGeneratorSceneId] = useState<string | null>(null);
  const [optimizingPrompt, setOptimizingPrompt] = useState<{ sceneId: string; type: "image" | "video" } | null>(null);
  const [uploadTarget, setUploadTarget] = useState<{ type: "character" | "environment"; id: string; referenceKind: "face" | "fullBody" | "outfit" | "environment" } | null>(null);
  const [sceneReferenceUploadTarget, setSceneReferenceUploadTarget] = useState<{ sceneId: string; sceneNumber: number } | null>(null);
  const [uploadingSceneReference, setUploadingSceneReference] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sceneReferenceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchData(); }, [id]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/episodes/${id}`);
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json() as EpisodePayload;
      setEpisodeTitle(data.title);
      setSeriesId(data.seriesId || "");
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

  async function optimizePrompt(scene: Scene, type: "image" | "video") {
    setOptimizingPrompt({ sceneId: scene.id, type });
    const t = toast.loading(`Agent IA: amélioration du prompt ${type === "image" ? "image" : "vidéo"}...`);
    try {
      const res = await fetch(`/api/scenes/${scene.id}/optimize-prompts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Optimisation impossible");
      toast.dismiss(t);
      toast.success(`Prompt ${type === "image" ? "image" : "vidéo"} amélioré`);
      await fetchData();
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Optimisation impossible");
    } finally {
      setOptimizingPrompt(null);
    }
  }

  async function uploadSceneReferences(scene: Scene, files: FileList | null, kind: "manual" | "accessory" | "team" = "manual") {
    const selectedFiles = Array.from(files || []).slice(0, 4);
    if (selectedFiles.length === 0) return;
    if (!seriesId) {
      toast.error("Serie introuvable pour sauvegarder ces references.");
      return;
    }

    setUploadingSceneReference(scene.id);
    const t = toast.loading(`Upload de ${selectedFiles.length} référence(s) de scène...`);
    try {
      for (const [index, file] of selectedFiles.entries()) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "scene-references");
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || "Upload impossible");

        const createRes = await fetch("/api/assets/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seriesId,
            type: "scene_reference",
            name: `${kind === "team" ? "Equipe" : kind === "accessory" ? "Accessoire" : "Scene"} ${scene.sceneNumber} ref ${index + 1}`,
            url: uploadData.url,
            prompt: JSON.stringify({
              sceneId: scene.id,
              kind,
              note: "",
              promptAppliedAt: null,
            }),
            reusable: false,
          }),
        });
        const createData = await createRes.json();
        if (!createRes.ok) throw new Error(createData.error || "Création de la référence impossible");
      }

      toast.dismiss(t);
      toast.success("Nouvelles images ajoutées et sauvegardées. Regénérez le prompt pour qu'elles soient prises en compte.");
      await fetchData();
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Upload impossible");
    } finally {
      setUploadingSceneReference(null);
      setSceneReferenceUploadTarget(null);
    }
  }

  async function removeSceneReference(assetId: string) {
    const t = toast.loading("Suppression de la référence de scène...");
    try {
      const res = await fetch(`/api/assets/${assetId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Suppression impossible");
      toast.dismiss(t);
      toast.success("Référence de scène supprimée");
      await fetchData();
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Suppression impossible");
    }
  }

  async function handleReferenceUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadTarget) return;

    const t = toast.loading("Upload de la référence...");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", uploadTarget.type === "character" ? "characters" : "environments");
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "Upload impossible");

      if (uploadTarget.type === "character") {
        const character = characters.find((item) => item.id === uploadTarget.id);
        const faceRefs = [...(character?.faceReferenceImages || [])];
        const bodyRefs = [...(character?.fullBodyReferenceImages || [])];
        const outfitRefs = [...(character?.outfitReferenceImages || [])];

        if (uploadTarget.referenceKind === "face") faceRefs.push(uploadData.url);
        if (uploadTarget.referenceKind === "fullBody") bodyRefs.push(uploadData.url);
        if (uploadTarget.referenceKind === "outfit") outfitRefs.push(uploadData.url);

        const patchBody: Record<string, unknown> = {
          referenceImageUrl: uploadTarget.referenceKind === "face" ? uploadData.url : character?.referenceImageUrl || uploadData.url,
          faceReferenceImages: faceRefs,
          fullBodyReferenceImages: bodyRefs,
          outfitReferenceImages: outfitRefs,
        };
        const saveRes = await fetch(`/api/characters/${uploadTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
        });
        const saveData = await saveRes.json();
        if (!saveRes.ok) throw new Error(saveData.error || "Sauvegarde personnage impossible");
      } else {
        const env = environments.find((item) => item.id === uploadTarget.id);
        const saveRes = await fetch(`/api/environments/${uploadTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ previewImageUrl: uploadData.url, name: env?.name, description: "" }),
        });
        const saveData = await saveRes.json();
        if (!saveRes.ok) throw new Error(saveData.error || "Sauvegarde décor impossible");
      }

      toast.dismiss(t);
      toast.success("Référence ajoutée");
      await fetchData();
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Upload impossible");
    } finally {
      setUploadTarget(null);
      e.target.value = "";
    }
  }

  async function removeCharacterReference(character: CharacterRef, referenceKind: "face" | "fullBody" | "outfit", url: string) {
    const faceRefs = [...(character.faceReferenceImages || [])].filter((item) => item !== url);
    const bodyRefs = [...(character.fullBodyReferenceImages || [])].filter((item) => item !== url);
    const outfitRefs = [...(character.outfitReferenceImages || [])].filter((item) => item !== url);

    const t = toast.loading("Suppression de la référence...");
    try {
      const res = await fetch(`/api/characters/${character.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceImageUrl: referenceKind === "face" && character.referenceImageUrl === url ? faceRefs[0] || null : character.referenceImageUrl || null,
          faceReferenceImages: faceRefs,
          fullBodyReferenceImages: bodyRefs,
          outfitReferenceImages: outfitRefs,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Suppression impossible");
      toast.dismiss(t);
      toast.success("Référence supprimée");
      await fetchData();
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Suppression impossible");
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
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleReferenceUpload} />
      <input
        ref={sceneReferenceInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (!sceneReferenceUploadTarget) return;
          const scene = scenes.find((item) => item.id === sceneReferenceUploadTarget.sceneId);
          if (scene) {
            const kind = (sceneReferenceUploadTarget as { referenceKind?: "manual" | "accessory" | "team" } | null)?.referenceKind || "manual";
            void uploadSceneReferences(scene, e.target.files, kind);
          }
          e.target.value = "";
        }}
      />
      {promptScene && (
        <PromptModal
          scene={promptScene}
          characters={getSceneCharacters(promptScene)}
          environment={getSceneEnvironment(promptScene)}
          onClose={() => setOpenPromptSceneId(null)}
          onCopy={copyText}
          onOptimizePrompt={optimizePrompt}
          optimizingPrompt={optimizingPrompt}
          onUploadReference={(type, id, referenceKind) => {
            setUploadTarget({ type, id, referenceKind });
            fileInputRef.current?.click();
          }}
          onRemoveCharacterReference={removeCharacterReference}
          onUploadSceneReferences={(scene, referenceKind = "manual") => {
            setSceneReferenceUploadTarget({ sceneId: scene.id, sceneNumber: scene.sceneNumber, referenceKind } as {
              sceneId: string;
              sceneNumber: number;
              referenceKind: "manual" | "accessory" | "team";
            });
            sceneReferenceInputRef.current?.click();
          }}
          onRemoveSceneReference={removeSceneReference}
          uploadingSceneReference={uploadingSceneReference}
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
                    {(scene.sceneReferences?.length || 0) > 0 && (
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${scene.sceneReferencesNeedPromptRefresh ? "bg-amber-600/20 border-amber-600/30 text-amber-300" : "bg-cyan-600/20 border-cyan-600/30 text-cyan-300"}`}>
                        <Upload className="inline w-3 h-3 mr-1" />
                        {scene.sceneReferences?.length} refs scène
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
                  {scene.sceneReferencesNeedPromptRefresh && (
                    <p className="text-xs text-amber-300">
                      De nouvelles images manuelles ont été ajoutées pour cette scène. Ouvrez le prompt et regénérez-le avant la prochaine génération.
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
  onOptimizePrompt,
  optimizingPrompt,
  onUploadReference,
  onRemoveCharacterReference,
  onUploadSceneReferences,
  onRemoveSceneReference,
  uploadingSceneReference,
}: {
  scene: Scene;
  characters: CharacterRef[];
  environment?: EnvironmentRef;
  onClose: () => void;
  onCopy: (text: string) => void;
  onOptimizePrompt: (scene: Scene, type: "image" | "video") => Promise<void>;
  optimizingPrompt: { sceneId: string; type: "image" | "video" } | null;
  onUploadReference: (type: "character" | "environment", id: string, referenceKind: "face" | "fullBody" | "outfit" | "environment") => void;
  onRemoveCharacterReference: (character: CharacterRef, referenceKind: "face" | "fullBody" | "outfit", url: string) => Promise<void>;
  onUploadSceneReferences: (scene: Scene, referenceKind?: "manual" | "accessory" | "team") => void;
  onRemoveSceneReference: (assetId: string) => Promise<void>;
  uploadingSceneReference: string | null;
}) {
  const characterNames = parseJsonArray(scene.charactersJson);
  const payloadReferences = scene.generationPayload?.referenceImages || [];
  const preflightIssues = scene.consistency?.issues || [];
  const sceneReferences = scene.sceneReferences || [];

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
          <div className="border-r border-[#2a2a3e] p-5 overflow-y-auto space-y-5 max-h-[calc(90vh-84px)] pr-3 scrollbar-thin">
            <div>
              <div className="rounded-xl border border-[#2a2a3e] bg-[#1e1e2e] p-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Références manuelles de scène</p>
                    <p className="text-sm text-gray-300 mt-1">
                      Ajoutez ici des images de scene, d'accessoire ou d'equipe pour guider précisément la mise en scène.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      onClick={() => onUploadSceneReferences(scene, "manual")}
                      disabled={uploadingSceneReference === scene.id}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-cyan-600/20 border border-cyan-600/30 text-cyan-300 text-xs disabled:opacity-60"
                    >
                      {uploadingSceneReference === scene.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      scene
                    </button>
                    <button
                      onClick={() => onUploadSceneReferences(scene, "accessory")}
                      disabled={uploadingSceneReference === scene.id}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-orange-600/20 border border-orange-600/30 text-orange-300 text-xs disabled:opacity-60"
                    >
                      {uploadingSceneReference === scene.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      accessoire
                    </button>
                    <button
                      onClick={() => onUploadSceneReferences(scene, "team")}
                      disabled={uploadingSceneReference === scene.id}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-purple-600/20 border border-purple-600/30 text-purple-300 text-xs disabled:opacity-60"
                    >
                      {uploadingSceneReference === scene.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      equipe
                    </button>
                  </div>
                </div>
                {scene.sceneReferencesNeedPromptRefresh ? (
                  <div className="rounded-lg border border-amber-600/30 bg-amber-900/10 px-3 py-2 text-xs text-amber-300">
                    Vous avez téléchargé de nouvelles images. Il faut regénérer le prompt avec ces nouveaux éléments pour refaire la scène proprement.
                  </div>
                ) : (
                  <div className="rounded-lg border border-emerald-600/30 bg-emerald-900/10 px-3 py-2 text-xs text-emerald-300">
                    Les références manuelles actuelles ont déjà été prises en compte dans le prompt.
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 mt-3 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
                  {sceneReferences.length > 0 ? sceneReferences.map((reference) => (
                    <div key={reference.id} className="relative rounded-lg overflow-hidden border border-[#2a2a3e] bg-[#13131a]">
                      {reference.url ? (
                        <img src={reference.url} alt={reference.name} className="w-full aspect-square object-cover" />
                      ) : (
                        <div className="aspect-square flex items-center justify-center text-gray-600 text-xs">vide</div>
                      )}
                      <div className="p-2">
                        <p className="text-[11px] text-white truncate">{reference.name}</p>
                        <p className="text-[11px] text-cyan-300">
                          {reference.metadata.kind === "team" ? "Equipe" : reference.metadata.kind === "accessory" || reference.metadata.kind === "prop" ? "Accessoire" : "Scene"}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {new Date(reference.createdAt).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                      <button
                        onClick={() => onRemoveSceneReference(reference.id)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white hover:bg-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )) : (
                    <div className="col-span-2 rounded-lg border border-dashed border-[#2a2a3e] p-4 text-center text-xs text-gray-500">
                      Aucune référence manuelle de scène ajoutée pour le moment.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Références personnages</p>
              <div className="grid grid-cols-1 gap-3">
                {characters.map((char) => (
                  <div key={char.id} className="rounded-xl border border-[#2a2a3e] bg-[#1e1e2e] p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-sm font-medium text-white truncate">{char.name}</p>
                      <button
                        onClick={() => onUploadReference("character", char.id, "face")}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-600/20 border border-blue-600/30 text-blue-300 text-xs"
                      >
                        <Upload className="w-3 h-3" /> visage
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { kind: "face" as const, label: "Visage", values: char.faceReferenceImages?.length ? char.faceReferenceImages : char.referenceImageUrl ? [char.referenceImageUrl] : [] },
                        { kind: "fullBody" as const, label: "Corps", values: char.fullBodyReferenceImages || [] },
                        { kind: "outfit" as const, label: "Tenue", values: char.outfitReferenceImages || [] },
                      ].map((group) => (
                        <div key={group.label}>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[11px] uppercase text-gray-500">{group.label}</p>
                            <button
                              onClick={() => onUploadReference("character", char.id, group.kind)}
                              className="text-[11px] text-purple-300 hover:text-purple-200"
                            >
                              +
                            </button>
                          </div>
                          <div className="space-y-1">
                            {group.values.length > 0 ? group.values.map((url, index) => (
                              <div key={`${group.kind}-${index}`} className="relative rounded-lg overflow-hidden border border-[#2a2a3e]">
                                <img src={url} alt={`${char.name}-${group.kind}-${index}`} className="w-full aspect-square object-cover" />
                                <button
                                  onClick={() => onRemoveCharacterReference(char, group.kind, url)}
                                  className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white hover:bg-red-600"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )) : (
                              <div className="aspect-square rounded-lg border border-dashed border-[#2a2a3e] flex items-center justify-center text-gray-600 text-xs">
                                vide
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
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
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">{environment?.name || scene.location || "Décor"}</p>
                    {environment?.id && (
                      <button
                        onClick={() => onUploadReference("environment", environment.id, "environment")}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-600/20 border border-blue-600/30 text-blue-300 text-xs"
                      >
                        <Upload className="w-3 h-3" /> décor
                      </button>
                    )}
                  </div>
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
                <p className="text-sm text-gray-400 mt-1">Sans texte dans l’image, avec mise en scène propre et cohérence des références, y compris les nouvelles images manuelles.</p>
              </div>
              <div className="flex gap-2">
                {scene.imagePrompt && (
                  <button onClick={() => onCopy(scene.imagePrompt!)} className="px-3 py-2 bg-blue-600/20 border border-blue-600/30 text-blue-300 text-sm rounded-xl">
                    Copier
                  </button>
                )}
                <button
                  onClick={() => onOptimizePrompt(scene, "image")}
                  className="px-3 py-2 bg-purple-600/20 border border-purple-600/30 text-purple-300 text-sm rounded-xl inline-flex items-center gap-2"
                >
                  {optimizingPrompt?.sceneId === scene.id && optimizingPrompt.type === "image" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Agent IA image
                </button>
              </div>
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
              <div className="flex gap-2">
                {scene.videoPrompt && (
                  <button onClick={() => onCopy(scene.videoPrompt!)} className="px-3 py-2 bg-purple-600/20 border border-purple-600/30 text-purple-300 text-sm rounded-xl">
                    Copier
                  </button>
                )}
                <button
                  onClick={() => onOptimizePrompt(scene, "video")}
                  className="px-3 py-2 bg-orange-600/20 border border-orange-600/30 text-orange-300 text-sm rounded-xl inline-flex items-center gap-2"
                >
                  {optimizingPrompt?.sceneId === scene.id && optimizingPrompt.type === "video" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Agent IA vidéo
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-[#2a2a3e] bg-[#1e1e2e] p-4">
              <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                {scene.videoPrompt || "Aucun prompt vidéo."}
              </p>
            </div>

            <div className="rounded-xl border border-[#2a2a3e] bg-[#1e1e2e] p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Prompt négatif</p>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{scene.generationPayload?.negativePrompt || "Aucun prompt négatif."}</p>
            </div>

            {payloadReferences.length > 0 && (
              <div className="rounded-xl border border-[#2a2a3e] bg-[#1e1e2e] p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Images réellement envoyées au générateur</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {payloadReferences.map((reference, index) => (
                    <div key={`${reference.url}-${index}`} className="rounded-lg overflow-hidden border border-[#2a2a3e] bg-[#13131a]">
                      <img src={reference.url} alt={`${reference.type}-${index}`} className="w-full aspect-square object-cover" />
                      <div className="p-2">
                        <p className="text-[11px] uppercase text-purple-300">{reference.type}</p>
                        <p className="text-[11px] text-gray-500">strength {reference.strength}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

            <div className="rounded-xl border border-[#2a2a3e] bg-[#1e1e2e] p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Preflight check</p>
              {preflightIssues.length > 0 ? (
                <ul className="space-y-2">
                  {preflightIssues.map((issue, index) => (
                    <li key={`${issue.code}-${index}`} className={`text-sm ${issue.level === "error" ? "text-red-300" : "text-orange-300"}`}>
                      {issue.level === "error" ? "⛔" : "⚠️"} {issue.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-green-300">✅ Préflight OK — scène prête à être améliorée puis générée.</p>
              )}
            </div>

            {scene.lipSyncShots && scene.lipSyncShots.length > 0 && (
              <div className="rounded-xl border border-[#2a2a3e] bg-[#1e1e2e] p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Proposition de shots vidéo</p>
                <div className="space-y-2">
                  {scene.lipSyncShots.map((shot, index) => (
                    <div key={`${shot.title}-${index}`} className="rounded-lg border border-[#2a2a3e] bg-[#13131a] p-3">
                      <p className="text-sm text-white font-medium">{shot.title}</p>
                      <p className="text-xs text-gray-400 mt-1">{shot.dialogue || shot.narration || "Shot visuel"}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
