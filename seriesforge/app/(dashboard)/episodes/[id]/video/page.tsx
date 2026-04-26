"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowLeft, Video, Loader2, Copy, ExternalLink, Music, SlidersHorizontal,
  Play, Square, Download, Sparkles, CheckCircle, Clock, ChevronDown,
  Volume2, Mic, Image, Zap, AlertCircle, Film
} from "lucide-react";
import { CostBadge, CostSummary } from "@/components/ui/CostBadge";
import { COSTS } from "@/lib/costs";
import { VideoGeneratorPicker } from "@/components/ui/GeneratorPicker";
import { VIDEO_GENERATORS, getDefaultVideoGenerator, setDefaultVideoGenerator } from "@/lib/generators";

interface Scene {
  id: string;
  sceneNumber: number;
  timecode?: string;
  location?: string;
  action?: string;
  narration?: string;
  dialogue?: string;
  videoPrompt?: string;
  videoUrl?: string;
  imageUrl?: string;
  voiceUrl?: string;
  qualityScore?: number;
  status: string;
}

interface Episode {
  id: string;
  title: string;
  format: string;
  status: string;
  bgMusicUrl?: string | null;
  bgMusicName?: string | null;
  bgMusicVolume?: number;
  scenes: Scene[];
}

const STEP_CONFIG = [
  { id: 1, label: "Storyboard", desc: "Images des scènes", icon: Image, href: "storyboard", color: "blue" },
  { id: 2, label: "Dialogues & Voix", desc: "HeyGen TTS", icon: Mic, href: "audio", color: "orange" },
  { id: 3, label: "Génération Vidéo", desc: "Kling, Runway, Luma...", icon: Video, href: "video", color: "green" },
];

