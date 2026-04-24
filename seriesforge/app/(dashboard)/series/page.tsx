"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Plus, Tv2, ArrowRight, Loader2, X, Trash2, AlertTriangle, Palette, Sparkles } from "lucide-react";
import { VISUAL_STYLE_PRESETS } from "@/lib/visualStyles";

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

// Built from visual style presets
const VISUAL_STYLES = VISUAL_STYLE_PRESETS.map(s => ({ id: s.id, name: s.name, emoji: s.emoji, prompt: s.promptKeywords }));
const TONES = [
  "funny, comedic","dramatic, serious","adventure, epic","romantic, emotional",
  "thriller, suspense","horror, dark","family-friendly, wholesome","satirical, political",
  "funny, dramatic, competitive, reality TV",
];

export default function SeriesPage() {
  const router = useRouter();
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoringStarter, setRestoringStarter] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", visualStyle: "", tone: "", defaultFormat: "9:16" });

  // Load pre-selected style from Styles page
  useEffect(() => {
    fetchSeries();
    const savedStyle = localStorage.getItem("sf_selected_style");
    if (savedStyle) {
      try {
        const style = JSON.parse(savedStyle);
        setForm(f => ({ ...f, visualStyle: style.promptKeywords }));
        setShowForm(true);
        localStorage.removeItem("sf_selected_style");
        toast.success(`Style "${style.name}" pré-sélectionné !`);
      } catch {}
    }
  }, []);

  async function fetchSeries() {
    try {
      const res = await fetch("/api/series/create");
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      setSeries(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/series/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Série créée !");
      setShowForm(false);
      setForm({ title: "", description: "", visualStyle: "", tone: "", defaultFormat: "9:16" });
      router.push(`/series/${data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally { setCreating(false); }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/series/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Suppression échouée");
      toast.success("Série supprimée");
      setDeleteId(null);
      fetchSeries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally { setDeleting(false); }
  }

  async function restoreKonantaStarter() {
    setRestoringStarter(true);
    const t = toast.loading("Restauration de la serie avec personnages et episode preconfigures...");
    try {
      const res = await fetch("/api/demo/konanta", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.dismiss(t);
      toast.success(`Serie restauree: ${data.characterCount} personnages et ${data.sceneCount} scenes deja configures.`);
      router.push(`/series/${data.seriesId}`);
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Restauration impossible");
    } finally {
      setRestoringStarter(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white">Mes Séries</h1>
          <p className="text-gray-400 mt-1">Gérez vos projets de séries animées</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={restoreKonantaStarter}
            disabled={restoringStarter}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-600/20 hover:bg-orange-600/40 border border-orange-600/30 disabled:opacity-50 text-orange-300 font-medium rounded-xl transition-all"
          >
            {restoringStarter ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Remettre mes personnages
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all">
            <Plus className="w-4 h-4" /> Nouvelle Série
          </button>
        </div>
      </div>

      <div className="mb-6 bg-gradient-to-r from-orange-900/30 via-purple-900/20 to-orange-900/30 border border-orange-500/20 rounded-2xl p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-orange-300 mb-1">Starter restaure en un clic</p>
            <p className="text-sm text-gray-300">
              Recrée automatiquement une serie avec les personnages, les decors et un episode deja configure.
            </p>
          </div>
          <button
            onClick={restoreKonantaStarter}
            disabled={restoringStarter}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-all"
          >
            {restoringStarter ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Restaurer le starter
          </button>
        </div>
      </div>

      {/* Delete Confirm Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#13131a] border border-red-600/30 rounded-2xl w-full max-w-sm p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-white mb-2">Supprimer cette série ?</h2>
            <p className="text-gray-400 text-sm mb-5">Tous les personnages, décors et épisodes seront supprimés. Cette action est irréversible.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 border border-[#2a2a3e] text-gray-400 rounded-xl hover:border-gray-500 transition-all">Annuler</button>
              <button onClick={() => handleDelete(deleteId)} disabled={deleting} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#13131a] border border-[#2a2a3e] rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Nouvelle Série</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Titre *</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Les Marseillais à Konanta" required className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brève description de la série..." rows={2} className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm text-gray-300">Style visuel *</label>
                  <Link href="/styles" className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                    <Palette className="w-3 h-3" /> Voir tous les styles
                  </Link>
                </div>
                <select value={form.visualStyle} onChange={e => setForm({ ...form, visualStyle: e.target.value })} required className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white focus:outline-none focus:border-purple-500">
                  <option value="">Choisir le style...</option>
                  {VISUAL_STYLES.map(s => <option key={s.id} value={s.prompt}>{s.emoji} {s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Ton *</label>
                <select value={form.tone} onChange={e => setForm({ ...form, tone: e.target.value })} required className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-white focus:outline-none focus:border-purple-500">
                  <option value="">Choisir le ton...</option>
                  {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Format par défaut</label>
                <div className="flex gap-3">
                  {["9:16", "16:9"].map(f => (
                    <button key={f} type="button" onClick={() => setForm({ ...form, defaultFormat: f })} className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${form.defaultFormat === f ? "bg-purple-600/20 border-purple-500 text-purple-300" : "bg-[#1e1e2e] border-[#2a2a3e] text-gray-400"}`}>
                      {f} {f === "9:16" ? "(TikTok)" : "(YouTube)"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 border border-[#2a2a3e] text-gray-400 rounded-xl">Annuler</button>
                <button type="submit" disabled={creating} className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>
      ) : series.length === 0 ? (
        <div className="text-center py-16 bg-[#13131a] border border-dashed border-[#2a2a3e] rounded-2xl">
          <Tv2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">Aucune série. Créez votre première !</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={restoreKonantaStarter}
              disabled={restoringStarter}
              className="px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-medium rounded-xl transition-all"
            >
              {restoringStarter ? <Loader2 className="w-4 h-4 inline mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 inline mr-2" />}
              Restaurer le starter
            </button>
            <button onClick={() => setShowForm(true)} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all">
              <Plus className="w-4 h-4 inline mr-2" /> Nouvelle Série
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {series.map(s => (
            <div key={s.id} className="bg-[#13131a] border border-[#2a2a3e] rounded-xl p-5 card-hover group relative">
              <button
                onClick={() => setDeleteId(s.id)}
                className="absolute top-3 right-3 p-1.5 bg-red-600/0 hover:bg-red-600/20 text-gray-600 hover:text-red-400 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <Link href={`/series/${s.id}`} className="block">
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 bg-purple-600/20 rounded-lg"><Tv2 className="w-5 h-5 text-purple-400" /></div>
                  <span className="text-xs px-2 py-1 bg-[#1e1e2e] border border-[#2a2a3e] rounded-full text-gray-400">{s.defaultFormat}</span>
                </div>
                <h3 className="font-bold text-white mb-1 group-hover:text-purple-300 transition-colors pr-8">{s.title}</h3>
                {s.description && <p className="text-xs text-gray-500 mb-2 line-clamp-2">{s.description}</p>}
                <p className="text-xs text-gray-600 mb-3 italic">{s.visualStyle}</p>
                <div className="flex items-center justify-between">
                  <div className="flex gap-3 text-xs text-gray-400">
                    <span>{s._count.episodes} épisodes</span>
                    <span>{s._count.characters} personnages</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-purple-400 transition-colors" />
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
