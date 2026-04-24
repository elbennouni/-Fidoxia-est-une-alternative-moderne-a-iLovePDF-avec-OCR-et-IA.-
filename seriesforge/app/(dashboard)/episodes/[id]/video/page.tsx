"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowLeft, Video, Loader2, Copy, ExternalLink, Music, SlidersHorizontal } from "lucide-react";
import { CostBadge, CostSummary } from "@/components/ui/CostBadge";
import { COSTS } from "@/lib/costs";

interface Scene {
  id: string;
  sceneNumber: number;
  timecode?: string;
  location?: string;
  action?: string;
  videoPrompt?: string;
  videoUrl?: string;
  qualityScore?: number;
  status: string;
}

interface EpisodeWithMusic {
  id: string;
  title: string;
  format: string;
  status: string;
  bgMusicUrl?: string | null;
  bgMusicName?: string | null;
  bgMusicVolume?: number;
  scenes: Scene[];
}

export default function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [episode, setEpisode] = useState<EpisodeWithMusic | null>(null);
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, [id]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/episodes/${id}`);
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      setEpisodeTitle(data.title);
      setEpisode(data);
      setScenes(data.scenes || []);
    } finally {
      setLoading(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Video prompt copied!");
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href={`/episodes/${id}/editor`} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" /> Back to Editor
        </Link>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Video className="w-7 h-7 text-green-400" /> Video Generation
        </h1>
        <p className="text-gray-400 mt-1">{episodeTitle}</p>
      </div>

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { name: "Kling AI", url: "https://klingai.com", desc: "Meilleur pour l'animation", cost5s: COSTS["kling-5s"], cost10s: COSTS["kling-10s"] },
          { name: "Runway ML", url: "https://runwayml.com", desc: "Gen-3 Turbo", cost5s: COSTS["runway-5s"], cost10s: COSTS["runway-10s"] },
          { name: "Replicate", url: "https://replicate.com", desc: "Modèles variés", cost5s: COSTS["replicate-video"], cost10s: COSTS["replicate-video"] * 2 },
        ].map(p => (
          <a key={p.name} href={p.url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-[#13131a] border border-[#2a2a3e] hover:border-gray-500 rounded-xl transition-all group">
            <div>
              <p className="font-semibold text-white text-sm group-hover:text-purple-300 transition-colors">{p.name}</p>
              <p className="text-xs text-gray-400 mb-1">{p.desc}</p>
              <div className="flex gap-2">
                <CostBadge cost={p.cost5s} label="5s" />
                <CostBadge cost={p.cost10s} label="10s" />
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-500" />
          </a>
        ))}
      </div>

      {/* Background Music Status */}
      {episode && (
        <div className={`mb-6 p-4 rounded-xl border flex items-center gap-4 ${episode.bgMusicUrl ? "bg-purple-900/10 border-purple-600/30" : "bg-[#13131a] border-[#2a2a3e]"}`}>
          <div className={`p-2 rounded-lg ${episode.bgMusicUrl ? "bg-purple-600/20" : "bg-[#1e1e2e]"}`}>
            <Music className={`w-5 h-5 ${episode.bgMusicUrl ? "text-purple-400" : "text-gray-600"}`} />
          </div>
          <div className="flex-1">
            {episode.bgMusicUrl ? (
              <>
                <p className="text-sm font-medium text-white flex items-center gap-2">
                  ✅ Musique de fond : {episode.bgMusicName}
                  <span className="text-xs text-purple-300 font-mono">volume {Math.round((episode.bgMusicVolume ?? 0.2) * 100)}%</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">La musique sera mixée avec les voix lors de l'assemblage final</p>
                <audio controls src={episode.bgMusicUrl} className="h-7 mt-1 w-48" />
              </>
            ) : (
              <>
                <p className="text-sm text-gray-400">Aucune musique de fond</p>
                <p className="text-xs text-gray-500">Ajoutez une musique dans l'onglet Audio avant de générer la vidéo</p>
              </>
            )}
          </div>
          <Link href={`/episodes/${id}/audio`} className="flex items-center gap-1.5 px-3 py-2 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-600/30 text-purple-300 text-xs rounded-xl transition-all whitespace-nowrap">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {episode.bgMusicUrl ? "Modifier le volume" : "Ajouter musique"}
          </Link>
        </div>
      )}

      {scenes.length > 0 && (
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-gray-400">{scenes.length} scènes avec prompts vidéo</p>
          <CostSummary items={[
            { label: "Kling 5s × scènes", cost: COSTS["kling-5s"], qty: scenes.length },
          ]} />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>
      ) : scenes.length === 0 ? (
        <div className="text-center py-16 bg-[#13131a] border border-dashed border-[#2a2a3e] rounded-2xl">
          <Video className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Run the episode pipeline first to generate video prompts</p>
          <Link href={`/episodes/${id}/editor`} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all">
            Go to Editor
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {scenes.map(scene => (
            <div key={scene.id} className="bg-[#13131a] border border-[#2a2a3e] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-[#2a2a3e]">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white">Scene {scene.sceneNumber}</span>
                  {scene.timecode && <span className="text-xs text-gray-500">{scene.timecode}</span>}
                  {scene.location && <span className="text-xs text-gray-400">📍 {scene.location}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {scene.qualityScore && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${scene.qualityScore >= 85 ? "bg-green-600/20 text-green-400" : "bg-yellow-600/20 text-yellow-400"}`}>
                      {scene.qualityScore}/100
                    </span>
                  )}
                </div>
              </div>
              <div className="p-4">
                {scene.videoUrl ? (
                  <video controls src={scene.videoUrl} className="w-full rounded-xl" />
                ) : (
                  <div>
                    {scene.videoPrompt ? (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Video Prompt</p>
                          <button onClick={() => copy(scene.videoPrompt!)} className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition-colors">
                            <Copy className="w-3 h-3" /> Copy to use in Kling/Runway
                          </button>
                        </div>
                        <div className="bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl p-4">
                          <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{scene.videoPrompt}</p>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-4">No video prompt yet</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
