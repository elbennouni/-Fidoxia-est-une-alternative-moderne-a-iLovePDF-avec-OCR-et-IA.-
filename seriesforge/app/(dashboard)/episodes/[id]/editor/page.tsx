"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowLeft, Zap, Download, Loader2, Sparkles, CheckCircle,
  Clock, AlertCircle, Image, Volume2, Video, ChevronDown, ChevronUp, Copy, FileJson, X, Film
} from "lucide-react";
import { CostBadge, CostSummary } from "@/components/ui/CostBadge";
import { COSTS } from "@/lib/costs";
import { ImageGeneratorPicker, VideoGeneratorPicker } from "@/components/ui/GeneratorPicker";
import { IMAGE_GENERATORS, VIDEO_GENERATORS, getDefaultImageGenerator, setDefaultImageGenerator, getDefaultVideoGenerator, setDefaultVideoGenerator } from "@/lib/generators";

interface ImageHistoryEntry {
  url: string;
  generator: string;
  createdAt: string;
}

interface Scene {
  id: string;
  sceneNumber: number;
  timecode?: string;
  location?: string;
  charactersJson?: string;
  action?: string;
  narration?: string;
  dialogue?: string;
  camera?: string;
  emotion?: string;
  soundDesign?: string;
  imagePrompt?: string;
  videoPrompt?: string;
  audioPrompt?: string;
  voiceProvider?: string;
  qualityScore?: number;
  status: string;
  imageUrl?: string;
  imageHistory?: string;
  videoUrl?: string;
}

interface Episode {
  id: string;
  title: string;
  status: string;
  format: string;
  script?: string;
  seriesId: string;
  series: { id: string; title: string; visualStyle: string; tone: string };
  scenes: Scene[];
}