export default function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVidGen, setSelectedVidGen] = useState(getDefaultVideoGenerator);
  const [defaultVidGen, setDefaultVidGenState] = useState(getDefaultVideoGenerator);
  const [duration, setDuration] = useState(5);
  const [showGenPicker, setShowGenPicker] = useState(false);
  const [generatingScene, setGeneratingScene] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [expandedScene, setExpandedScene] = useState<string | null>(null);
  const [playingBg, setPlayingBg] = useState(false);
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { fetchEpisode(); }, [id]);

  async function fetchEpisode() {
    try {
      const res = await fetch(`/api/episodes/${id}`);
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      setEpisode(data);
    } finally { setLoading(false); }
  }

  function handleSetDefault(genId: string) {
    setDefaultVidGenState(genId);
    setDefaultVideoGenerator(genId);
    const gen = VIDEO_GENERATORS.find(g => g.id === genId);
    toast.success(`${gen?.name} défini par défaut`);
  }

  async function generateSceneVideo(scene: Scene) {
    setGeneratingScene(scene.id);
    const gen = VIDEO_GENERATORS.find(g => g.id === selectedVidGen);
    const t = toast.loading(`🎬 Génération vidéo scène ${scene.sceneNumber} avec ${gen?.name}... (20-60s)`, { duration: 120000 });
    try {
      const res = await fetch("/api/generate/scene-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId: scene.id, generatorId: selectedVidGen, duration }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.dismiss(t);
      const frameInfo = data.usedFirstFrame ? " (première image utilisée)" : "";
      toast.success(`✅ Vidéo scène ${scene.sceneNumber} générée !${frameInfo}`);
      fetchEpisode();
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Erreur génération vidéo");
    } finally { setGeneratingScene(null); }
  }

  async function generateAllVideos() {
    if (!episode) return;
    const scenesWithPrompt = episode.scenes.filter(s => s.videoPrompt);
    if (scenesWithPrompt.length === 0) {
      toast.error("Aucune scène avec prompt vidéo. Lancez d'abord le pipeline.");
      return;
    }
    setGeneratingAll(true);
    const t = toast.loading(`🎬 Génération de ${scenesWithPrompt.length} vidéos... (peut prendre plusieurs minutes)`, { duration: 600000 });
    let success = 0;
    for (const scene of scenesWithPrompt) {
      try {
        const res = await fetch("/api/generate/scene-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sceneId: scene.id, generatorId: selectedVidGen, duration }),
        });
        const data = await res.json();
        if (res.ok && data.videoUrl) success++;
      } catch {}
    }
    toast.dismiss(t);
    toast.success(`✅ ${success}/${scenesWithPrompt.length} vidéos générées !`);
    setGeneratingAll(false);
    fetchEpisode();
  }

  function toggleBgMusic() {
    if (!episode?.bgMusicUrl) return;
    if (playingBg && bgAudioRef.current) {
      bgAudioRef.current.pause();
      setPlayingBg(false);
    } else {
      const audio = new Audio(episode.bgMusicUrl);
      audio.volume = episode.bgMusicVolume ?? 0.2;
      audio.loop = true;
      audio.play();
      bgAudioRef.current = audio;
      setPlayingBg(true);
    }
  }

  function copyPrompt(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Prompt copié !");
  }

  function downloadVideo(url: string, sceneNumber: number) {
    const a = document.createElement("a");
    a.href = url;
    a.download = `scene-${sceneNumber}-${episode?.title || "video"}.mp4`;
    a.target = "_blank";
    a.click();
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>;
  if (!episode) return null;

  const scenesWithVideo = episode.scenes.filter(s => s.videoUrl).length;
  const scenesWithPrompt = episode.scenes.filter(s => s.videoPrompt).length;
  const scenesWithVoice = episode.scenes.filter(s => s.voiceUrl).length;
  const scenesWithImage = episode.scenes.filter(s => s.imageUrl).length;
  const currentGen = VIDEO_GENERATORS.find(g => g.id === selectedVidGen);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href={`/episodes/${id}/editor`} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" /> Retour à l'éditeur
        </Link>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Video className="w-7 h-7 text-green-400" /> Génération Vidéo
        </h1>
        <p className="text-gray-400 mt-1">{episode.title}</p>
      </div>

      {/* Pipeline Steps */}
      <div className="mb-6 bg-[#13131a] border border-[#2a2a3e] rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Pipeline de création</h2>
        <div className="grid grid-cols-3 gap-3">
          {STEP_CONFIG.map((step) => {
            const Icon = step.icon;
            const isDone = step.id === 1 ? scenesWithImage > 0
              : step.id === 2 ? scenesWithVoice > 0
              : scenesWithVideo > 0;
            const isActive = step.id === 3;
            return (
              <Link key={step.id} href={`/episodes/${id}/${step.href}`}
                className={`relative p-4 rounded-xl border transition-all hover:scale-[1.01] ${isActive ? "border-green-500/50 bg-green-600/5" : isDone ? "border-green-600/30 bg-green-900/5" : "border-[#2a2a3e] bg-[#1e1e2e]"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isDone ? "bg-green-600 text-white" : "bg-[#2a2a3e] text-gray-400"}`}>
                    {isDone ? "✓" : step.id}
                  </span>
                  {isActive && <span className="text-xs px-1.5 py-0.5 bg-green-600/20 border border-green-600/30 rounded-full text-green-400">Actuel</span>}
                </div>
                <Icon className={`w-5 h-5 mb-1 text-${step.color}-400`} />
                <p className="font-semibold text-white text-sm">{step.label}</p>
                <p className="text-xs text-gray-500">{step.desc}</p>
                {step.id === 1 && <p className={`text-xs mt-1 font-medium ${scenesWithImage > 0 ? "text-green-400" : "text-gray-600"}`}>{scenesWithImage}/{episode.scenes.length} images</p>}
                {step.id === 2 && <p className={`text-xs mt-1 font-medium ${scenesWithVoice > 0 ? "text-orange-400" : "text-gray-600"}`}>{scenesWithVoice}/{episode.scenes.length} voix</p>}
                {step.id === 3 && <p className={`text-xs mt-1 font-medium ${scenesWithVideo > 0 ? "text-green-400" : "text-gray-600"}`}>{scenesWithVideo}/{episode.scenes.length} vidéos</p>}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Video Generator Selector */}
      <div className="mb-6 bg-[#13131a] border border-[#2a2a3e] rounded-2xl overflow-hidden">
        <button onClick={() => setShowGenPicker(!showGenPicker)} className="w-full flex items-center justify-between p-5 hover:bg-white/2 transition-all">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-bold text-white">Moteur de génération vidéo</span>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 bg-green-600/20 border border-green-600/30 rounded-full text-green-300">
                🎬 {currentGen?.name} — ~${duration <= 5 ? currentGen?.pricePer5s.toFixed(2) : currentGen?.pricePer10s.toFixed(2)}/{duration}s
              </span>
              <div className="flex gap-2">
                {[5, 10].map(d => (
                  <button key={d} onClick={e => { e.stopPropagation(); setDuration(d); }}
                    className={`px-2 py-0.5 rounded-lg text-xs font-medium transition-all ${duration === d ? "bg-green-600 text-white" : "bg-[#1e1e2e] border border-[#2a2a3e] text-gray-400"}`}>
                    {d}s
                  </button>
                ))}
              </div>
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showGenPicker ? "rotate-180" : ""}`} />
        </button>
        {showGenPicker && (
          <div className="border-t border-[#2a2a3e] p-5">
            <VideoGeneratorPicker
              selected={selectedVidGen}
              onSelect={setSelectedVidGen}
              onSetDefault={handleSetDefault}
              defaultId={defaultVidGen}
              duration={duration as 5 | 10}
            />
          </div>
        )}
      </div>

      {/* Background Music Banner */}
      <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 ${episode.bgMusicUrl ? "bg-purple-900/10 border-purple-600/30" : "bg-[#13131a] border-dashed border-[#2a2a3e]"}`}>
        <div className={`p-2 rounded-lg flex-shrink-0 ${episode.bgMusicUrl ? "bg-purple-600/20" : "bg-[#1e1e2e]"}`}>
          <Music className={`w-4 h-4 ${episode.bgMusicUrl ? "text-purple-400" : "text-gray-600"}`} />
        </div>
        <div className="flex-1 min-w-0">
          {episode.bgMusicUrl ? (
            <>
              <p className="text-sm text-white font-medium">🎵 {episode.bgMusicName} <span className="text-purple-300 font-mono text-xs">vol. {Math.round((episode.bgMusicVolume ?? 0.2) * 100)}%</span></p>
              <audio controls src={episode.bgMusicUrl} className="h-6 w-40 mt-0.5" />
            </>
          ) : (
            <p className="text-sm text-gray-400">Pas de musique de fond — <Link href={`/episodes/${id}/audio`} className="text-purple-400 hover:text-purple-300">ajouter dans Audio</Link></p>
          )}
        </div>
        <Link href={`/episodes/${id}/audio`} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e1e2e] hover:bg-[#2a2a3e] border border-[#2a2a3e] text-gray-400 hover:text-white text-xs rounded-lg transition-all">
          <SlidersHorizontal className="w-3 h-3" /> Régler
        </Link>
      </div>

      {/* Generate All Button */}
      {episode.scenes.length > 0 && (
        <div className="mb-6 flex items-center gap-3 flex-wrap">
          <button
            onClick={generateAllVideos}
            disabled={generatingAll || scenesWithPrompt === 0}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all text-sm"
          >
            {generatingAll ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
            {generatingAll ? "Génération en cours..." : `Générer toutes les vidéos (${scenesWithPrompt} scènes)`}
          </button>
          <CostSummary items={[{ label: `${scenesWithPrompt} vidéos ${duration}s`, cost: (duration <= 5 ? currentGen?.pricePer5s : currentGen?.pricePer10s) || 0.35, qty: scenesWithPrompt }]} />
          {scenesWithPrompt === 0 && (
            <p className="text-xs text-orange-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Lancez d'abord le pipeline dans l'Éditeur
            </p>
          )}
        </div>
      )}

      {/* Scene List */}
      {episode.scenes.length === 0 ? (
        <div className="text-center py-16 bg-[#13131a] border border-dashed border-[#2a2a3e] rounded-2xl">
          <Video className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-2">Aucune scène. Lancez le pipeline dans l'Éditeur d'abord.</p>
          <Link href={`/episodes/${id}/editor`} className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all">
            <Zap className="w-4 h-4" /> Aller à l'Éditeur
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {episode.scenes.map(scene => {
            const isGenerating = generatingScene === scene.id;
            const hasVideo = !!scene.videoUrl;
            const hasVoice = !!scene.voiceUrl;
            const hasImage = !!scene.imageUrl;

            return (
              <div key={scene.id} className={`bg-[#13131a] border rounded-2xl overflow-hidden ${hasVideo ? "border-green-500/30" : "border-[#2a2a3e]"}`}>
                <div className="aspect-[9/16] bg-[#1e1e2e] relative overflow-hidden flex items-center justify-center">
                  {scene.videoUrl ? (
                    <video
                      controls
                      src={scene.videoUrl}
                      className="w-full h-full object-cover"
                    />
                  ) : scene.imageUrl ? (
                    <img src={scene.imageUrl} alt={`Scène ${scene.sceneNumber}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4">
                      <Video className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">Aucune vidéo générée</p>
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

                  <div className="absolute top-2 right-2 flex gap-2">
                    {hasVideo && (
                      <button
                        onClick={() => downloadVideo(scene.videoUrl!, scene.sceneNumber)}
                        className="px-2 py-1 bg-black/70 hover:bg-black/90 text-white text-xs rounded-lg border border-white/10 flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" /> MP4
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {scene.location || `Scène ${scene.sceneNumber}`}
                      </p>
                      {scene.timecode && <p className="text-xs text-gray-500 mt-0.5">{scene.timecode}</p>}
                      {scene.action && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{scene.action}</p>}
                    </div>
                    <button
                      onClick={() => setExpandedScene(expandedScene === scene.id ? null : scene.id)}
                      className="p-1.5 bg-[#1e1e2e] hover:bg-[#2a2a3e] border border-[#2a2a3e] rounded-lg transition-all"
                    >
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedScene === scene.id ? "rotate-180" : ""}`} />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className={`text-xs flex items-center gap-1 px-2 py-1 rounded-full border ${hasImage ? "text-blue-400 border-blue-600/30 bg-blue-600/10" : "text-gray-600 border-[#2a2a3e] bg-[#1e1e2e]"}`}>
                      <Image className="w-3 h-3" /> {hasImage ? "Image prête" : "Pas d'image"}
                    </span>
                    <span className={`text-xs flex items-center gap-1 px-2 py-1 rounded-full border ${hasVoice ? "text-orange-400 border-orange-600/30 bg-orange-600/10" : "text-gray-600 border-[#2a2a3e] bg-[#1e1e2e]"}`}>
                      <Mic className="w-3 h-3" /> {hasVoice ? "Voix prête" : "Pas de voix"}
                    </span>
                    <span className={`text-xs flex items-center gap-1 px-2 py-1 rounded-full border ${hasVideo ? "text-green-400 border-green-600/30 bg-green-600/10" : "text-gray-600 border-[#2a2a3e] bg-[#1e1e2e]"}`}>
                      <Video className="w-3 h-3" /> {hasVideo ? "Vidéo générée" : "À générer"}
                    </span>
                  </div>

                  {scene.voiceUrl && (
                    <audio controls src={scene.voiceUrl} className="w-full h-9" />
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => generateSceneVideo(scene)}
                      disabled={isGenerating || generatingAll || !scene.videoPrompt}
                      title={!scene.videoPrompt ? "Lancez d'abord le pipeline" : "Générer la vidéo"}
                      className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-3 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-all"
                    >
                      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {isGenerating ? "Génération..." : hasVideo ? "Regénérer" : "Générer"}
                    </button>
                    {scene.videoPrompt && (
                      <button
                        onClick={() => copyPrompt(scene.videoPrompt!)}
                        className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[#1e1e2e] border border-[#2a2a3e] hover:border-purple-500/50 text-gray-300 text-sm rounded-xl transition-all"
                      >
                        <Copy className="w-4 h-4" /> Prompt
                      </button>
                    )}
                  </div>

                  {expandedScene === scene.id && (
                    <div className="pt-3 border-t border-[#2a2a3e] space-y-3">
                      {scene.dialogue && (
                        <div className="bg-purple-900/10 border border-purple-600/20 rounded-lg p-3">
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Dialogue</p>
                          <p className="text-sm text-purple-200 whitespace-pre-line">{scene.dialogue}</p>
                        </div>
                      )}
                      {scene.narration && (
                        <div className="bg-blue-900/10 border border-blue-600/20 rounded-lg p-3">
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Narration</p>
                          <p className="text-sm text-blue-200 italic">&ldquo;{scene.narration}&rdquo;</p>
                        </div>
                      )}
                      {scene.videoPrompt && (
                        <div className="bg-[#1e1e2e] border border-[#2a2a3e] rounded-lg p-3">
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Prompt vidéo</p>
                          <p className="text-xs text-gray-400 whitespace-pre-wrap">{scene.videoPrompt}</p>
                        </div>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        {[
                          { name: "Kling AI", url: "https://klingai.com" },
                          { name: "Runway", url: "https://runwayml.com" },
                          { name: "Luma Dream", url: "https://lumalabs.ai" },
                        ].map(p => (
                          <a
                            key={p.name}
                            href={p.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 px-2 py-1 bg-[#1e1e2e] border border-[#2a2a3e] hover:border-gray-400 text-gray-400 hover:text-white text-xs rounded-lg transition-all"
                          >
                            {p.name} <ExternalLink className="w-3 h-3" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assemble CTA */}
      <div className={`mt-6 p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${scenesWithVideo > 0 || episode.scenes.some(s => s.imageUrl) ? "bg-purple-900/20 border-purple-600/30" : "bg-[#13131a] border-[#2a2a3e]"}`}>
        <div>
          <h3 className="font-bold text-white text-lg flex items-center gap-2">
            <Film className="w-5 h-5 text-purple-400" /> Assembler l'épisode final
          </h3>
          <p className="text-gray-400 text-sm mt-1">
            FFmpeg assemble toutes les scènes + voix HeyGen + musique de fond → un seul MP4 prêt à publier
          </p>
          <div className="flex gap-3 mt-2 text-xs">
            <span className={scenesWithVideo > 0 || episode.scenes.some(s => s.imageUrl) ? "text-green-400" : "text-gray-600"}>
              ✓ {scenesWithVideo} vidéos + {episode.scenes.filter(s => s.imageUrl && !s.videoUrl).length} images
            </span>
            <span className={episode.scenes.some(s => s.voiceUrl) ? "text-orange-400" : "text-gray-600"}>
              {episode.scenes.some(s => s.voiceUrl) ? `✓ ${episode.scenes.filter(s => s.voiceUrl).length} voix` : "○ Pas de voix"}
            </span>
            <span className={episode.bgMusicUrl ? "text-purple-400" : "text-gray-600"}>
              {episode.bgMusicUrl ? `✓ Musique (${Math.round((episode.bgMusicVolume ?? 0.2) * 100)}%)` : "○ Pas de musique"}
            </span>
          </div>
        </div>
        <Link
          href={`/episodes/${id}/assemble`}
          className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all whitespace-nowrap glow-purple"
        >
          <Film className="w-5 h-5" /> Assembler &amp; Télécharger
        </Link>
      </div>
    </div>
  );
}
