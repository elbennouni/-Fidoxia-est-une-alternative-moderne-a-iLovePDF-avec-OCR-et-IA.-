"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowLeft, Play, Image, Volume2, Video, Download, Loader2,
  ChevronRight, Sparkles, CheckCircle, Clock, AlertCircle, Zap
} from "lucide-react";

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
  videoUrl?: string;
}

interface Episode {
  id: string;
  title: string;
  status: string;
  format: string;
  script?: string;
  seriesId: string;
  series: {
    id: string;
    title: string;
    visualStyle: string;
    tone: string;
  };
  scenes: Scene[];
}

const STATUS_CONFIG = {
  draft: { color: "text-gray-400", bg: "bg-gray-600/20", icon: Clock },
  generating: { color: "text-yellow-400", bg: "bg-yellow-600/20", icon: Loader2 },
  complete: { color: "text-green-400", bg: "bg-green-600/20", icon: CheckCircle },
  error: { color: "text-red-400", bg: "bg-red-600/20", icon: AlertCircle },
};

const SCENE_STATUS_COLORS: Record<string, string> = {
  pending: "text-gray-400",
  scripted: "text-blue-400",
  storyboarded: "text-purple-400",
  audio_planned: "text-orange-400",
  approved: "text-green-400",
  fixed: "text-teal-400",
};