export default function EpisodeEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [generatingAllImages, setGeneratingAllImages] = useState(false);
  const [generatingSceneImage, setGeneratingSceneImage] = useState<string | null>(null);
  const [expandedScene, setExpandedScene] = useState<string | null>(null);
  const [selectedImgGen, setSelectedImgGen] = useState(() => typeof window !== "undefined" ? getDefaultImageGenerator() : "dalle3-hd");
  const [defaultImgGen, setDefaultImgGen] = useState(() => typeof window !== "undefined" ? getDefaultImageGenerator() : "dalle3-hd");
  const [selectedVidGen, setSelectedVidGen] = useState(() => typeof window !== "undefined" ? getDefaultVideoGenerator() : "kling-15-std");
  const [defaultVidGen, setDefaultVidGen] = useState(() => typeof window !== "undefined" ? getDefaultVideoGenerator() : "kling-15-std");
  const [showGenPicker, setShowGenPicker] = useState(false);
  const [showPipelineConfirm, setShowPipelineConfirm] = useState(false);
  const [showImageHistory, setShowImageHistory] = useState<string | null>(null); // scene id

  useEffect(() => { fetchEpisode(); }, [id]);

  async function fetchEpisode() {
    try {
      const res = await fetch(`/api/episodes/${id}`);
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      setEpisode(data);
      if (data.scenes?.length > 0) setExpandedScene(data.scenes[0].id);
    } finally {
      setLoading(false);
    }
  }

  async function restoreImage(sceneId: string, imageUrl: string, historyIndex: number) {
    try {
      const res = await fetch(`/api/scenes/${sceneId}/restore-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, historyIndex }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Image restaurée !");
      setShowImageHistory(null);
      fetchEpisode();
    } catch { toast.error("Erreur restauration"); }
  }

  async function deleteFromHistory(sceneId: string, historyIndex: number) {
    try {
      const res = await fetch(`/api/scenes/${sceneId}/restore-image`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ historyIndex }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Image supprimée de l'historique");
      fetchEpisode();
    } catch { toast.error("Erreur suppression"); }
  }

  function confirmRunPipeline() {
    if (episode && episode.scenes.length > 0) {
      setShowPipelineConfirm(true);
    } else {
      runPipeline();
    }
  }

  async function runPipeline() {
    setShowPipelineConfirm(false);
    setRunning(true);
    const t = toast.loading("🎬 Pipeline IA en cours (2-3 min)...", { duration: 200000 });
    try {
      const res = await fetch(`/api/episodes/${id}/run-pipeline`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.dismiss(t);
      toast.success(`✅ Terminé ! ${data.sceneCount} scènes · score moyen ${data.averageQualityScore}/100 · ${data.fixedScenes} corrigées`);
      fetchEpisode();
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Pipeline échoué");
    } finally {
      setRunning(false);
    }
  }

  function handleSetDefaultImgGen(id: string) {
    setDefaultImgGen(id);
    setDefaultImageGenerator(id);
    toast.success(`${IMAGE_GENERATORS.find(g => g.id === id)?.name} défini par défaut`);
  }

  function handleSetDefaultVidGen(id: string) {
    setDefaultVidGen(id);
    setDefaultVideoGenerator(id);
    toast.success(`${VIDEO_GENERATORS.find(g => g.id === id)?.name} défini par défaut`);
  }

  // Models that use dedicated APIs for character reference
  const NANO_BANANA_MODELS = ["nano-banana-pro", "nano-banana"];
  const CHARACTER_CONSISTENT_MODELS = ["ideogram-character", "instant-character", "minimax-subject"];

  async function generateSceneImage(scene: Scene) {
    setGeneratingSceneImage(scene.id);
    const gen = IMAGE_GENERATORS.find(g => g.id === selectedImgGen);
    const t = toast.loading(`Génération scène ${scene.sceneNumber} avec ${gen?.name || "DALL-E 3"}...`);
    try {
      // Route to the right API based on the generator
      let endpoint = "/api/generate/scene-with-generator";
      let body: Record<string, unknown> = { sceneId: scene.id, generatorId: selectedImgGen };

      if (NANO_BANANA_MODELS.includes(selectedImgGen)) {
        endpoint = "/api/generate/nano-banana";
        body = { sceneId: scene.id, model: selectedImgGen };
      } else if (CHARACTER_CONSISTENT_MODELS.includes(selectedImgGen)) {
        endpoint = "/api/generate/scene-character-consistent";
        body = { sceneId: scene.id, model: selectedImgGen };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.dismiss(t);
      const withRef = data.refImagesUsed?.length > 0 ? ` · 📸 ${data.refImagesUsed.join(", ")}` : "";
      const withPhoto = data.charactersWithPhoto?.length > 0 ? ` · 📸 ${data.charactersWithPhoto.join(", ")}` : "";
      const withDNA = data.charactersWithDNA?.length > 0 ? ` · 🧬 ${data.charactersWithDNA.join(", ")}` : "";
      const noPhoto = data.charsWithoutPhoto?.length > 0 ? ` ⚠️ sans photo: ${data.charsWithoutPhoto.join(", ")}` : "";
      toast.success(`Image scène ${scene.sceneNumber} ✅${withRef}${withDNA}${withPhoto}${noPhoto}`, { duration: 6000 });
      fetchEpisode();
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Génération échouée");
    } finally {
      setGeneratingSceneImage(null);
    }
  }

  async function translateToFrench() {
    if (!episode?.scenes.length) return;
    const t = toast.loading("🇫🇷 Traduction de toutes les scènes en français...");
    try {
      const res = await fetch(`/api/episodes/${id}/translate-to-french`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.dismiss(t);
      toast.success(`✅ ${data.translated}/${data.total} scènes traduites ! Audios réinitialisés.`, { duration: 6000 });
      fetchEpisode();
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Traduction échouée");
    }
  }

  async function generateAllConsistent() {
    setGeneratingAllImages(true);
    const sceneCount = episode?.scenes.length || 8;
    const t = toast.loading(`🎬 Génération ${sceneCount} images Pixar cohérentes... (peut prendre ${sceneCount * 15}s)`, { duration: 300000 });
    try {
      const res = await fetch(`/api/episodes/${id}/generate-all-consistent`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.dismiss(t);
      if (data.dnaAutoGenerated?.length > 0) {
        toast.success(`✅ ${data.generated}/${data.total} images générées ! ADN auto-créé pour: ${data.dnaAutoGenerated.join(", ")}`);
      } else {
        toast.success(`✅ ${data.generated}/${data.total} images Pixar générées avec cohérence visuelle !`);
      }
      fetchEpisode();
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setGeneratingAllImages(false);
    }
  }

  async function exportJson() {
    setExporting(true);
    try {
      const res = await fetch(`/api/episodes/${id}/export-json`);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `episode-${episode?.title || id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export téléchargé !");
    } catch {
      toast.error("Export échoué");
    } finally {
      setExporting(false);
    }
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copié !");
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
    </div>
  );
  if (!episode) return null;

  // Get image history for a scene
  function getHistory(scene: Scene): ImageHistoryEntry[] {
    try { return JSON.parse(scene.imageHistory || "[]"); } catch { return []; }
  }

  const statusIcon = episode.status === "complete" ? CheckCircle :
    episode.status === "generating" ? Loader2 : Clock;
  const StatusIcon = statusIcon;
  const avgScore = episode.scenes.length > 0
    ? Math.round(episode.scenes.reduce((s, sc) => s + (sc.qualityScore || 0), 0) / episode.scenes.filter(s => s.qualityScore).length || 1)
    : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* Pipeline Confirmation Modal */}
      {showPipelineConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#13131a] border border-orange-600/40 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-600/20 rounded-xl">
                <AlertCircle className="w-6 h-6 text-orange-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Pipeline déjà généré</h2>
            </div>
            <div className="bg-orange-900/20 border border-orange-600/20 rounded-xl p-4 mb-5">
              <p className="text-orange-200 text-sm mb-2">
                ⚠️ Cet épisode a déjà <strong>{episode.scenes.length} scènes générées</strong>.
              </p>
              <p className="text-orange-300/80 text-sm">
                Relancer le pipeline va <strong>supprimer toutes les scènes actuelles</strong> et en générer de nouvelles. Les images générées seront perdues.
              </p>
              {episode.scenes.some(s => s.imageUrl) && (
                <p className="text-yellow-300 text-sm mt-2">
                  💡 Les images générées seront sauvegardées dans l'historique par scène pour les retrouver après.
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPipelineConfirm(false)}
                className="flex-1 py-3 border border-[#2a2a3e] text-gray-300 hover:border-gray-400 rounded-xl transition-all font-medium"
              >
                Annuler
              </button>
              <button
                onClick={runPipeline}
                className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" /> Oui, regénérer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image History Modal */}
      {showImageHistory && (() => {
        const scene = episode.scenes.find(s => s.id === showImageHistory);
        if (!scene) return null;
        const history = getHistory(scene);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#13131a] border border-[#2a2a3e] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-[#2a2a3e]">
                <h2 className="text-xl font-bold text-white">
                  Historique images — Scène {scene.sceneNumber}
                </h2>
                <button onClick={() => setShowImageHistory(null)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-5 scrollbar-thin">
                {/* Current image */}
                {scene.imageUrl && (
                  <div className="mb-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs px-2 py-0.5 bg-green-600/20 border border-green-600/30 rounded-full text-green-400 font-medium">✅ Image actuelle</span>
                    </div>
                    <img src={scene.imageUrl} alt="current" className="w-full max-h-64 object-contain rounded-xl border border-green-600/20" />
                  </div>
                )}

                {history.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    Pas encore d'historique — les prochaines générations apparaîtront ici
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">{history.length} versions précédentes</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {history.map((entry, idx) => (
                        <div key={idx} className="group relative bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl overflow-hidden hover:border-purple-500/50 transition-all">
                          <img src={entry.url} alt={`History ${idx}`} className="w-full aspect-video object-cover" />
                          <div className="p-2">
                            <p className="text-xs text-gray-400 truncate">{entry.generator}</p>
                            <p className="text-xs text-gray-600">{new Date(entry.createdAt).toLocaleDateString("fr-FR")}</p>
                          </div>
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                            <button
                              onClick={() => restoreImage(scene.id, entry.url, idx)}
                              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-all"
                            >
                              ↩ Restaurer
                            </button>
                            <button
                              onClick={() => deleteFromHistory(scene.id, idx)}
                              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-all"
                            >
                              🗑
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Header */}
      <div className="mb-6">
        <Link href={`/series/${episode.series.id}/episodes`} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" /> Retour aux épisodes
        </Link>
        <div className="bg-[#13131a] border border-[#2a2a3e] rounded-2xl p-6 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white mb-1">{episode.title}</h1>
              <p className="text-sm text-gray-400 mb-2">{episode.series.title} · {episode.series.visualStyle}</p>
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`flex items-center gap-1 text-sm px-2 py-0.5 rounded-full ${
                  episode.status === "complete" ? "bg-green-600/20 text-green-400" :
                  episode.status === "generating" ? "bg-yellow-600/20 text-yellow-400" :
                  "bg-gray-600/20 text-gray-400"}`}>
                  <StatusIcon className={`w-3.5 h-3.5 ${episode.status === "generating" ? "animate-spin" : ""}`} />
                  {episode.status === "complete" ? "Complet" : episode.status === "generating" ? "En cours..." : "Brouillon"}
                </span>
                {avgScore !== null && avgScore > 0 && (
                  <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${avgScore >= 85 ? "bg-green-600/20 text-green-400" : "bg-yellow-600/20 text-yellow-400"}`}>
                    Score moyen: {avgScore}/100
                  </span>
                )}
                <span className="text-xs px-2 py-0.5 bg-[#1e1e2e] border border-[#2a2a3e] rounded-full text-gray-400">
                  {episode.scenes.length} scènes
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/episodes/${id}/import`} className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-xl transition-all">
                <FileJson className="w-4 h-4" /> Importer JSON
              </Link>
              <div className="flex flex-col items-end gap-1">
            <button onClick={confirmRunPipeline} disabled={running} className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-xl transition-all">
                {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {running ? "Génération..." : "Générer Pipeline"}
              </button>
                <CostBadge cost={COSTS["gpt4o-script"] + COSTS["gpt4o-artistic"] + (COSTS["gpt4o-qc"] * 8)} label="pipeline GPT" />
              </div>
              {episode.scenes.length > 0 && (
                <>
                  <button
                    onClick={translateToFrench}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-600/30 text-blue-300 text-sm font-medium rounded-xl transition-all"
                    title="Traduit toutes les scènes en français et réinitialise les audios pour regénérer"
                  >
                    🇫🇷 Traduire en français
                  </button>
                  <div className="flex flex-col items-end gap-1">
                    <button
                      onClick={generateAllConsistent}
                      disabled={generatingAllImages}
                      className="flex items-center gap-2 px-4 py-2.5 bg-green-600/20 hover:bg-green-600/40 border border-green-600/30 text-green-300 text-sm font-medium rounded-xl transition-all disabled:opacity-50"
                    >
                      {generatingAllImages ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      Générer toutes les images (Pixar)
                    </button>
                    <CostBadge cost={COSTS["dalle3-hd-portrait"] * (episode?.scenes.length || 8)} label={`${episode?.scenes.length || 8} imgs HD`} />
                  </div>
                  <Link href={`/episodes/${id}/storyboard`} className="flex items-center gap-2 px-4 py-2.5 bg-[#1e1e2e] border border-[#2a2a3e] hover:border-blue-500/50 text-gray-300 text-sm rounded-xl transition-all">
                    <Image className="w-4 h-4" /> Storyboard
                  </Link>
                  <Link href={`/episodes/${id}/assemble`} className="flex items-center gap-2 px-4 py-2.5 bg-purple-600/20 border border-purple-600/30 hover:bg-purple-600/40 text-purple-300 text-sm font-medium rounded-xl transition-all">
                    <Film className="w-4 h-4" /> Assembler
                  </Link>
                  <Link href={`/episodes/${id}/audio`} className="flex items-center gap-2 px-4 py-2.5 bg-[#1e1e2e] border border-[#2a2a3e] hover:border-orange-500/50 text-gray-300 text-sm rounded-xl transition-all">
                    <Volume2 className="w-4 h-4" /> Audio
                  </Link>
                  <Link href={`/episodes/${id}/video`} className="flex items-center gap-2 px-4 py-2.5 bg-[#1e1e2e] border border-[#2a2a3e] hover:border-green-500/50 text-gray-300 text-sm rounded-xl transition-all">
                    <Video className="w-4 h-4" /> Vidéo
                  </Link>
                  <button onClick={exportJson} disabled={exporting} className="flex items-center gap-2 px-4 py-2.5 bg-[#1e1e2e] border border-[#2a2a3e] hover:border-gray-400 text-gray-300 text-sm rounded-xl transition-all">
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Export JSON
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Synopsis */}
          {episode.script && (
            <div className="mt-4 pt-4 border-t border-[#2a2a3e]">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Synopsis</p>
              <p className="text-gray-300 text-sm leading-relaxed">{episode.script}</p>
            </div>
          )}
        </div>
      </div>

      {/* Generator Selector */}
      <div className="mb-6 bg-[#13131a] border border-[#2a2a3e] rounded-xl overflow-hidden">
        <button
          onClick={() => setShowGenPicker(!showGenPicker)}
          className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-all"
        >
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-white">Générateurs</span>
            <span className="text-xs px-2 py-1 bg-purple-600/20 border border-purple-600/30 rounded-full text-purple-300">
              🖼 {IMAGE_GENERATORS.find(g => g.id === selectedImgGen)?.name}
              <span className="text-yellow-400/70 ml-1 font-mono">~${IMAGE_GENERATORS.find(g => g.id === selectedImgGen)?.pricePerImage.toFixed(3)}</span>
            </span>
            <span className="text-xs px-2 py-1 bg-green-600/20 border border-green-600/30 rounded-full text-green-300">
              🎬 {VIDEO_GENERATORS.find(g => g.id === selectedVidGen)?.name}
              <span className="text-yellow-400/70 ml-1 font-mono">~${VIDEO_GENERATORS.find(g => g.id === selectedVidGen)?.pricePer5s.toFixed(2)}/5s</span>
            </span>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${showGenPicker ? "rotate-180" : ""}`} />
        </button>
        {showGenPicker && (
          <div className="border-t border-[#2a2a3e] p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ImageGeneratorPicker
              selected={selectedImgGen}
              onSelect={setSelectedImgGen}
              onSetDefault={handleSetDefaultImgGen}
              defaultId={defaultImgGen}
            />
            <VideoGeneratorPicker
              selected={selectedVidGen}
              onSelect={setSelectedVidGen}
              onSetDefault={handleSetDefaultVidGen}
              defaultId={defaultVidGen}
            />
          </div>
        )}
      </div>

      {/* Scenes */}
      {episode.scenes.length === 0 ? (
        <div className="text-center py-16 bg-[#13131a] border border-dashed border-[#2a2a3e] rounded-2xl">
          <Sparkles className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-xl font-bold text-white mb-2">Prêt à générer</p>
          <p className="text-gray-400 mb-1">Cliquez sur "Générer Pipeline" pour lancer les agents IA :</p>
          <p className="text-gray-500 text-sm mb-3">Scénario → Scènes → Storyboard → Audio → Contrôle qualité → Correction automatique</p>
          <div className="flex justify-center mb-6">
            <CostSummary items={[
              { label: "Script GPT-4o", cost: COSTS["gpt4o-script"] },
              { label: "QC × 8 scènes", cost: COSTS["gpt4o-qc"], qty: 8 },
              { label: "Audio plan", cost: COSTS["gpt4o-script"] },
            ]} />
          </div>
          <button onClick={runPipeline} disabled={running} className="px-8 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center gap-2 mx-auto">
            {running ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
            {running ? "Génération en cours..." : "Générer Pipeline Complet"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-white mb-4">
            Scénario complet — {episode.scenes.length} scènes
          </h2>
          {episode.scenes.map(scene => {
            const isExpanded = expandedScene === scene.id;
            const characters = JSON.parse(scene.charactersJson || "[]") as string[];
            return (
              <div key={scene.id} className={`bg-[#13131a] border rounded-xl overflow-hidden transition-all ${isExpanded ? "border-purple-500/40" : "border-[#2a2a3e]"}`}>
                {/* Scene Header */}
                <button
                  onClick={() => setExpandedScene(isExpanded ? null : scene.id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-white/2 transition-all"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      scene.qualityScore && scene.qualityScore >= 85 ? "bg-green-600/30 text-green-400" :
                      scene.qualityScore ? "bg-yellow-600/30 text-yellow-400" : "bg-gray-700 text-gray-400"
                    }`}>
                      {scene.sceneNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {scene.timecode && <span className="text-xs text-gray-500">{scene.timecode}</span>}
                        {scene.location && <span className="text-sm text-white font-medium truncate">📍 {scene.location}</span>}
                      </div>
                      {scene.action && <p className="text-xs text-gray-400 truncate mt-0.5">{scene.action}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {scene.qualityScore && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scene.qualityScore >= 85 ? "bg-green-600/20 text-green-400" : "bg-yellow-600/20 text-yellow-400"}`}>
                          {scene.qualityScore}/100
                        </span>
                      )}
                      {scene.imageUrl && <span className="text-xs text-blue-400">🖼</span>}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 ml-3 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 ml-3 flex-shrink-0" />}
                </button>

                {/* Scene Detail */}
                {isExpanded && (
                  <div className="border-t border-[#2a2a3e] p-4 space-y-4">
                    {/* Image + info layout */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left: image */}
                      <div>
                        <div className="aspect-[9/16] bg-[#1e1e2e] rounded-xl overflow-hidden relative flex items-center justify-center mb-2" style={episode.format === "16:9" ? {aspectRatio: "16/9"} : {}}>
                          {scene.imageUrl ? (
                            <img src={scene.imageUrl} alt={`Scène ${scene.sceneNumber}`} className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-center p-4">
                              <Image className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                              <p className="text-xs text-gray-500">Pas d'image</p>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <button
                            onClick={() => generateSceneImage(scene)}
                            disabled={generatingSceneImage === scene.id}
                            className="w-full flex items-center justify-center gap-2 py-2 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-600/30 text-purple-300 text-sm rounded-xl transition-all disabled:opacity-50"
                          >
                            {generatingSceneImage === scene.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            {scene.imageUrl ? "Regénérer" : "Générer"}
                          </button>
                          {CHARACTER_CONSISTENT_MODELS.includes(selectedImgGen) && (() => {
                            const chars: string[] = JSON.parse(scene.charactersJson || "[]");
                            if (chars.length > 0) {
                              return (
                                <p className="text-xs text-blue-400/70 text-center px-1">
                                  📸 Photo requise dans Personnages
                                </p>
                              );
                            }
                            return null;
                          })()}
                          {scene.imageUrl && (() => {
                            const histCount = getHistory(scene).length;
                            return (
                              <button
                                onClick={() => setShowImageHistory(scene.id)}
                                className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-[#1e1e2e] hover:bg-[#2a2a3e] border border-[#2a2a3e] hover:border-gray-500 text-gray-400 hover:text-white text-xs rounded-xl transition-all"
                              >
                                <Clock className="w-3 h-3" />
                                Historique {histCount > 0 ? `(${histCount})` : ""}
                              </button>
                            );
                          })()}
                          <div className="flex justify-center items-center gap-1.5">
                            <span className="text-xs text-gray-600 truncate max-w-[70px]">{IMAGE_GENERATORS.find(g => g.id === selectedImgGen)?.name.split(" ")[0]}</span>
                            <CostBadge cost={IMAGE_GENERATORS.find(g => g.id === selectedImgGen)?.pricePerImage || 0.08} label="img" />
                          </div>
                        </div>
                      </div>

                      {/* Right: script info */}
                      <div className="space-y-3">
                        {characters.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Personnages</p>
                            <div className="flex flex-wrap gap-1">
                              {characters.map(c => (
                                <span key={c} className="text-xs px-2 py-0.5 bg-blue-600/20 border border-blue-600/30 rounded-full text-blue-300">{c}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {scene.action && <ScriptField label="Action" value={scene.action} />}
                        {scene.emotion && <ScriptField label="Émotion" value={scene.emotion} accent="yellow" />}
                        {scene.camera && <ScriptField label="Caméra" value={scene.camera} />}
                      </div>
                    </div>

                    {/* Narration + Dialogue */}
                    {(scene.narration || scene.dialogue) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {scene.narration && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Narration</p>
                              <button onClick={() => copyText(scene.narration!)} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"><Copy className="w-3 h-3" /></button>
                            </div>
                            <div className="bg-blue-900/10 border border-blue-600/30 rounded-xl p-3">
                              <p className="text-sm text-blue-200 leading-relaxed italic">&ldquo;{scene.narration}&rdquo;</p>
                            </div>
                          </div>
                        )}
                        {scene.dialogue && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Dialogue</p>
                              <button onClick={() => copyText(scene.dialogue!)} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"><Copy className="w-3 h-3" /></button>
                            </div>
                            <div className="bg-purple-900/10 border border-purple-600/30 rounded-xl p-3">
                              <p className="text-sm text-purple-200 leading-relaxed whitespace-pre-line">{scene.dialogue}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sound Design */}
                    {scene.soundDesign && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Design sonore</p>
                        <div className="bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl p-3">
                          <p className="text-sm text-gray-300">🎵 {scene.soundDesign}</p>
                        </div>
                      </div>
                    )}

                    {/* Prompts */}
                    {scene.imagePrompt && (
                      <details className="group">
                        <summary className="flex items-center justify-between cursor-pointer text-xs text-gray-500 uppercase tracking-wide py-1 hover:text-gray-300 transition-colors list-none">
                          Prompt image
                          <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.preventDefault(); copyText(scene.imagePrompt!); }} />
                        </summary>
                        <div className="mt-2 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl p-3">
                          <p className="text-xs text-gray-400 font-mono leading-relaxed">{scene.imagePrompt}</p>
                        </div>
                      </details>
                    )}
                    {scene.videoPrompt && (
                      <details className="group">
                        <summary className="flex items-center justify-between cursor-pointer text-xs text-gray-500 uppercase tracking-wide py-1 hover:text-gray-300 transition-colors list-none">
                          Prompt vidéo
                          <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.preventDefault(); copyText(scene.videoPrompt!); }} />
                        </summary>
                        <div className="mt-2 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl p-3">
                          <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">{scene.videoPrompt}</p>
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ScriptField({ label, value, accent }: { label: string; value: string; accent?: "yellow" }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <div className={`rounded-lg p-2 border text-sm ${accent === "yellow" ? "bg-yellow-900/10 border-yellow-600/20 text-yellow-200" : "bg-[#1e1e2e] border-[#2a2a3e] text-gray-300"}`}>
        {value}
      </div>
    </div>
  );
}
