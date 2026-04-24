"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Plus, Tv2, Film, Sparkles, Zap, ArrowRight, Loader2 } from "lucide-react";

interface Series {
  id: string;
  title: string;
  visualStyle: string;
  tone: string;
  defaultFormat: string;
  _count: { episodes: number; characters: number };
  createdAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoreLoading, setRestoreLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/series/create");
        if (res.status === 401) { router.push("/login"); return; }
        const data = await res.json();
        if (alive) setSeries(Array.isArray(data) ? data : []);
      } catch {
        toast.error("Erreur chargement des séries");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [router]);

  async function restoreConfiguredKonanta() {
    setRestoreLoading(true);
    const t = toast.loading("♻️ Restauration des personnages et de l'épisode configuré...");
    try {
      const res = await fetch("/api/demo/konanta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "configured" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.dismiss(t);
      toast.success(`✅ Restauré ! ${data.sceneCount} scènes et les personnages sont prêts.`);
      router.push(`/series/${data.seriesId}`);
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Restauration impossible");
    } finally {
      setRestoreLoading(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-white mb-2">
          Bienvenue sur <span className="gradient-text">SeriesForge AI</span>
        </h1>
        <p className="text-gray-400 text-lg">Créez des séries animées avec l&apos;intelligence multi-agents</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-[#13131a] border border-[#2a2a3e] rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-600/20 rounded-lg"><Tv2 className="w-5 h-5 text-purple-400" /></div>
            <span className="text-gray-400 text-sm">Séries</span>
          </div>
          <p className="text-3xl font-bold text-white">{series.length}</p>
        </div>
        <div className="bg-[#13131a] border border-[#2a2a3e] rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-600/20 rounded-lg"><Film className="w-5 h-5 text-blue-400" /></div>
            <span className="text-gray-400 text-sm">Épisodes</span>
          </div>
          <p className="text-3xl font-bold text-white">
            {series.reduce((s, ser) => s + ser._count.episodes, 0)}
          </p>
        </div>
        <div className="bg-[#13131a] border border-[#2a2a3e] rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-600/20 rounded-lg"><Sparkles className="w-5 h-5 text-green-400" /></div>
            <span className="text-gray-400 text-sm">Personnages</span>
          </div>
          <p className="text-3xl font-bold text-white">
            {series.reduce((s, ser) => s + ser._count.characters, 0)}
          </p>
        </div>
      </div>

      {/* Konanta Restore Banner */}
      <div className="mb-8 relative overflow-hidden bg-gradient-to-r from-purple-900/40 via-blue-900/30 to-purple-900/40 border border-purple-500/30 rounded-2xl p-6">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-blue-600/10" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-5 h-5 text-yellow-400" />
              <span className="text-yellow-400 font-semibold text-sm">RESTAURATION</span>
            </div>
            <h2 className="text-xl font-bold text-white">Récupérer mes persos + épisode configuré</h2>
            <p className="text-gray-300 text-sm mt-1">
              Restaure un setup prêt : 5 personnages · 1 épisode · 8 scènes déjà configurées
            </p>
            <p className="text-gray-400 text-xs mt-1">Série: &quot;Les Marseillais à Konanta (Préconfiguré)&quot; — Pixar 3D Reality TV</p>
          </div>
          <button
            onClick={restoreConfiguredKonanta}
            disabled={restoreLoading}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 whitespace-nowrap glow-purple"
          >
            {restoreLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Restauration...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Restaurer maintenant</>
            )}
          </button>
        </div>
      </div>

      {/* Series List */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Mes Séries</h2>
        <Link
          href="/series"
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-all"
        >
          <Plus className="w-4 h-4" /> Nouvelle Série
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
        </div>
      ) : series.length === 0 ? (
        <div className="text-center py-16 bg-[#13131a] border border-[#2a2a3e] border-dashed rounded-2xl">
          <Film className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg mb-2">Aucune série pour l&apos;instant</p>
          <p className="text-gray-500 text-sm mb-6">Créez votre première série ou restaurez le setup Konanta préconfiguré</p>
          <Link href="/series" className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all">
            <Plus className="w-4 h-4" /> Créer une Série
          </Link>
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
              <p className="text-xs text-gray-500 mb-3">{s.visualStyle}</p>
              <div className="flex items-center justify-between">
                <div className="flex gap-3 text-xs text-gray-400">
                  <span>{s._count.episodes} épisodes</span>
                  <span>{s._count.characters} persos</span>
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
