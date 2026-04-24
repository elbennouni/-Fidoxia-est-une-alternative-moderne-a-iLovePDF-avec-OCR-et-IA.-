"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Plus, Tv2, ArrowRight, Loader2, X } from "lucide-react";

interface Series {
  id: string;
  title: string;
  description?: string;
  visualStyle: string;
  tone: string;
  defaultFormat: string;
  _count: { episodes: number; characters: number };
  createdAt: string;
}

const VISUAL_STYLES = [
  "Pixar 3D cinematic",
  "2D anime style",
  "Studio Ghibli watercolor",
  "Marvel comic book style",
  "Realistic CGI",
  "Claymation",
  "Dark gothic animated",
  "Pixar 3D cinematic reality TV",
  "South Park flat cartoon",
  "Disney classic animated",
];

const TONES = [
  "funny, comedic",
  "dramatic, serious",
  "adventure, epic",
  "romantic, emotional",
  "thriller, suspense",
  "horror, dark",
  "family-friendly, wholesome",
  "satirical, political",
  "funny, dramatic, competitive, reality TV",
];

export default function SeriesPage() {
  const router = useRouter();
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    visualStyle: "",
    tone: "",
    defaultFormat: "9:16",
  });

  useEffect(() => { fetchSeries(); }, []);

  async function fetchSeries() {
    try {
      const res = await fetch("/api/series/create");
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      setSeries(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/series/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Series created!");
      setShowForm(false);
      setForm({ title: "", description: "", visualStyle: "", tone: "", defaultFormat: "9:16" });
      router.push(`/series/${data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">My Series</h1>
          <p className="text-gray-400 mt-1">Manage your animated series projects</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all"
        >
          <Plus className="w-4 h-4" /> New Series
        </button>
      </div>

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#13131a] border border-[#2a2a3e] rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Create New Series</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Series Title *</label>
                <input
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Les Marseillais à Konanta"
                  required
                  className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description of the series..."
                  rows={2}
                  className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Visual Style *</label>
                <select
                  value={form.visualStyle}
                  onChange={e => setForm({ ...form, visualStyle: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="">Select style...</option>
                  {VISUAL_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Tone *</label>
                <select
                  value={form.tone}
                  onChange={e => setForm({ ...form, tone: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="">Select tone...</option>
                  {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Default Format</label>
                <div className="flex gap-3">
                  {["9:16", "16:9"].map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setForm({ ...form, defaultFormat: f })}
                      className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${
                        form.defaultFormat === f
                          ? "bg-purple-600/20 border-purple-500 text-purple-300"
                          : "bg-[#1e1e2e] border-[#2a2a3e] text-gray-400"
                      }`}
                    >
                      {f} {f === "9:16" ? "(TikTok)" : "(YouTube)"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-3 border border-[#2a2a3e] text-gray-400 rounded-xl hover:border-gray-500 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Series Grid */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>
      ) : series.length === 0 ? (
        <div className="text-center py-16 bg-[#13131a] border border-dashed border-[#2a2a3e] rounded-2xl">
          <Tv2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">No series yet. Create your first one!</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all"
          >
            <Plus className="w-4 h-4 inline mr-2" /> New Series
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {series.map(s => (
            <Link
              key={s.id}
              href={`/series/${s.id}`}
              className="bg-[#13131a] border border-[#2a2a3e] rounded-xl p-5 card-hover group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-purple-600/20 rounded-lg">
                  <Tv2 className="w-5 h-5 text-purple-400" />
                </div>
                <span className="text-xs px-2 py-1 bg-[#1e1e2e] border border-[#2a2a3e] rounded-full text-gray-400">
                  {s.defaultFormat}
                </span>
              </div>
              <h3 className="font-bold text-white mb-1 group-hover:text-purple-300 transition-colors">{s.title}</h3>
              {s.description && <p className="text-xs text-gray-500 mb-2 line-clamp-2">{s.description}</p>}
              <p className="text-xs text-gray-600 mb-3 italic">{s.visualStyle}</p>
              <div className="flex items-center justify-between">
                <div className="flex gap-3 text-xs text-gray-400">
                  <span>{s._count.episodes} episodes</span>
                  <span>{s._count.characters} chars</span>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-purple-400 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
