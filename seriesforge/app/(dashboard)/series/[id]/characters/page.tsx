"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowLeft, Plus, Users, X, Loader2, ShieldCheck } from "lucide-react";

interface Character {
  id: string;
  name: string;
  physicalDescription: string;
  outfit: string;
  personality: string;
  voiceProfile?: string;
  consistencyPrompt: string;
  createdAt: string;
}

const VOICE_PROFILES = [
  "Male, deep, authoritative",
  "Male, young, energetic",
  "Male, grumpy, older",
  "Female, strong, confident",
  "Female, soft, gentle",
  "Female, energetic, cheerful",
  "Child, playful",
  "TV presenter, enthusiastic",
  "Villain, menacing",
];

export default function CharactersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: seriesId } = use(params);
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [form, setForm] = useState({
    name: "",
    physicalDescription: "",
    outfit: "",
    personality: "",
    voiceProfile: "",
  });

  useEffect(() => { fetchCharacters(); }, [seriesId]);

  async function fetchCharacters() {
    try {
      const res = await fetch(`/api/series/${seriesId}`);
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      setCharacters(data.characters || []);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/characters/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, seriesId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Character "${form.name}" created with consistency lock!`);
      setShowForm(false);
      setForm({ name: "", physicalDescription: "", outfit: "", personality: "", voiceProfile: "" });
      fetchCharacters();
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
              <Users className="w-7 h-7 text-blue-400" /> Character Manager
            </h1>
            <p className="text-gray-400 mt-1">Each character has a locked consistency prompt for visual coherence</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all"
          >
            <Plus className="w-4 h-4" /> Add Character
          </button>
        </div>
      </div>

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#13131a] border border-[#2a2a3e] rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-thin">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">New Character</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Hassan" required className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Physical Description *</label>
                <textarea value={form.physicalDescription} onChange={e => setForm({ ...form, physicalDescription: e.target.value })} placeholder="Athletic young man, 28 years old, Mediterranean features..." required rows={2} className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Outfit *</label>
                <input value={form.outfit} onChange={e => setForm({ ...form, outfit: e.target.value })} placeholder="Beach survivor outfit: torn shorts, tribal necklace..." required className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Personality *</label>
                <textarea value={form.personality} onChange={e => setForm({ ...form, personality: e.target.value })} placeholder="Funny, determined survivor, athletic, always joking but competitive..." required rows={2} className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Voice Profile</label>
                <select value={form.voiceProfile} onChange={e => setForm({ ...form, voiceProfile: e.target.value })} className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white focus:outline-none focus:border-purple-500">
                  <option value="">Select voice...</option>
                  {VOICE_PROFILES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="flex items-start gap-2 p-3 bg-purple-900/20 border border-purple-600/30 rounded-xl">
                <ShieldCheck className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-purple-300">A consistency lock prompt will be automatically generated to maintain visual identity across all scenes.</p>
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

      {/* Consistency Modal */}
      {selectedChar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#13131a] border border-[#2a2a3e] rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-400" /> {selectedChar.name} — Consistency Lock
              </h2>
              <button onClick={() => setSelectedChar(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-[#1e1e2e] border border-purple-600/30 rounded-xl p-4">
              <p className="text-sm text-purple-200 leading-relaxed font-mono">{selectedChar.consistencyPrompt}</p>
            </div>
            <p className="text-xs text-gray-500 mt-3">This prompt is automatically injected into every scene prompt to maintain character identity.</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>
      ) : characters.length === 0 ? (
        <div className="text-center py-16 bg-[#13131a] border border-dashed border-[#2a2a3e] rounded-2xl">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">No characters yet</p>
          <button onClick={() => setShowForm(true)} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all">
            <Plus className="w-4 h-4 inline mr-2" /> Add First Character
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {characters.map(char => (
            <div key={char.id} className="bg-[#13131a] border border-[#2a2a3e] rounded-xl p-5 card-hover">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {char.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white">{char.name}</h3>
                  <p className="text-xs text-gray-400 truncate">{char.outfit}</p>
                </div>
                <button onClick={() => setSelectedChar(char)} className="p-1.5 bg-purple-600/20 hover:bg-purple-600/40 rounded-lg transition-all" title="View consistency lock">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                </button>
              </div>
              <p className="text-sm text-gray-300 mb-2 line-clamp-2">{char.physicalDescription}</p>
              <p className="text-xs text-gray-500 mb-3 italic line-clamp-2">{char.personality}</p>
              {char.voiceProfile && (
                <span className="text-xs px-2 py-0.5 bg-blue-600/20 border border-blue-600/30 rounded-full text-blue-300">
                  🎙 {char.voiceProfile}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
