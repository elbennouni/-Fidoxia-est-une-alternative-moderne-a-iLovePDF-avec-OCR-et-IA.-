"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowLeft, Plus, Users, X, Loader2, ShieldCheck, Sparkles, Upload, Mic, FileJson, Trash2, AlertTriangle, Play, Square } from "lucide-react";

interface Character {
  id: string;
  name: string;
  physicalDescription: string;
  outfit: string;
  personality: string;
  voiceProfile?: string;
  referenceImageUrl?: string;
  consistencyPrompt: string;
}

interface HeyGenVoice { voice_id: string; name: string; language: string; gender: string; }

const VOICE_PROFILES = ["Male, deep, authoritative","Male, young, energetic","Male, grumpy, older","Female, strong, confident","Female, soft, gentle","Female, energetic, cheerful","Child, playful","TV presenter, enthusiastic","Villain, menacing"];

const EXAMPLE_CHARS_JSON = `{
  "personnages": [
    {
      "nom": "Hassan",
      "description": "Homme athlétique de 28 ans, cheveux noirs courts, peau bronzée",
      "tenue": "Short de plage déchiré, collier tribal, torse nu",
      "personnalite": "Drôle, déterminé, compétitif mais toujours de bonne humeur",
      "voix": "Voix masculine énergique, accent marseillais"
    },
    {
      "nom": "Sarah",
      "description": "Femme athlétique de 25 ans, cheveux bouclés bruns, musculature marquée",
      "tenue": "Haut de bikini sport, short camouflage, baskets",
      "personnalite": "Forte, compétitive, naturellement leader, ne supporte pas la médiocrité",
      "voix": "Voix féminine assurée, ton direct et autoritaire"
    }
  ]
}`;

