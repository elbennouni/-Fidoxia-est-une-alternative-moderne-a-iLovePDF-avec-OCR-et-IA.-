"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowLeft, Plus, Users, X, Loader2, ShieldCheck, Sparkles, Upload, Mic, Image, Trash2 } from "lucide-react";

interface Character {
  id: string;
  name: string;
  physicalDescription: string;
  outfit: string;
  personality: string;
  voiceProfile?: string;
  referenceImageUrl?: string;
  consistencyPrompt: string;
  createdAt: string;
}

interface HeyGenVoice {
  voice_id: string;
  name: string;
  language: string;
  gender: string;
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
  const [visualStyle, setVisualStyle] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [generatingImage, setGeneratingImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [heygenVoices, setHeygenVoices] = useState<HeyGenVoice[]>([]);
  const [showVoicePanel, setShowVoicePanel] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingUploadCharId, setPendingUploadCharId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    physicalDescription: "",
    outfit: "",
    personality: "",
    voiceProfile: "",
    heygenVoiceId: "",
  });

  useEffect(() => { fetchData(); }, [seriesId]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/series/${seriesId}`);
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      setCharacters(data.characters || []);
      setVisualStyle(data.visualStyle || "");
    } finally {
      setLoading(false);
    }
    // Load HeyGen voices
    try {
      const vRes = await fetch("/api/heygen/voices");
      const vData = await vRes.json();
      setHeygenVoices(vData.voices || []);
    } catch {}
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
      toast.success(`Personnage "${form.name}" créé !`);
      setShowForm(false);
      setForm({ name: "", physicalDescription: "", outfit: "", personality: "", voiceProfile: "", heygenVoiceId: "" });
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setCreating(false);
    }
  }

  async function generateImage(char: Character) {
    setGeneratingImage(char.id);
    const t = toast.loading(`Génération image de ${char.name}...`);
    try {
      const res = await fetch("/api/generate/character-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: char.id, visualStyle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.dismiss(t);
      toast.success(`Image de ${char.name} générée !`);
      fetchData();
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Génération échouée");
    } finally {
      setGeneratingImage(null);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, charId: string) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(charId);
    const t = toast.loading("Upload en cours...");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "characters");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Update character with uploaded URL
      await fetch(`/api/characters/${charId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceImageUrl: data.url }),
      });

      toast.dismiss(t);
      toast.success("Photo uploadée !");
      fetchData();
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Upload échoué");
    } finally {
      setUploadingImage(null);
    }
  }

  async function assignVoice(charId: string, voiceId: string, voiceName: string) {
    try {
      await fetch(`/api/characters/${charId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceProfile: voiceName, heygenVoiceId: voiceId }),
      });
      toast.success(`Voix "${voiceName}" assignée !`);
      setShowVoicePanel(null);
      fetchData();
    } catch {
      toast.error("Erreur assignation voix");
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pendingUploadCharId && handleFileUpload(e, pendingUploadCharId)}
      />

      <div className="mb-6">
        <Link href={`/series/${seriesId}`} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" /> Retour à la série
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Users className="w-7 h-7 text-blue-400" /> Personnages
            </h1>
            <p className="text-gray-400 mt-1">Créez vos personnages, générez leur image et assignez leur voix</p>
          </div>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all">
            <Plus className="w-4 h-4" /> Nouveau Personnage
          </button>
        </div>
      </div>

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#13131a] border border-[#2a2a3e] rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-thin">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Nouveau Personnage</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Nom *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Hassan" required className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Description physique *</label>
                <textarea value={form.physicalDescription} onChange={e => setForm({ ...form, physicalDescription: e.target.value })} placeholder="Homme athlétique, 28 ans, cheveux noirs courts, peau bronzée..." required rows={2} className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Tenue *</label>
                <input value={form.outfit} onChange={e => setForm({ ...form, outfit: e.target.value })} placeholder="Short de plage déchiré, collier tribal, torse nu..." required className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Personnalité *</label>
                <textarea value={form.personality} onChange={e => setForm({ ...form, personality: e.target.value })} placeholder="Drôle, déterminé, toujours en train de blagues mais très compétitif..." required rows={2} className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Profil de voix</label>
                <select value={form.voiceProfile} onChange={e => setForm({ ...form, voiceProfile: e.target.value })} className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white focus:outline-none focus:border-purple-500">
                  <option value="">Sélectionner...</option>
                  {VOICE_PROFILES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="flex items-start gap-2 p-3 bg-purple-900/20 border border-purple-600/30 rounded-xl">
                <ShieldCheck className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-purple-300">Un prompt de cohérence visuelle sera automatiquement généré pour maintenir l'identité du personnage dans toutes les scènes.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 border border-[#2a2a3e] text-gray-400 rounded-xl hover:border-gray-500 transition-all">Annuler</button>
                <button type="submit" disabled={creating} className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Créer
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
                <ShieldCheck className="w-5 h-5 text-purple-400" /> {selectedChar.name} — Verrou de cohérence
              </h2>
              <button onClick={() => setSelectedChar(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-[#1e1e2e] border border-purple-600/30 rounded-xl p-4">
              <p className="text-sm text-purple-200 leading-relaxed font-mono">{selectedChar.consistencyPrompt}</p>
            </div>
            <p className="text-xs text-gray-500 mt-3">Ce prompt est injecté automatiquement dans chaque scène pour maintenir l'identité visuelle du personnage.</p>
          </div>
        </div>
      )}

      {/* Voice Panel */}
      {showVoicePanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#13131a] border border-[#2a2a3e] rounded-2xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto scrollbar-thin">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Mic className="w-5 h-5 text-orange-400" /> Choisir une voix HeyGen
              </h2>
              <button onClick={() => setShowVoicePanel(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            {heygenVoices.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 text-sm">Ajoutez HEYGEN_API_KEY dans le .env pour les vraies voix</p>
              </div>
            ) : (
              <div className="space-y-2">
                {heygenVoices.map(voice => (
                  <button
                    key={voice.voice_id}
                    onClick={() => assignVoice(showVoicePanel, voice.voice_id, voice.name)}
                    className="w-full flex items-center justify-between p-3 bg-[#1e1e2e] border border-[#2a2a3e] hover:border-orange-500/50 rounded-xl transition-all text-left"
                  >
                    <div>
                      <p className="font-medium text-white text-sm">{voice.name}</p>
                      <p className="text-xs text-gray-400">{voice.language} · {voice.gender}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 bg-orange-600/20 border border-orange-600/30 rounded-full text-orange-300">Assigner</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>
      ) : characters.length === 0 ? (
        <div className="text-center py-16 bg-[#13131a] border border-dashed border-[#2a2a3e] rounded-2xl">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-2 text-lg font-medium">Aucun personnage</p>
          <p className="text-gray-500 text-sm mb-6">Créez vos personnages pour commencer à générer des scènes</p>
          <button onClick={() => setShowForm(true)} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all">
            <Plus className="w-4 h-4 inline mr-2" /> Créer le premier personnage
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {characters.map(char => (
            <div key={char.id} className="bg-[#13131a] border border-[#2a2a3e] rounded-xl overflow-hidden card-hover">
              {/* Image */}
              <div className="relative aspect-square bg-[#1e1e2e] flex items-center justify-center overflow-hidden">
                {char.referenceImageUrl ? (
                  <img src={char.referenceImageUrl} alt={char.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-4">
                    <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-3xl mx-auto mb-3">
                      {char.name[0]}
                    </div>
                    <p className="text-gray-500 text-xs">Pas d'image</p>
                  </div>
                )}
                {/* Image action buttons */}
                <div className="absolute bottom-2 left-2 right-2 flex gap-2">
                  <button
                    onClick={() => generateImage(char)}
                    disabled={generatingImage === char.id}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-purple-600/90 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg backdrop-blur-sm transition-all"
                  >
                    {generatingImage === char.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Générer IA
                  </button>
                  <button
                    onClick={() => { setPendingUploadCharId(char.id); fileInputRef.current?.click(); }}
                    disabled={uploadingImage === char.id}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-blue-600/90 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg backdrop-blur-sm transition-all"
                  >
                    {uploadingImage === char.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    Uploader
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-white text-lg">{char.name}</h3>
                  <button onClick={() => setSelectedChar(char)} className="p-1.5 bg-purple-600/20 hover:bg-purple-600/40 rounded-lg transition-all" title="Voir le verrou de cohérence">
                    <ShieldCheck className="w-4 h-4 text-purple-400" />
                  </button>
                </div>

                <p className="text-sm text-gray-300 mb-1 line-clamp-2">{char.physicalDescription}</p>
                <p className="text-xs text-gray-500 mb-1 italic">Tenue: {char.outfit}</p>
                <p className="text-xs text-gray-500 mb-3 italic line-clamp-2">Personnalité: {char.personality}</p>

                {/* Voice Section */}
                <div className="border-t border-[#2a2a3e] pt-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Voix</p>
                      {char.voiceProfile ? (
                        <p className="text-xs text-orange-300 font-medium">🎙 {char.voiceProfile}</p>
                      ) : (
                        <p className="text-xs text-gray-600">Aucune voix assignée</p>
                      )}
                    </div>
                    <button
                      onClick={() => setShowVoicePanel(char.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-orange-600/20 hover:bg-orange-600/40 border border-orange-600/30 text-orange-300 text-xs rounded-lg transition-all"
                    >
                      <Mic className="w-3 h-3" />
                      {char.voiceProfile ? "Changer" : "Assigner HeyGen"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
