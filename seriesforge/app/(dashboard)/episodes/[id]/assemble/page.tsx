"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowLeft, Film, Loader2, Download, Play, Pause, CheckCircle,
  Image, Mic, Video, Music, Zap, Square, AlertCircle, Share2, ExternalLink
} from "lucide-react";

interface Scene {
  id: string;
  sceneNumber: number;
  imageUrl?: string;
  videoUrl?: string;
  voiceUrl?: string;
  narration?: string;
  dialogue?: string;
}

interface Episode {
  id: string;
  title: string;
  format: string;
  bgMusicUrl?: string;
  bgMusicName?: string;
  bgMusicVolume?: number;
  scenes: Scene[];
  series: { title: string; visualStyle: string };
}

export default function AssemblePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [assembling, setAssembling] = useState(false);
  const [assembledUrl, setAssembledUrl] = useState<string | null>(null);
  const [assembledFile, setAssembledFile] = useState<string | null>(null);
  const [assembleResult, setAssembleResult] = useState<{
    sceneCount: number; hasBgMusic: boolean; message: string;
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => { fetchEpisode(); }, [id]);

  async function fetchEpisode() {
    try {
      const res = await fetch(`/api/episodes/${id}`);
      if (res.status === 401) { router.push("/login"); return; }
      setEpisode(await res.json());
    } finally { setLoading(false); }
  }

  async function assembleEpisode() {
    setAssembling(true);
    const t = toast.loading("🎬 Assemblage en cours avec FFmpeg... (peut prendre 1-3 min)", { duration: 300000 });
    try {
      const res = await fetch(`/api/episodes/${id}/assemble`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.dismiss(t);
      toast.success(`✅ ${data.message}`);
      setAssembledUrl(data.outputUrl);
      setAssembledFile(data.fileName);
      setAssembleResult({ sceneCount: data.sceneCount, hasBgMusic: data.hasBgMusic, message: data.message });
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Assemblage échoué");
    } finally { setAssembling(false); }
  }

  function togglePlay() {
    if (!videoRef.current) return;
    if (isPlaying) { videoRef.current.pause(); setIsPlaying(false); }
    else { videoRef.current.play(); setIsPlaying(true); }
  }

  function downloadVideo() {
    if (!assembledUrl) return;
    const a = document.createElement("a");
    a.href = assembledUrl;
    a.download = assembledFile || `episode-${id}.mp4`;
    a.click();
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>;
  if (!episode) return null;

  const scenesWithVideo = episode.scenes.filter(s => s.videoUrl).length;
  const scenesWithImage = episode.scenes.filter(s => s.imageUrl).length;
  const scenesWithVoice = episode.scenes.filter(s => s.voiceUrl).length;
  const totalScenes = episode.scenes.length;

  const canAssemble = scenesWithVideo > 0 || scenesWithImage > 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href={`/episodes/${id}/video`} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" /> Retour aux vidéos
        </Link>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Film className="w-7 h-7 text-purple-400" /> Assemblage Final
        </h1>
        <p className="text-gray-400 mt-1">{episode.title} — {episode.series.title}</p>
      </div>

      {/* Status Checklist */}
      <div className="mb-6 bg-[#13131a] border border-[#2a2a3e] rounded-2xl p-5">
        <h2 className="font-bold text-white mb-4 text-sm uppercase tracking-wide">Vérification avant assemblage</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Images / Vidéos", count: scenesWithVideo || scenesWithImage, total: totalScenes, icon: scenesWithVideo > 0 ? Video : Image, color: (scenesWithVideo > 0 || scenesWithImage > 0) ? "green" : "red", required: true },
            { label: "Voix HeyGen", count: scenesWithVoice, total: totalScenes, icon: Mic, color: scenesWithVoice > 0 ? "orange" : "gray", required: false },
            { label: "Musique fond", count: episode.bgMusicUrl ? 1 : 0, total: 1, icon: Music, color: episode.bgMusicUrl ? "purple" : "gray", required: false },
            { label: "Scènes totales", count: totalScenes, total: totalScenes, icon: Film, color: totalScenes > 0 ? "blue" : "red", required: true },
          ].map(({ label, count, total, icon: Icon, color, required }) => (
            <div key={label} className={`p-3 rounded-xl border text-center ${count > 0 ? `bg-${color}-900/10 border-${color}-600/30` : "bg-[#1e1e2e] border-[#2a2a3e]"}`}>
              <Icon className={`w-5 h-5 mx-auto mb-1 ${count > 0 ? `text-${color}-400` : "text-gray-600"}`} />
              <p className="text-xs text-gray-400 mb-0.5">{label}</p>
              <p className={`text-sm font-bold ${count > 0 ? "text-white" : required ? "text-red-400" : "text-gray-500"}`}>
                {count > 0 ? `${count}/${total}` : required ? "❌ Requis" : "Optionnel"}
              </p>
            </div>
          ))}
        </div>

        {!canAssemble && (
          <div className="mt-4 p-3 bg-red-900/20 border border-red-600/30 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">Il faut au moins des images ou des vidéos pour assembler. Générez d'abord le storyboard ou les vidéos.</p>
          </div>
        )}

        {canAssemble && (
          <div className="mt-4 p-3 bg-green-900/10 border border-green-600/20 rounded-xl">
            <p className="text-sm text-green-300">
              ✅ Prêt pour l'assemblage —
              {scenesWithVideo > 0 ? ` ${scenesWithVideo} vidéos` : ` ${scenesWithImage} images`}
              {scenesWithVoice > 0 ? ` + ${scenesWithVoice} voix` : ""}
              {episode.bgMusicUrl ? ` + musique fond (${Math.round((episode.bgMusicVolume ?? 0.2) * 100)}% vol)` : ""}
            </p>
          </div>
        )}
      </div>

      {/* Assemble Button */}
      {!assembledUrl && (
        <div className="mb-6">
          <button
            onClick={assembleEpisode}
            disabled={assembling || !canAssemble}
            className="w-full flex items-center justify-center gap-3 py-5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xl rounded-2xl transition-all glow-purple"
          >
            {assembling ? (
              <><Loader2 className="w-6 h-6 animate-spin" /> Assemblage FFmpeg en cours...</>
            ) : (
              <><Zap className="w-6 h-6" /> Assembler l'épisode complet</>
            )}
          </button>
          {assembling && (
            <div className="mt-3 space-y-1 text-center">
              <p className="text-gray-400 text-sm">FFmpeg assemble les scènes, mixe les voix et la musique...</p>
              <div className="flex justify-center gap-4 text-xs text-gray-500">
                <span>⏱ 1-3 minutes selon le nombre de scènes</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Result — Video Player */}
      {assembledUrl && (
        <div className="space-y-4">
          {/* Success banner */}
          <div className="p-4 bg-green-900/20 border border-green-600/30 rounded-xl flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-green-300">Épisode assemblé avec succès !</p>
              <p className="text-xs text-gray-400 mt-0.5">{assembleResult?.message}</p>
            </div>
          </div>

          {/* Video Player */}
          <div className="bg-[#13131a] border border-[#2a2a3e] rounded-2xl overflow-hidden">
            <div className="relative bg-black flex items-center justify-center" style={{ minHeight: "400px" }}>
              <video
                ref={videoRef}
                src={assembledUrl}
                className="max-w-full max-h-[70vh] mx-auto"
                controls
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                style={{ maxHeight: "600px" }}
              />
            </div>

            {/* Controls */}
            <div className="p-4 flex items-center gap-3 flex-wrap border-t border-[#2a2a3e]">
              <button
                onClick={togglePlay}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all"
              >
                {isPlaying ? <><Pause className="w-4 h-4" /> Pause</> : <><Play className="w-4 h-4 fill-current" /> Lecture</>}
              </button>

              <button
                onClick={downloadVideo}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-all"
              >
                <Download className="w-4 h-4" /> Télécharger MP4
              </button>

              <a
                href={assembledUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-[#1e1e2e] border border-[#2a2a3e] hover:border-gray-400 text-gray-300 hover:text-white text-sm rounded-xl transition-all"
              >
                <ExternalLink className="w-4 h-4" /> Ouvrir dans un onglet
              </a>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.origin + assembledUrl);
                  toast.success("URL copiée !");
                }}
                className="flex items-center gap-2 px-4 py-2 bg-[#1e1e2e] border border-[#2a2a3e] hover:border-gray-400 text-gray-300 hover:text-white text-sm rounded-xl transition-all"
              >
                <Share2 className="w-4 h-4" /> Copier le lien
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-[#13131a] border border-[#2a2a3e] rounded-xl text-center">
              <p className="text-xs text-gray-500 mb-1">Scènes</p>
              <p className="font-bold text-white">{assembleResult?.sceneCount}</p>
            </div>
            <div className="p-3 bg-[#13131a] border border-[#2a2a3e] rounded-xl text-center">
              <p className="text-xs text-gray-500 mb-1">Musique de fond</p>
              <p className={`font-bold ${assembleResult?.hasBgMusic ? "text-purple-400" : "text-gray-500"}`}>
                {assembleResult?.hasBgMusic ? "✅ Mixée" : "Non"}
              </p>
            </div>
            <div className="p-3 bg-[#13131a] border border-[#2a2a3e] rounded-xl text-center">
              <p className="text-xs text-gray-500 mb-1">Format</p>
              <p className="font-bold text-white">{episode.format} MP4</p>
            </div>
          </div>

          {/* Reassemble */}
          <button
            onClick={() => { setAssembledUrl(null); setAssembleResult(null); }}
            className="w-full py-3 border border-[#2a2a3e] hover:border-purple-500/40 text-gray-400 hover:text-white rounded-xl transition-all text-sm"
          >
            ↩ Réassembler avec modifications
          </button>
        </div>
      )}

      {/* Links to prev steps */}
      {!assembledUrl && (
        <div className="mt-6 pt-4 border-t border-[#2a2a3e]">
          <p className="text-xs text-gray-500 mb-3">Étapes précédentes :</p>
          <div className="flex gap-2 flex-wrap">
            {[
              { label: "Storyboard (images)", href: `/episodes/${id}/storyboard`, icon: Image },
              { label: "Audio & Voix", href: `/episodes/${id}/audio`, icon: Mic },
              { label: "Vidéos par scène", href: `/episodes/${id}/video`, icon: Video },
            ].map(({ label, href, icon: Icon }) => (
              <Link key={label} href={href}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#13131a] border border-[#2a2a3e] hover:border-purple-500/40 text-gray-400 hover:text-white text-xs rounded-xl transition-all">
                <Icon className="w-3.5 h-3.5" /> {label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
