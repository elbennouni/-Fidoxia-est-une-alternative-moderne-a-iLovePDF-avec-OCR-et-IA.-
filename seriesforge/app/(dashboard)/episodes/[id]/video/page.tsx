"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowLeft, Video, Loader2, Copy, ExternalLink } from "lucide-react";

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

export default function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, [id]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/episodes/${id}`);
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      setEpisodeTitle(data.title);
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
          { name: "Kling AI", url: "https://klingai.com", color: "blue", desc: "Best for character animation" },
          { name: "Runway ML", url: "https://runwayml.com", color: "purple", desc: "Gen-3 Turbo" },
          { name: "Replicate", url: "https://replicate.com", color: "orange", desc: "Multiple models available" },
        ].map(p => (
          <a key={p.name} href={p.url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-[#13131a] border border-[#2a2a3e] hover:border-gray-500 rounded-xl transition-all">
            <div>
              <p className="font-semibold text-white text-sm">{p.name}</p>
              <p className="text-xs text-gray-400">{p.desc}</p>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-500" />
          </a>
        ))}
      </div>

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
