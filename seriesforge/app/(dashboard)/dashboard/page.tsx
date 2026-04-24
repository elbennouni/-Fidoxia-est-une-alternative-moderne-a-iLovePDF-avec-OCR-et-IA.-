"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Plus, Tv2, Film, Sparkles, ArrowRight, Loader2, RotateCcw } from "lucide-react";

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
  const [demoLoading, setDemoLoading] = useState(false);
  const [starterLoading, setStarterLoading] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadSeries() {
      try {
        const res = await fetch("/api/series/create");
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        if (!ignore) {
          setSeries(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!ignore) {
          toast.error("Erreur chargement des séries");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadSeries();

    return () => {
      ignore = true;
    };
  }, [router]);

  async function generateKonantaDemo() {
    setDemoLoading(true);
    const t = toast.loading("🎬 Running full AI pipeline... This takes 2-3 minutes", { duration: 180000 });
    try {
      const res = await fetch("/api/demo/konanta", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.dismiss(t);
      toast.success(`✅ Demo created! ${data.sceneCount} scenes, avg score: ${data.averageQualityScore}/100`);
      router.push(`/series/${data.seriesId}`);
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Demo failed");
    } finally {
      setDemoLoading(false);
    }
  }

  async function restoreKonantaStarter() {
    setStarterLoading(true);
    const t = toast.loading("Restauration de Konanta avec personnages et épisodes...");
    try {
      const res = await fetch("/api/demo/konanta-starter", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.dismiss(t);
      toast.success(
        `✅ Série restaurée : ${data.characterCount} personnages et ${data.episodeCount} épisodes prêts`
      );
      router.push(`/series/${data.seriesId}`);
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Restauration impossible");
    } finally {
      setStarterLoading(false);
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

      {/* Konanta Starter Banner */}
      <div className="mb-8 relative overflow-hidden bg-gradient-to-r from-purple-900/40 via-blue-900/30 to-purple-900/40 border border-purple-500/30 rounded-2xl p-6">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-blue-600/10" />
        <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <RotateCcw className="w-5 h-5 text-blue-300" />
              <span className="text-blue-300 font-semibold text-sm">PRESET</span>
            </div>
            <h2 className="text-xl font-bold text-white">Remettre mes personnages et épisodes Konanta</h2>
            <p className="text-gray-300 text-sm mt-1">
              Restaure une série prête à éditer avec 5 personnages, 3 épisodes et les décors déjà configurés.
            </p>
            <p className="text-gray-400 text-xs mt-1">
              Série : &quot;Les Marseillais à Konanta&quot; — Pixar 3D Reality TV
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <button
              onClick={restoreKonantaStarter}
              disabled={starterLoading}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 whitespace-nowrap"
            >
              {starterLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Restauration...</>
              ) : (
                <><RotateCcw className="w-4 h-4" /> Restaurer la série</>
              )}
            </button>
            <button
              onClick={generateKonantaDemo}
              disabled={demoLoading}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 whitespace-nowrap glow-purple"
            >
              {demoLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Génération...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Démo IA complète</>
              )}
            </button>
          </div>
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
          <p className="text-gray-500 text-sm mb-6">Créez votre première série ou essayez le démo Konanta</p>
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
