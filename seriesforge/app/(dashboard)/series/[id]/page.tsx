"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Users, MapPin, Film, ArrowLeft, Plus, Loader2, ChevronRight, Tv2 } from "lucide-react";

interface Series {
  id: string;
  title: string;
  description?: string;
  visualStyle: string;
  tone: string;
  defaultFormat: string;
  characters: Array<{ id: string; name: string; physicalDescription: string; outfit: string }>;
  environments: Array<{ id: string; name: string; description: string }>;
  episodes: Array<{ id: string; title: string; status: string; format: string; createdAt: string }>;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-600/20 text-gray-400",
  generating: "bg-yellow-600/20 text-yellow-400",
  complete: "bg-green-600/20 text-green-400",
  error: "bg-red-600/20 text-red-400",
};

export default function SeriesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [series, setSeries] = useState<Series | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSeries();
  }, [id]);

  async function fetchSeries() {
    try {
      const res = await fetch(`/api/series/${id}`);
      if (res.status === 401) { router.push("/login"); return; }
      if (!res.ok) { router.push("/series"); return; }
      setSeries(await res.json());
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
    </div>
  );

  if (!series) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/series" className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" /> Back to Series
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-600/20 rounded-lg">
                <Tv2 className="w-6 h-6 text-purple-400" />
              </div>
              <h1 className="text-3xl font-bold text-white">{series.title}</h1>
            </div>
            {series.description && <p className="text-gray-400 mb-1">{series.description}</p>}
            <div className="flex gap-3 text-sm">
              <span className="px-2 py-0.5 bg-purple-600/20 border border-purple-600/30 rounded-full text-purple-300">{series.visualStyle}</span>
              <span className="px-2 py-0.5 bg-blue-600/20 border border-blue-600/30 rounded-full text-blue-300">{series.tone}</span>
              <span className="px-2 py-0.5 bg-[#1e1e2e] border border-[#2a2a3e] rounded-full text-gray-400">{series.defaultFormat}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Nav */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Link href={`/series/${id}/characters`} className="flex items-center justify-between p-4 bg-[#13131a] border border-[#2a2a3e] rounded-xl hover:border-purple-500/50 transition-all group">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-lg"><Users className="w-5 h-5 text-blue-400" /></div>
            <div>
              <p className="font-semibold text-white group-hover:text-blue-300 transition-colors">Characters</p>
              <p className="text-xs text-gray-400">{series.characters.length} created</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-blue-400 transition-colors" />
        </Link>

        <Link href={`/series/${id}/environments`} className="flex items-center justify-between p-4 bg-[#13131a] border border-[#2a2a3e] rounded-xl hover:border-green-500/50 transition-all group">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-600/20 rounded-lg"><MapPin className="w-5 h-5 text-green-400" /></div>
            <div>
              <p className="font-semibold text-white group-hover:text-green-300 transition-colors">Environments</p>
              <p className="text-xs text-gray-400">{series.environments.length} locations</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-green-400 transition-colors" />
        </Link>

        <Link href={`/series/${id}/episodes`} className="flex items-center justify-between p-4 bg-[#13131a] border border-[#2a2a3e] rounded-xl hover:border-orange-500/50 transition-all group">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-600/20 rounded-lg"><Film className="w-5 h-5 text-orange-400" /></div>
            <div>
              <p className="font-semibold text-white group-hover:text-orange-300 transition-colors">Episodes</p>
              <p className="text-xs text-gray-400">{series.episodes.length} episodes</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-orange-400 transition-colors" />
        </Link>
      </div>

      {/* Recent Episodes */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Recent Episodes</h2>
          <Link href={`/series/${id}/episodes`} className="text-sm text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1">
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        {series.episodes.length === 0 ? (
          <div className="text-center py-10 bg-[#13131a] border border-dashed border-[#2a2a3e] rounded-xl">
            <Film className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 mb-4">No episodes yet</p>
            <Link href={`/series/${id}/episodes`} className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all">
              <Plus className="w-4 h-4" /> Create Episode
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {series.episodes.slice(0, 5).map(ep => (
              <Link
                key={ep.id}
                href={`/episodes/${ep.id}/editor`}
                className="flex items-center justify-between p-4 bg-[#13131a] border border-[#2a2a3e] rounded-xl hover:border-purple-500/30 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Film className="w-4 h-4 text-gray-500" />
                  <span className="font-medium text-white group-hover:text-purple-300 transition-colors">{ep.title}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[ep.status] || STATUS_COLORS.draft}`}>
                    {ep.status}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-purple-400 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Characters Preview */}
      {series.characters.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Characters</h2>
            <Link href={`/series/${id}/characters`} className="text-sm text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1">
              Manage <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {series.characters.map(char => (
              <div key={char.id} className="bg-[#13131a] border border-[#2a2a3e] rounded-xl p-3 text-center">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold text-sm">
                  {char.name[0]}
                </div>
                <p className="font-semibold text-white text-sm">{char.name}</p>
                <p className="text-xs text-gray-500 truncate">{char.outfit}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