export default function EpisodeEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [activeTab, setActiveTab] = useState<"script" | "image" | "video" | "audio">("script");

  useEffect(() => { fetchEpisode(); }, [id]);

  async function fetchEpisode() {
    try {
      const res = await fetch(`/api/episodes/${id}`);
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      setEpisode(data);
      if (data.scenes?.length > 0) setSelectedScene(data.scenes[0]);
    } finally {
      setLoading(false);
    }
  }

  async function runPipeline() {
    setRunning(true);
    const t = toast.loading("🎬 Running AI pipeline (2-3 min)...", { duration: 200000 });
    try {
      const res = await fetch(`/api/episodes/${id}/run-pipeline`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.dismiss(t);
      toast.success(`✅ Done! ${data.sceneCount} scenes · avg score ${data.averageQualityScore}/100 · ${data.fixedScenes} fixed`);
      fetchEpisode();
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Pipeline failed");
    } finally {
      setRunning(false);
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
      a.download = `episode-${id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded!");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
    </div>
  );

  if (!episode) return null;

  const statusCfg = STATUS_CONFIG[episode.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.draft;
  const StatusIcon = statusCfg.icon;
  const avgScore = episode.scenes.length > 0
    ? Math.round(episode.scenes.reduce((s, sc) => s + (sc.qualityScore || 0), 0) / episode.scenes.length)
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link href={`/series/${episode.series.id}/episodes`} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" /> Back to Episodes
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{episode.title}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-sm text-gray-400">{episode.series.title}</span>
              <span className="text-gray-600">·</span>
              <span className={`flex items-center gap-1 text-sm ${statusCfg.color}`}>
                <StatusIcon className={`w-3.5 h-3.5 ${episode.status === "generating" ? "animate-spin" : ""}`} />
                {episode.status}
              </span>
              {avgScore !== null && avgScore > 0 && (
                <>
                  <span className="text-gray-600">·</span>
                  <span className={`text-sm font-medium ${avgScore >= 85 ? "text-green-400" : "text-yellow-400"}`}>
                    Avg score: {avgScore}/100
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={runPipeline}
              disabled={running}
              className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-xl transition-all"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {running ? "Generating..." : "Generate Episode Pipeline"}
            </button>
            {episode.scenes.length > 0 && (
              <>
                <Link href={`/episodes/${id}/storyboard`} className="flex items-center gap-2 px-4 py-2.5 bg-[#1e1e2e] border border-[#2a2a3e] hover:border-blue-500/50 text-gray-300 text-sm rounded-xl transition-all">
                  <Image className="w-4 h-4" /> Storyboard
                </Link>
                <Link href={`/episodes/${id}/audio`} className="flex items-center gap-2 px-4 py-2.5 bg-[#1e1e2e] border border-[#2a2a3e] hover:border-orange-500/50 text-gray-300 text-sm rounded-xl transition-all">
                  <Volume2 className="w-4 h-4" /> Audio
                </Link>
                <Link href={`/episodes/${id}/video`} className="flex items-center gap-2 px-4 py-2.5 bg-[#1e1e2e] border border-[#2a2a3e] hover:border-green-500/50 text-gray-300 text-sm rounded-xl transition-all">
                  <Video className="w-4 h-4" /> Video
                </Link>
                <button onClick={exportJson} disabled={exporting} className="flex items-center gap-2 px-4 py-2.5 bg-[#1e1e2e] border border-[#2a2a3e] hover:border-gray-400 text-gray-300 text-sm rounded-xl transition-all">
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Export
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {episode.script && (
        <div className="mb-6 p-4 bg-[#13131a] border border-[#2a2a3e] rounded-xl">
          <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Synopsis</p>
          <p className="text-gray-300 text-sm">{episode.script}</p>
        </div>
      )}

      {episode.scenes.length === 0 ? (
        <div className="text-center py-16 bg-[#13131a] border border-dashed border-[#2a2a3e] rounded-2xl">
          <Sparkles className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-xl font-bold text-white mb-2">Ready to Generate</p>
          <p className="text-gray-400 mb-2">Click &quot;Generate Episode Pipeline&quot; to run the full AI pipeline:</p>
          <p className="text-gray-500 text-sm mb-6">Script → Scenes → Storyboard → Audio → Quality Control → Auto-Fix</p>
          <button onClick={runPipeline} disabled={running} className="px-8 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center gap-2 mx-auto">
            {running ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
            {running ? "Generating..." : "Generate Episode Pipeline"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Scene List */}
          <div className="lg:col-span-1">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Scenes ({episode.scenes.length})</h2>
            <div className="space-y-2 max-h-[70vh] overflow-y-auto scrollbar-thin pr-1">
              {episode.scenes.map(scene => (
                <button
                  key={scene.id}
                  onClick={() => setSelectedScene(scene)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    selectedScene?.id === scene.id
                      ? "bg-purple-600/20 border-purple-500/50"
                      : "bg-[#13131a] border-[#2a2a3e] hover:border-purple-500/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-white">Scene {scene.sceneNumber}</span>
                    <div className="flex items-center gap-2">
                      {scene.qualityScore && (
                        <span className={`text-xs font-bold ${scene.qualityScore >= 85 ? "text-green-400" : "text-yellow-400"}`}>
                          {scene.qualityScore}
                        </span>
                      )}
                      <span className={`text-xs ${SCENE_STATUS_COLORS[scene.status] || "text-gray-400"}`}>●</span>
                    </div>
                  </div>
                  {scene.timecode && <p className="text-xs text-gray-500 mb-1">{scene.timecode}</p>}
                  {scene.location && <p className="text-xs text-gray-400 truncate">📍 {scene.location}</p>}
                  {scene.action && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{scene.action}</p>}
                </button>
              ))}
            </div>
          </div>

          {/* Scene Detail */}
          <div className="lg:col-span-2">
            {selectedScene ? (
              <div className="bg-[#13131a] border border-[#2a2a3e] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-[#2a2a3e]">
                  <h2 className="font-bold text-white">Scene {selectedScene.sceneNumber}</h2>
                  <div className="flex items-center gap-2">
                    {selectedScene.qualityScore && (
                      <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${selectedScene.qualityScore >= 85 ? "bg-green-600/20 text-green-400" : "bg-yellow-600/20 text-yellow-400"}`}>
                        {selectedScene.qualityScore}/100
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full bg-[#1e1e2e] ${SCENE_STATUS_COLORS[selectedScene.status] || "text-gray-400"}`}>
                      {selectedScene.status}
                    </span>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-[#2a2a3e]">
                  {(["script", "image", "video", "audio"] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 py-2.5 text-sm font-medium transition-all ${
                        activeTab === tab
                          ? "text-purple-300 border-b-2 border-purple-500 bg-purple-600/5"
                          : "text-gray-400 hover:text-gray-300"
                      }`}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>

                <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
                  {activeTab === "script" && (
                    <>
                      {selectedScene.location && <Field label="Location" value={selectedScene.location} />}
                      {selectedScene.charactersJson && (
                        <Field label="Characters" value={JSON.parse(selectedScene.charactersJson || "[]").join(", ")} />
                      )}
                      {selectedScene.action && <Field label="Action" value={selectedScene.action} />}
                      {selectedScene.narration && <Field label="Narration" value={selectedScene.narration} accent="blue" />}
                      {selectedScene.dialogue && <Field label="Dialogue" value={selectedScene.dialogue} accent="purple" />}
                      {selectedScene.camera && <Field label="Camera" value={selectedScene.camera} />}
                      {selectedScene.emotion && <Field label="Emotion" value={selectedScene.emotion} />}
                      {selectedScene.soundDesign && <Field label="Sound Design" value={selectedScene.soundDesign} />}
                    </>
                  )}
                  {activeTab === "image" && (
                    <>
                      {selectedScene.imagePrompt ? (
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Image Prompt</p>
                          <div className="bg-[#1e1e2e] rounded-xl p-4 border border-[#2a2a3e]">
                            <p className="text-sm text-gray-200 leading-relaxed font-mono">{selectedScene.imagePrompt}</p>
                          </div>
                          {selectedScene.imageUrl ? (
                            <img src={selectedScene.imageUrl} alt="Scene" className="mt-4 rounded-xl w-full" />
                          ) : (
                            <div className="mt-4 aspect-video bg-[#1e1e2e] border border-dashed border-[#2a2a3e] rounded-xl flex items-center justify-center">
                              <div className="text-center">
                                <Image className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                                <p className="text-xs text-gray-500">Image not yet generated</p>
                                <p className="text-xs text-gray-600">Use Replicate/Fal API to generate</p>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : <EmptyState label="No image prompt yet. Run the pipeline first." />}
                    </>
                  )}
                  {activeTab === "video" && (
                    <>
                      {selectedScene.videoPrompt ? (
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Video Prompt</p>
                          <div className="bg-[#1e1e2e] rounded-xl p-4 border border-[#2a2a3e]">
                            <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{selectedScene.videoPrompt}</p>
                          </div>
                          {!selectedScene.videoUrl && (
                            <div className="mt-4 p-3 bg-blue-900/20 border border-blue-600/30 rounded-xl">
                              <p className="text-xs text-blue-300">Video generation via Kling AI / Runway / Replicate — connect API keys to generate.</p>
                            </div>
                          )}
                        </div>
                      ) : <EmptyState label="No video prompt yet. Run the pipeline first." />}
                    </>
                  )}
                  {activeTab === "audio" && (
                    <>
                      {selectedScene.audioPrompt ? (
                        <div>
                          <Field label="Audio Direction" value={selectedScene.audioPrompt} />
                          {selectedScene.voiceProvider && <Field label="Voice Provider" value={selectedScene.voiceProvider} />}
                          {selectedScene.narration && <Field label="Narration Text" value={selectedScene.narration} accent="blue" />}
                          {selectedScene.dialogue && <Field label="Dialogue" value={selectedScene.dialogue} accent="purple" />}
                        </div>
                      ) : <EmptyState label="No audio plan yet. Run the pipeline first." />}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 bg-[#13131a] border border-[#2a2a3e] rounded-xl">
                <p className="text-gray-400">Select a scene to view details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, accent }: { label: string; value: string; accent?: "blue" | "purple" }) {
  const accentStyles = {
    blue: "border-blue-600/30 bg-blue-900/10",
    purple: "border-purple-600/30 bg-purple-900/10",
  };
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <div className={`bg-[#1e1e2e] rounded-lg p-3 border ${accent ? accentStyles[accent] : "border-[#2a2a3e]"}`}>
        <p className="text-sm text-gray-200 leading-relaxed">{value}</p>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-32 bg-[#1e1e2e] border border-dashed border-[#2a2a3e] rounded-xl">
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}
