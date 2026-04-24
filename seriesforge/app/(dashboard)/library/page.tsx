"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Library, Plus, X, Loader2, Music, Image, Video, Film, Layers } from "lucide-react";

interface Asset {
  id: string;
  seriesId: string;
  type: string;
  name: string;
  url?: string;
  prompt?: string;
  reusable: boolean;
  createdAt: string;
  series?: { title: string };
}

const ASSET_TYPES = ["intro", "outro", "transition", "recurring_scene", "music", "sound_effect", "character_reference", "environment_reference"];

const TYPE_ICONS: Record<string, React.ReactNode> = {
  intro: <Film className="w-4 h-4 text-purple-400" />,
  outro: <Film className="w-4 h-4 text-blue-400" />,
  transition: <Layers className="w-4 h-4 text-cyan-400" />,
  recurring_scene: <Video className="w-4 h-4 text-green-400" />,
  music: <Music className="w-4 h-4 text-orange-400" />,
  sound_effect: <Music className="w-4 h-4 text-yellow-400" />,
  character_reference: <Image className="w-4 h-4 text-pink-400" />,
  environment_reference: <Image className="w-4 h-4 text-teal-400" />,
};

const TYPE_COLORS: Record<string, string> = {
  intro: "border-purple-600/30 bg-purple-900/10",
  outro: "border-blue-600/30 bg-blue-900/10",
  transition: "border-cyan-600/30 bg-cyan-900/10",
  recurring_scene: "border-green-600/30 bg-green-900/10",
  music: "border-orange-600/30 bg-orange-900/10",
  sound_effect: "border-yellow-600/30 bg-yellow-900/10",
  character_reference: "border-pink-600/30 bg-pink-900/10",
  environment_reference: "border-teal-600/30 bg-teal-900/10",
};

export default function LibraryPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [series, setSeries] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [form, setForm] = useState({ seriesId: "", type: "", name: "", url: "", prompt: "", reusable: true });

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      const [assetsRes, seriesRes] = await Promise.all([
        fetch("/api/assets/create"),
        fetch("/api/series/create"),
      ]);
      if (assetsRes.status === 401) { router.push("/login"); return; }
      const [assetsData, seriesData] = await Promise.all([assetsRes.json(), seriesRes.json()]);
      setAssets(Array.isArray(assetsData) ? assetsData : []);
      setSeries(Array.isArray(seriesData) ? seriesData : []);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/assets/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Asset added to library!");
      setShowForm(false);
      setForm({ seriesId: "", type: "", name: "", url: "", prompt: "", reusable: true });
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  const filtered = filterType === "all" ? assets : assets.filter(a => a.type === filterType);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Library className="w-7 h-7 text-purple-400" /> Asset Library
          </h1>
          <p className="text-gray-400 mt-1">Reusable assets across episodes and series</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all">
          <Plus className="w-4 h-4" /> Add Asset
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap mb-6">
        <button onClick={() => setFilterType("all")} className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${filterType === "all" ? "bg-purple-600 text-white" : "bg-[#1e1e2e] border border-[#2a2a3e] text-gray-400 hover:text-white"}`}>
          All ({assets.length})
        </button>
        {ASSET_TYPES.map(t => {
          const count = assets.filter(a => a.type === t).length;
          if (count === 0) return null;
          return (
            <button key={t} onClick={() => setFilterType(t)} className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all capitalize ${filterType === t ? "bg-purple-600 text-white" : "bg-[#1e1e2e] border border-[#2a2a3e] text-gray-400 hover:text-white"}`}>
              {t.replace("_", " ")} ({count})
            </button>
          );
        })}
      </div>

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#13131a] border border-[#2a2a3e] rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Add Asset</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Series *</label>
                <select value={form.seriesId} onChange={e => setForm({ ...form, seriesId: e.target.value })} required className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white focus:outline-none focus:border-purple-500">
                  <option value="">Select series...</option>
                  {series.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Type *</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} required className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white focus:outline-none focus:border-purple-500">
                  <option value="">Select type...</option>
                  {ASSET_TYPES.map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Asset name" required className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">URL</label>
                <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..." className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Prompt</label>
                <textarea value={form.prompt} onChange={e => setForm({ ...form, prompt: e.target.value })} placeholder="Generation prompt used for this asset..." rows={2} className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none" />
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setForm({ ...form, reusable: !form.reusable })} className={`relative w-11 h-6 rounded-full transition-all ${form.reusable ? "bg-purple-600" : "bg-[#2a2a3e]"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.reusable ? "translate-x-5" : "translate-x-0"}`} />
                </button>
                <span className="text-sm text-gray-300">Reusable across episodes</span>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 border border-[#2a2a3e] text-gray-400 rounded-xl hover:border-gray-500 transition-all">Cancel</button>
                <button type="submit" disabled={creating} className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-[#13131a] border border-dashed border-[#2a2a3e] rounded-2xl">
          <Library className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">No assets yet. Add reusable assets to your library!</p>
          <button onClick={() => setShowForm(true)} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all">
            <Plus className="w-4 h-4 inline mr-2" /> Add First Asset
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(asset => (
            <div key={asset.id} className={`bg-[#13131a] border rounded-xl p-4 card-hover ${TYPE_COLORS[asset.type] || "border-[#2a2a3e]"}`}>
              <div className="flex items-center gap-2 mb-2">
                {TYPE_ICONS[asset.type] || <Layers className="w-4 h-4 text-gray-400" />}
                <span className="text-xs text-gray-500 capitalize">{asset.type.replace("_", " ")}</span>
                {asset.reusable && <span className="ml-auto text-xs text-green-400">♻</span>}
              </div>
              <h3 className="font-semibold text-white text-sm mb-1">{asset.name}</h3>
              {asset.prompt && <p className="text-xs text-gray-400 line-clamp-2 mb-2">{asset.prompt}</p>}
              {asset.url && (
                <a href={asset.url} target="_blank" rel="noreferrer" className="text-xs text-purple-400 hover:text-purple-300 transition-colors truncate block">
                  🔗 View asset
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
