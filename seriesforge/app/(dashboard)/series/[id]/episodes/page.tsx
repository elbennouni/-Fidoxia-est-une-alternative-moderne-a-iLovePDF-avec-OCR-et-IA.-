"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowLeft, Plus, Film, X, Loader2, ChevronRight } from "lucide-react";

interface Episode {
  id: string;
  title: string;
  status: string;
  format: string;
  script?: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-600/20 text-gray-400 border-gray-600/30",
  generating: "bg-yellow-600/20 text-yellow-400 border-yellow-600/30",
  complete: "bg-green-600/20 text-green-400 border-green-600/30",
  error: "bg-red-600/20 text-red-400 border-red-600/30",
};

export default function EpisodesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: seriesId } = use(params);
  const router = useRouter();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [series, setSeries] = useState<{ defaultFormat: string; title: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", script: "", format: "9:16" });

  useEffect(() => { fetchData(); }, [seriesId]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/series/${seriesId}`);
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      setSeries({ defaultFormat: data.defaultFormat, title: data.title });
      setEpisodes(data.episodes || []);
      setForm(f => ({ ...f, format: data.defaultFormat }));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/episodes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, seriesId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Episode created!");
      setShowForm(false);
      router.push(`/episodes/${data.id}/editor`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href={`/series/${seriesId}`} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" /> Back to Series
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Film className="w-7 h-7 text-orange-400" /> Episodes
            </h1>
            <p className="text-gray-400 mt-1">{series?.title}</p>
          </div>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all">
            <Plus className="w-4 h-4" /> New Episode
          </button>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#13131a] border border-[#2a2a3e] rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">New Episode</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Episode Title *</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. The Beach Challenge" required className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Episode Idea / Brief</label>
                <textarea value={form.script} onChange={e => setForm({ ...form, script: e.target.value })} placeholder="Describe what happens in this episode. The AI will generate the full script..." rows={4} className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Format</label>
                <div className="flex gap-3">
                  {["9:16", "16:9"].map(f => (
                    <button key={f} type="button" onClick={() => setForm({ ...form, format: f })} className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${form.format === f ? "bg-purple-600/20 border-purple-500 text-purple-300" : "bg-[#1e1e2e] border-[#2a2a3e] text-gray-400"}`}>
                      {f} {f === "9:16" ? "(TikTok)" : "(YouTube)"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 border border-[#2a2a3e] text-gray-400 rounded-xl hover:border-gray-500 transition-all">Cancel</button>
                <button type="submit" disabled={creating} className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create & Edit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>
      ) : episodes.length === 0 ? (
        <div className="text-center py-16 bg-[#13131a] border border-dashed border-[#2a2a3e] rounded-2xl">
          <Film className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">No episodes yet. Create your first!</p>
          <button onClick={() => setShowForm(true)} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all">
            <Plus className="w-4 h-4 inline mr-2" /> Create Episode
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {episodes.map(ep => (
            <Link key={ep.id} href={`/episodes/${ep.id}/editor`} className="flex items-center justify-between p-5 bg-[#13131a] border border-[#2a2a3e] rounded-xl hover:border-purple-500/30 transition-all group">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-orange-600/20 rounded-lg">
                  <Film className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="font-bold text-white group-hover:text-purple-300 transition-colors">{ep.title}</p>
                  {ep.script && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 max-w-md">{ep.script}</p>}
                  <p className="text-xs text-gray-500 mt-0.5">{new Date(ep.createdAt).toLocaleDateString()} · {ep.format}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[ep.status] || STATUS_COLORS.draft}`}>
                  {ep.status}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-purple-400 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
