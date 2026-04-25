"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowLeft, Plus, MapPin, X, Loader2, Sparkles, Upload } from "lucide-react";

interface Environment {
  id: string;
  name: string;
  description: string;
  lighting?: string;
  mood?: string;
  reusable: boolean;
  previewImageUrl?: string;
  createdAt: string;
}

const LIGHTINGS = ["Soleil tropical intense", "Lumière dorée (golden hour)", "Scène de nuit", "Lumière intérieure chaleureuse", "Orage dramatique", "Lumière douce nuageuse", "Néons urbains", "Bougie", "Aube brumeuse"];
const MOODS = ["Action, intense", "Romantique, calme", "Mystérieux, tendu", "Comique, fun", "Épique, dramatique", "Paisible, serein", "Chaotique, frénétique", "Mélancolique, triste"];

export default function EnvironmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: seriesId } = use(params);
  const router = useRouter();
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [generatingImage, setGeneratingImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [pendingUploadEnvId, setPendingUploadEnvId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      toast.success(`Décor "${form.name}" créé !`);
      setShowForm(false);
      setForm({ name: "", description: "", lighting: "", mood: "", reusable: true });
      fetchEnvs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setCreating(false);
    }
  }

  async function generateImage(env: Environment) {
    setGeneratingImage(env.id);
    const t = toast.loading(`Génération du décor "${env.name}"...`);
    try {
      const res = await fetch("/api/generate/environment-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environmentId: env.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.dismiss(t);
      toast.success(`Décor "${env.name}" généré !`);
      fetchEnvs();
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Génération échouée");
    } finally {
      setGeneratingImage(null);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, envId: string) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(envId);
    const t = toast.loading("Upload en cours...");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "environments");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const patchRes = await fetch(`/api/environments/${envId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewImageUrl: data.url }),
      });
      const patchData = await patchRes.json();
      if (!patchRes.ok) throw new Error(patchData.error || "Échec enregistrement décor");

      toast.dismiss(t);
      toast.success("Image uploadée !");
      fetchEnvs();
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Upload échoué");
    } finally {
      setUploadingImage(null);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pendingUploadEnvId && handleFileUpload(e, pendingUploadEnvId)}
      />

      <div className="mb-6">
        <Link href={`/series/${seriesId}`} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" /> Retour à la série
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <MapPin className="w-7 h-7 text-green-400" /> Décors & Environnements
            </h1>
            <p className="text-gray-400 mt-1">Créez vos décors, générez les images ou uploadez vos propres visuels</p>
          </div>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all">
            <Plus className="w-4 h-4" /> Nouveau Décor
          </button>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#13131a] border border-[#2a2a3e] rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Nouveau Décor</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Nom *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Plage de Konanta" required className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Description *</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Une magnifique plage tropicale avec eau cristalline, sable blanc, palmiers..." required rows={3} className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Éclairage</label>
                  <select value={form.lighting} onChange={e => setForm({ ...form, lighting: e.target.value })} className="w-full px-3 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white focus:outline-none focus:border-purple-500 text-sm">
                    <option value="">Sélectionner...</option>
                    {LIGHTINGS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Ambiance</label>
                  <select value={form.mood} onChange={e => setForm({ ...form, mood: e.target.value })} className="w-full px-3 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white focus:outline-none focus:border-purple-500 text-sm">
                    <option value="">Sélectionner...</option>
                    {MOODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setForm({ ...form, reusable: !form.reusable })} className={`relative w-11 h-6 rounded-full transition-all ${form.reusable ? "bg-purple-600" : "bg-[#2a2a3e]"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.reusable ? "translate-x-5" : "translate-x-0"}`} />
                </button>
                <span className="text-sm text-gray-300">Réutilisable dans plusieurs épisodes</span>
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

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>
      ) : environments.length === 0 ? (
        <div className="text-center py-16 bg-[#13131a] border border-dashed border-[#2a2a3e] rounded-2xl">
          <MapPin className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-2 text-lg font-medium">Aucun décor</p>
          <p className="text-gray-500 text-sm mb-6">Créez vos lieux de tournage pour les intégrer dans vos scènes</p>
          <button onClick={() => setShowForm(true)} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all">
            <Plus className="w-4 h-4 inline mr-2" /> Créer le premier décor
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {environments.map(env => (
            <div key={env.id} className="bg-[#13131a] border border-[#2a2a3e] rounded-xl overflow-hidden card-hover">
              {/* Image */}
              <div className="relative aspect-video bg-[#1e1e2e] flex items-center justify-center overflow-hidden">
                {env.previewImageUrl ? (
                  <img src={env.previewImageUrl} alt={env.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-4">
                    <MapPin className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500 text-xs">Pas d'image</p>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 right-2 flex gap-2">
                  <button
                    onClick={() => generateImage(env)}
                    disabled={generatingImage === env.id}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-purple-600/90 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg backdrop-blur-sm transition-all"
                  >
                    {generatingImage === env.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Générer IA
                  </button>
                  <button
                    onClick={() => { setPendingUploadEnvId(env.id); fileInputRef.current?.click(); }}
                    disabled={uploadingImage === env.id}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-blue-600/90 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg backdrop-blur-sm transition-all"
                  >
                    {uploadingImage === env.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    Uploader
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-white">{env.name}</h3>
                  {env.reusable && <span className="text-xs text-green-400">♻ Réutilisable</span>}
                </div>
                <p className="text-sm text-gray-300 mb-3 line-clamp-3">{env.description}</p>
                <div className="flex flex-wrap gap-2">
                  {env.lighting && <span className="text-xs px-2 py-0.5 bg-yellow-600/20 border border-yellow-600/30 rounded-full text-yellow-300">💡 {env.lighting}</span>}
                  {env.mood && <span className="text-xs px-2 py-0.5 bg-blue-600/20 border border-blue-600/30 rounded-full text-blue-300">🎭 {env.mood}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