export default function CharactersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: seriesId } = use(params);
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [visualStyle, setVisualStyle] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importJsonError, setImportJsonError] = useState("");
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [generatingImage, setGeneratingImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [heygenVoices, setHeygenVoices] = useState<HeyGenVoice[]>([]);
  const [showVoicePanel, setShowVoicePanel] = useState<string | null>(null);
  const [pendingUploadCharId, setPendingUploadCharId] = useState<string | null>(null);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ name: "", physicalDescription: "", outfit: "", personality: "", voiceProfile: "" });

  function playVoicePreview(url: string, id: string) {
    if (playingVoice === id) {
      audioRef.current?.pause();
      setPlayingVoice(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play();
    setPlayingVoice(id);
    audio.onended = () => setPlayingVoice(null);
    audio.onerror = () => { setPlayingVoice(null); toast.error("Lecture impossible"); };
  }

  useEffect(() => { fetchData(); }, [seriesId]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/series/${seriesId}`);
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      setCharacters(data.characters || []);
      setVisualStyle(data.visualStyle || "");
    } finally { setLoading(false); }
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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, seriesId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`"${form.name}" créé !`);
      setShowForm(false);
      setForm({ name: "", physicalDescription: "", outfit: "", personality: "", voiceProfile: "" });
      fetchData();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erreur"); }
    finally { setCreating(false); }
  }

  async function handleImportJson() {
    if (!importJson.trim()) return;
    try { JSON.parse(importJson); setImportJsonError(""); } catch (e) { setImportJsonError(e instanceof Error ? e.message : "JSON invalide"); return; }
    setImporting(true);
    const t = toast.loading("Import et normalisation des personnages...");
    try {
      const res = await fetch("/api/characters/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesId, rawJson: JSON.parse(importJson) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.dismiss(t);
      toast.success(`✅ ${data.count} personnages importés !`);
      setShowImport(false);
      setImportJson("");
      fetchData();
    } catch (err) { toast.dismiss(t); toast.error(err instanceof Error ? err.message : "Erreur"); }
    finally { setImporting(false); }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await fetch(`/api/characters/${id}`, { method: "DELETE" });
      toast.success("Personnage supprimé");
      setDeleteId(null);
      fetchData();
    } catch { toast.error("Erreur suppression"); }
    finally { setDeleting(false); }
  }

  async function generateImage(char: Character) {
    setGeneratingImage(char.id);
    const t = toast.loading(`Génération image de ${char.name}...`);
    try {
      const res = await fetch("/api/generate/character-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: char.id, visualStyle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.dismiss(t); toast.success(`Image de ${char.name} générée !`);
      fetchData();
    } catch (err) { toast.dismiss(t); toast.error(err instanceof Error ? err.message : "Erreur"); }
    finally { setGeneratingImage(null); }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, charId: string) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(charId);
    const t = toast.loading("Upload...");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "characters");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetch(`/api/characters/${charId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ referenceImageUrl: data.url }) });
      toast.dismiss(t); toast.success("Photo uploadée !"); fetchData();
    } catch (err) { toast.dismiss(t); toast.error(err instanceof Error ? err.message : "Erreur"); }
    finally { setUploadingImage(null); }
  }

  async function assignVoice(charId: string, voiceId: string, voiceName: string) {
    try {
      await fetch(`/api/characters/${charId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voiceProfile: voiceName }) });
      toast.success(`Voix "${voiceName}" assignée !`);
      setShowVoicePanel(null); fetchData();
    } catch { toast.error("Erreur"); }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => pendingUploadCharId && handleFileUpload(e, pendingUploadCharId)} />

      <div className="mb-6">
        <Link href={`/series/${seriesId}`} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" /> Retour à la série
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3"><Users className="w-7 h-7 text-blue-400" /> Personnages</h1>
            <p className="text-gray-400 mt-1">{characters.length} personnage{characters.length > 1 ? "s" : ""}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-4 py-2.5 bg-orange-600/20 hover:bg-orange-600/40 border border-orange-600/30 text-orange-300 font-medium rounded-xl transition-all">
              <FileJson className="w-4 h-4" /> Importer JSON
            </button>
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all">
              <Plus className="w-4 h-4" /> Nouveau
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#13131a] border border-red-600/30 rounded-2xl w-full max-w-sm p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-white mb-2">Supprimer ce personnage ?</h2>
            <p className="text-gray-400 text-sm mb-5">Cette action est irréversible.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 border border-[#2a2a3e] text-gray-400 rounded-xl">Annuler</button>
              <button onClick={() => handleDelete(deleteId)} disabled={deleting} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import JSON Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#13131a] border border-[#2a2a3e] rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto scrollbar-thin">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><FileJson className="w-5 h-5 text-orange-400" /> Importer des personnages</h2>
              <button onClick={() => setShowImport(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-400 mb-3">Colle ton JSON de personnages — n'importe quel format, en français ou autre. L'IA normalise tout.</p>
            <button onClick={() => setImportJson(EXAMPLE_CHARS_JSON)} className="text-xs text-orange-400 hover:text-orange-300 mb-2 block">Voir un exemple</button>
            <textarea
              value={importJson}
              onChange={e => { setImportJson(e.target.value); try { JSON.parse(e.target.value); setImportJsonError(""); } catch (err) { if (e.target.value) setImportJsonError(err instanceof Error ? err.message : "JSON invalide"); } }}
              placeholder={`{\n  "personnages": [\n    { "nom": "Hassan", "description": "...", "tenue": "...", "personnalite": "..." }\n  ]\n}`}
              rows={12}
              className={`w-full px-4 py-3 bg-[#1e1e2e] border rounded-xl text-sm text-gray-200 placeholder-gray-600 focus:outline-none font-mono resize-none ${importJsonError ? "border-red-500" : "border-[#2a2a3e] focus:border-orange-500"}`}
            />
            {importJsonError && <p className="text-xs text-red-400 mt-1">⚠ {importJsonError}</p>}
            {importJson && !importJsonError && <p className="text-xs text-green-400 mt-1">✅ JSON valide</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowImport(false)} className="flex-1 py-3 border border-[#2a2a3e] text-gray-400 rounded-xl">Annuler</button>
              <button onClick={handleImportJson} disabled={importing || !importJson.trim() || !!importJsonError} className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileJson className="w-4 h-4" />}
                {importing ? "Import..." : "Importer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#13131a] border border-[#2a2a3e] rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto scrollbar-thin">
            <div className="flex items-center justify-between mb-5"><h2 className="text-xl font-bold text-white">Nouveau Personnage</h2><button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div><label className="block text-sm text-gray-300 mb-1">Nom *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Hassan" required className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" /></div>
              <div><label className="block text-sm text-gray-300 mb-1">Description physique *</label><textarea value={form.physicalDescription} onChange={e => setForm({ ...form, physicalDescription: e.target.value })} placeholder="Homme athlétique, 28 ans..." required rows={2} className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none" /></div>
              <div><label className="block text-sm text-gray-300 mb-1">Tenue *</label><input value={form.outfit} onChange={e => setForm({ ...form, outfit: e.target.value })} placeholder="Short de plage, collier tribal..." required className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" /></div>
              <div><label className="block text-sm text-gray-300 mb-1">Personnalité *</label><textarea value={form.personality} onChange={e => setForm({ ...form, personality: e.target.value })} placeholder="Drôle, déterminé..." required rows={2} className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none" /></div>
              <div><label className="block text-sm text-gray-300 mb-1">Profil de voix</label><select value={form.voiceProfile} onChange={e => setForm({ ...form, voiceProfile: e.target.value })} className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white focus:outline-none focus:border-purple-500"><option value="">Sélectionner...</option>{VOICE_PROFILES.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 border border-[#2a2a3e] text-gray-400 rounded-xl">Annuler</button>
                <button type="submit" disabled={creating} className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2">{creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Consistency Modal */}
      {selectedChar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#13131a] border border-[#2a2a3e] rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-white flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-purple-400" /> {selectedChar.name}</h2><button onClick={() => setSelectedChar(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button></div>
            <div className="bg-[#1e1e2e] border border-purple-600/30 rounded-xl p-4"><p className="text-sm text-purple-200 leading-relaxed font-mono">{selectedChar.consistencyPrompt}</p></div>
          </div>
        </div>
      )}

      {/* Voice Panel */}
      {showVoicePanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#13131a] border border-[#2a2a3e] rounded-2xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto scrollbar-thin">
            <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold text-white flex items-center gap-2"><Mic className="w-5 h-5 text-orange-400" /> Voix HeyGen</h2><button onClick={() => setShowVoicePanel(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button></div>
            <div className="space-y-2">
              {heygenVoices.map(voice => (
                <div key={voice.voice_id} className={`flex items-center gap-3 p-3 border rounded-xl transition-all ${playingVoice === voice.voice_id ? "border-green-500/50 bg-green-900/10" : "bg-[#1e1e2e] border-[#2a2a3e] hover:border-orange-500/50"}`}>
                  <div className="flex-1">
                    <p className="font-medium text-white text-sm">{voice.name}</p>
                    <p className="text-xs text-gray-400">{voice.language === "fr" ? "🇫🇷" : "🇬🇧"} {voice.language} · {voice.gender === "male" ? "♂" : "♀"} {voice.gender}</p>
                  </div>
                  {(voice as unknown as { preview_audio?: string }).preview_audio && (
                    <button
                      onClick={() => playVoicePreview((voice as unknown as { preview_audio: string }).preview_audio, voice.voice_id)}
                      className={`flex items-center gap-1 px-2 py-1.5 border rounded-lg text-xs transition-all flex-shrink-0 ${playingVoice === voice.voice_id ? "bg-green-600/20 border-green-600/30 text-green-300" : "bg-[#2a2a3e] border-[#3a3a4e] text-gray-300 hover:text-green-300 hover:border-green-500/50"}`}
                    >
                      {playingVoice === voice.voice_id ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                      {playingVoice === voice.voice_id ? "Stop" : "Écouter"}
                    </button>
                  )}
                  <button onClick={() => assignVoice(showVoicePanel, voice.voice_id, voice.name)} className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium rounded-lg transition-all flex-shrink-0">
                    Assigner
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>
      ) : characters.length === 0 ? (
        <div className="text-center py-16 bg-[#13131a] border border-dashed border-[#2a2a3e] rounded-2xl">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-2 text-lg font-medium">Aucun personnage</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setShowImport(true)} className="px-5 py-2.5 bg-orange-600/20 border border-orange-600/30 text-orange-300 font-medium rounded-xl"><FileJson className="w-4 h-4 inline mr-2" />Importer JSON</button>
            <button onClick={() => setShowForm(true)} className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl"><Plus className="w-4 h-4 inline mr-2" />Créer manuellement</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {characters.map(char => (
            <div key={char.id} className="bg-[#13131a] border border-[#2a2a3e] rounded-xl overflow-hidden card-hover group relative">
              {/* Delete button */}
              <button onClick={() => setDeleteId(char.id)} className="absolute top-2 right-2 z-10 p-1.5 bg-red-600/0 hover:bg-red-600/80 text-transparent hover:text-white rounded-lg transition-all group-hover:text-red-400 group-hover:bg-red-600/20">
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Image */}
              <div className="relative aspect-square bg-[#1e1e2e] flex items-center justify-center overflow-hidden">
                {char.referenceImageUrl ? (
                  <img src={char.referenceImageUrl} alt={char.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-4">
                    <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-3xl mx-auto mb-2">{char.name[0]}</div>
                    <p className="text-gray-500 text-xs">Pas d'image</p>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 right-2 flex gap-2">
                  <button onClick={() => generateImage(char)} disabled={generatingImage === char.id} className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-purple-600/90 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg backdrop-blur-sm transition-all">
                    {generatingImage === char.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} IA
                  </button>
                  <button onClick={() => { setPendingUploadCharId(char.id); fileInputRef.current?.click(); }} disabled={uploadingImage === char.id} className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-blue-600/90 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg backdrop-blur-sm transition-all">
                    {uploadingImage === char.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Photo
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-white text-lg">{char.name}</h3>
                  <button onClick={() => setSelectedChar(char)} className="p-1.5 bg-purple-600/20 hover:bg-purple-600/40 rounded-lg transition-all" title="Verrou cohérence"><ShieldCheck className="w-4 h-4 text-purple-400" /></button>
                </div>
                <p className="text-sm text-gray-300 mb-1 line-clamp-2">{char.physicalDescription}</p>
                <p className="text-xs text-gray-500 mb-1 italic line-clamp-1">👗 {char.outfit}</p>
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">💬 {char.personality}</p>
                <div className="border-t border-[#2a2a3e] pt-3 flex items-center justify-between">
                  <div>{char.voiceProfile ? <p className="text-xs text-orange-300">🎙 {char.voiceProfile}</p> : <p className="text-xs text-gray-600">Pas de voix</p>}</div>
                  <button onClick={() => setShowVoicePanel(char.id)} className="flex items-center gap-1 px-2 py-1 bg-orange-600/20 hover:bg-orange-600/40 border border-orange-600/30 text-orange-300 text-xs rounded-lg transition-all"><Mic className="w-3 h-3" />{char.voiceProfile ? "Changer" : "HeyGen"}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
