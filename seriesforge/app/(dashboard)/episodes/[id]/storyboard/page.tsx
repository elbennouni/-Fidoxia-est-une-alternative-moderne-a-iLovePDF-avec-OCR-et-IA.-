"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowLeft, Image, CheckCircle, Loader2, Copy, Sparkles } from "lucide-react";
import { CostBadge, CostSummary } from "@/components/ui/CostBadge";
import { COSTS } from "@/lib/costs";

interface Scene {
  id: string;
  sceneNumber: number;
  timecode?: string;
  location?: string;
  action?: string;
  emotion?: string;
  imagePrompt?: string;
  imageUrl?: string;
  qualityScore?: number;
  status: string;
  validatedByUser: boolean;
}

export default function StoryboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [episodeFormat, setEpisodeFormat] = useState("9:16");
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, [id]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/episodes/${id}`);
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      setEpisodeTitle(data.title);
      setEpisodeFormat(data.format || "9:16");
      setScenes(data.scenes || []);
    } finally {
      setLoading(false);
    }
  }

  function copyPrompt(prompt: string) {
    navigator.clipboard.writeText(prompt);
    toast.success("Prompt copié !");
  }

  const validated = scenes.filter(s => s.validatedByUser).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href={`/episodes/${id}/editor`} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" /> Retour à l'éditeur
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Image className="w-7 h-7 text-blue-400" /> Storyboard
            </h1>
            <p className="text-gray-400 mt-1">{episodeTitle}</p>
          </div>
          {scenes.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">{validated}/{scenes.length} validées</span>
              <CostBadge
                cost={(episodeFormat === "9:16" ? COSTS["dalle3-standard-portrait"] : COSTS["dalle3-standard-landscape"]) * scenes.length}
                label={`${scenes.length} imgs`}
                size="sm"
              />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>
      ) : scenes.length === 0 ? (
        <div className="text-center py-16 bg-[#13131a] border border-dashed border-[#2a2a3e] rounded-2xl">
          <Image className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Lancez d'abord le pipeline de l'épisode pour générer le storyboard</p>
          <Link href={`/episodes/${id}/editor`} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all">
            Aller à l'éditeur
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {scenes.map(scene => (
            <div key={scene.id} className={`bg-[#13131a] border rounded-xl overflow-hidden card-hover ${scene.validatedByUser ? "border-green-500/50" : "border-[#2a2a3e]"}`}>
              {/* Image Area */}
              <div className="aspect-[9/16] bg-[#1e1e2e] relative flex items-center justify-center">
                {scene.imageUrl ? (
                  <img src={scene.imageUrl} alt={`Scene ${scene.sceneNumber}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-4">
                    <Image className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">Prompt prêt</p>
                    <p className="text-xs text-gray-600">Générer via DALL-E ou Fal.ai</p>
                  </div>
                )}
                {scene.validatedByUser && (
                  <div className="absolute top-2 right-2 p-1 bg-green-600 rounded-full">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                )}
                {scene.qualityScore && (
                  <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-bold ${scene.qualityScore >= 85 ? "bg-green-900/80 text-green-300" : "bg-yellow-900/80 text-yellow-300"}`}>
                    {scene.qualityScore}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-white text-sm">Scène {scene.sceneNumber}</span>
                  {scene.timecode && <span className="text-xs text-gray-500">{scene.timecode}</span>}
                </div>
                {scene.location && <p className="text-xs text-gray-400 mb-1">📍 {scene.location}</p>}
                {scene.emotion && <p className="text-xs text-gray-500 italic mb-2">{scene.emotion}</p>}

                {scene.imagePrompt && (
                  <div className="bg-[#1e1e2e] rounded-lg p-2 mb-2">
                    <p className="text-xs text-gray-400 line-clamp-3">{scene.imagePrompt}</p>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <div className="flex gap-2">
                    {scene.imagePrompt && (
                      <button
                        onClick={() => copyPrompt(scene.imagePrompt!)}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-600/30 text-blue-300 text-xs rounded-lg transition-all"
                      >
                        <Copy className="w-3 h-3" /> Copier
                      </button>
                    )}
                  </div>
                  <CostBadge
                    cost={episodeFormat === "9:16" ? COSTS["dalle3-standard-portrait"] : COSTS["dalle3-standard-landscape"]}
                    label="DALL-E 3"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
