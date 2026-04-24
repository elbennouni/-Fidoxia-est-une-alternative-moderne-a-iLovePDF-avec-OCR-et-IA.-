"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowLeft, Plus, MapPin, X, Loader2 } from "lucide-react";

interface Environment {
  id: string;
  name: string;
  description: string;
  lighting?: string;
  mood?: string;
  reusable: boolean;
  createdAt: string;
}

const LIGHTINGS = ["Bright tropical sun", "Golden hour", "Night scene", "Indoor warm light", "Dramatic storm", "Overcast soft light", "Neon city lights", "Candlelight", "Dawn misty light"];
const MOODS = ["Action, intense", "Romantic, calm", "Mysterious, tense", "Comedic, fun", "Epic, dramatic", "Peaceful, serene", "Chaotic, frantic", "Melancholic, sad"];

export default function EnvironmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: seriesId } = use(params);
  const router = useRouter();
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", lighting: "", mood: "", reusable: true });

  useEffect(() => { fetchEnvs(); }, [seriesId]);

  async function fetchEnvs() {
    try {
      const res = await fetch(`/api/series/${seriesId}`);
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      setEnvironments(data.environments || []);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/environments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, seriesId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Location "${form.name}" created!`);
      setShowForm(false);
      setForm({ name: "", description: "", lighting: "", mood: "", reusable: true });
      fetchEnvs();
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
              <MapPin className="w-7 h-7 text-green-400" /> Environment Manager
            </h1>
            <p className="text-gray-400 mt-1">Create reusable locations for your series</p>
          </div>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all">
            <Plus className="w-4 h-4" /> Add Location
          </button>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#13131a] border border-[#2a2a3e] rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">New Location</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Konanta Beach" required className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Description *</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="A stunning tropical beach with crystal clear water..." required rows={3} className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Lighting</label>
                  <select value={form.lighting} onChange={e => setForm({ ...form, lighting: e.target.value })} className="w-full px-3 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white focus:outline-none focus:border-purple-500 text-sm">
                    <option value="">Select...</option>
                    {LIGHTINGS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Mood</label>
                  <select value={form.mood} onChange={e => setForm({ ...form, mood: e.target.value })} className="w-full px-3 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white focus:outline-none focus:border-purple-500 text-sm">
                    <option value="">Select...</option>
                    {MOODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
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
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>
      ) : environments.length === 0 ? (
        <div className="text-center py-16 bg-[#13131a] border border-dashed border-[#2a2a3e] rounded-2xl">
          <MapPin className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">No locations yet</p>
          <button onClick={() => setShowForm(true)} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all">
            <Plus className="w-4 h-4 inline mr-2" /> Add First Location
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {environments.map(env => (
            <div key={env.id} className="bg-[#13131a] border border-[#2a2a3e] rounded-xl p-5 card-hover">
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 bg-green-600/20 rounded-lg flex-shrink-0">
                  <MapPin className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white">{env.name}</h3>
                  {env.reusable && <span className="text-xs text-green-400">♻ Reusable</span>}
                </div>
              </div>
              <p className="text-sm text-gray-300 mb-3 line-clamp-3">{env.description}</p>
              <div className="flex flex-wrap gap-2">
                {env.lighting && <span className="text-xs px-2 py-0.5 bg-yellow-600/20 border border-yellow-600/30 rounded-full text-yellow-300">💡 {env.lighting}</span>}
                {env.mood && <span className="text-xs px-2 py-0.5 bg-blue-600/20 border border-blue-600/30 rounded-full text-blue-300">🎭 {env.mood}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
