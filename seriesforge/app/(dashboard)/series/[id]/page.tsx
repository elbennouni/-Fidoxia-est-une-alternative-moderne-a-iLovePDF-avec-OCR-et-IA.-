"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowLeft, Users, MapPin, Film, Plus, Loader2, ChevronRight,
  Sparkles, Tv2, Settings2, Image, Volume2, Video, Zap, FileJson, Trash2, AlertTriangle, RotateCcw
} from "lucide-react";

interface Series {
  id: string;
  title: string;
  description?: string;
  visualStyle: string;
  tone: string;
  defaultFormat: string;
  coverImageUrl?: string;
  characters: Array<{ id: string; name: string; physicalDescription: string; outfit: string; referenceImageUrl?: string; voiceProfile?: string }>;
  environments: Array<{ id: string; name: string; description: string; previewImageUrl?: string }>;
  episodes: Array<{ id: string; title: string; status: string; format: string; createdAt: string; scenes?: Array<{ imageUrl?: string }> }>;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-600/20 text-gray-400 border-gray-600/30",
  generating: "bg-yellow-600/20 text-yellow-400 border-yellow-600/30",
  complete: "bg-green-600/20 text-green-400 border-green-600/30",
  error: "bg-red-600/20 text-red-400 border-red-600/30",
};

export default function SeriesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [series, setSeries] = useState<Series | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "episodes" | "characters" | "environments">("overview");
  const [deleteEpId, setDeleteEpId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [restoringConfig, setRestoringConfig] = useState(false);

  useEffect(() => { fetchSeries(); }, [id]);

  async function fetchSeries() {
    try {
      const res = await fetch(`/api/series/${id}`);
      if (res.status === 401) { router.push("/login"); return; }
      if (!res.ok) { router.push("/series"); return; }
      setSeries(await res.json());
    } finally { setLoading(false); }
  }

  async function generateCover() {
    setGeneratingCover(true);
    const t = toast.loading("Génération de la vignette de série...");
    try {
      const res = await fetch(`/api/series/${id}/generate-cover`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.dismiss(t);
      toast.success("Vignette générée !");
      fetchSeries();
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally { setGeneratingCover(false); }
  }

  async function deleteEpisode(epId: string) {
    setDeleting(true);
    try {
      await fetch(`/api/episodes/${epId}`, { method: "DELETE" });
      toast.success("Épisode supprimé");
      setDeleteEpId(null);
      fetchSeries();
    } catch { toast.error("Erreur suppression"); }
    finally { setDeleting(false); }
  }

  async function restoreConfiguredSetup() {
    const confirmed = window.confirm("Restaurer les personnages et l'épisode configurés ? Cela remplacera les personnages, décors et épisodes actuels.");
    if (!confirmed) return;

    setRestoringConfig(true);
    const t = toast.loading("Restauration de la configuration en cours...");
    try {
      const res = await fetch(`/api/series/${id}/restore-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replaceExisting: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Restauration impossible");
      toast.dismiss(t);
      toast.success(`Configuration restaurée : ${data.characterCount} personnages, ${data.sceneCount} scènes`);
      await fetchSeries();
      if (data.episodeId) {
        router.push(`/episodes/${data.episodeId}/editor`);
      }
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Erreur de restauration");
    } finally {
      setRestoringConfig(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>;
  if (!series) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Delete episode modal */}
      {deleteEpId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#13131a] border border-red-600/30 rounded-2xl w-full max-w-sm p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-white mb-2">Supprimer cet épisode ?</h2>
            <p className="text-gray-400 text-sm mb-5">Toutes les scènes seront supprimées.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteEpId(null)} className="flex-1 py-2.5 border border-[#2a2a3e] text-gray-400 rounded-xl">Annuler</button>
              <button onClick={() => deleteEpisode(deleteEpId)} disabled={deleting} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back */}
      <Link href="/series" className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" /> Mes Séries
      </Link>

      {/* Series Hero */}
      <div className="bg-[#13131a] border border-[#2a2a3e] rounded-2xl overflow-hidden mb-6">
        {/* Cover */}
        <div className="relative h-48 bg-gradient-to-br from-purple-900/40 via-blue-900/30 to-[#13131a] overflow-hidden">
          {series.coverImageUrl ? (
            <img src={series.coverImageUrl} alt={series.title} className="w-full h-full object-cover opacity-70" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Tv2 className="w-20 h-20 text-purple-800/50" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#13131a] via-transparent to-transparent" />
          <button
            onClick={generateCover}
            disabled={generatingCover}
            className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 bg-black/60 hover:bg-purple-600/80 backdrop-blur-sm border border-white/10 text-white text-xs font-medium rounded-xl transition-all"
          >
            {generatingCover ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {series.coverImageUrl ? "Regénérer la vignette" : "Générer la vignette"}
          </button>
        </div>

        {/* Series Info */}
        <div className="p-5 -mt-8 relative">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">{series.title}</h1>
              {series.description && <p className="text-gray-400 text-sm mb-2">{series.description}</p>}
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs px-2 py-0.5 bg-purple-600/20 border border-purple-600/30 rounded-full text-purple-300">{series.visualStyle}</span>
                <span className="text-xs px-2 py-0.5 bg-blue-600/20 border border-blue-600/30 rounded-full text-blue-300">{series.tone}</span>
                <span className="text-xs px-2 py-0.5 bg-[#1e1e2e] border border-[#2a2a3e] rounded-full text-gray-400">{series.defaultFormat}</span>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={restoreConfiguredSetup}
                disabled={restoringConfig}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-600/20 border border-amber-600/30 hover:bg-amber-600/35 disabled:opacity-50 text-amber-300 text-xs rounded-xl transition-all"
                title="Restaurer personnages + épisode préconfigurés"
              >
                {restoringConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                Restaurer config
              </button>
              <Link href={`/series/${id}/characters`} className="flex items-center gap-1.5 px-3 py-2 bg-[#1e1e2e] border border-[#2a2a3e] hover:border-blue-500/50 text-gray-300 text-xs rounded-xl transition-all">
                <Users className="w-3.5 h-3.5 text-blue-400" /> {series.characters.length} personnages
              </Link>
              <Link href={`/series/${id}/environments`} className="flex items-center gap-1.5 px-3 py-2 bg-[#1e1e2e] border border-[#2a2a3e] hover:border-green-500/50 text-gray-300 text-xs rounded-xl transition-all">
                <MapPin className="w-3.5 h-3.5 text-green-400" /> {series.environments.length} décors
              </Link>
              <Link href={`/series/${id}/episodes`} className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-xl transition-all">
                <Plus className="w-3.5 h-3.5" /> Nouvel épisode
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#13131a] border border-[#2a2a3e] rounded-xl p-1 mb-6 overflow-x-auto">
        {[
          { id: "overview", label: "Vue d'ensemble", icon: Tv2 },
          { id: "episodes", label: `Épisodes (${series.episodes.length})`, icon: Film },
          { id: "characters", label: `Personnages (${series.characters.length})`, icon: Users },
          { id: "environments", label: `Décors (${series.environments.length})`, icon: MapPin },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-purple-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Pipeline Steps */}
          <div className="bg-[#13131a] border border-[#2a2a3e] rounded-xl p-5">
            <h2 className="font-bold text-white mb-4 flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-400" /> Pipeline de création</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { step: 1, label: "Personnages", sub: `${series.characters.length} créés`, icon: Users, color: "blue", href: `/series/${id}/characters`, done: series.characters.length > 0 },
                { step: 2, label: "Décors", sub: `${series.environments.length} créés`, icon: MapPin, color: "green", href: `/series/${id}/environments`, done: series.environments.length > 0 },
                { step: 3, label: "Images", sub: "Générer par scène", icon: Image, color: "purple", href: series.episodes[0] ? `/episodes/${series.episodes[0].id}/editor` : `/series/${id}/episodes`, done: false },
                { step: 4, label: "Vidéo", sub: "Kling / Runway", icon: Video, color: "orange", href: series.episodes[0] ? `/episodes/${series.episodes[0].id}/video` : `/series/${id}/episodes`, done: false },
              ].map(({ step, label, sub, icon: Icon, color, href, done }) => (
                <Link key={step} href={href} className={`p-3 rounded-xl border transition-all hover:scale-105 ${done ? "border-green-600/40 bg-green-900/10" : "border-[#2a2a3e] bg-[#1e1e2e] hover:border-purple-500/40"}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-2 ${done ? "bg-green-600 text-white" : "bg-gray-700 text-gray-300"}`}>
                    {done ? "✓" : step}
                  </div>
                  <Icon className={`w-5 h-5 mb-1 text-${color}-400`} />
                  <p className="font-semibold text-white text-sm">{label}</p>
                  <p className="text-xs text-gray-500">{sub}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Episodes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-white flex items-center gap-2"><Film className="w-4 h-4 text-orange-400" /> Épisodes récents</h2>
              <button onClick={() => setActiveTab("episodes")} className="text-xs text-purple-400 hover:text-purple-300">Voir tous</button>
            </div>
            {series.episodes.length === 0 ? (
              <div className="text-center py-8 bg-[#13131a] border border-dashed border-[#2a2a3e] rounded-xl">
                <p className="text-gray-500 text-sm mb-3">Aucun épisode. Commencez à créer !</p>
                <Link href={`/series/${id}/episodes`} className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-all">
                  <Plus className="w-4 h-4" /> Créer un épisode
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {series.episodes.slice(0, 4).map(ep => (
                  <Link key={ep.id} href={`/episodes/${ep.id}/editor`} className="flex items-center gap-3 p-3 bg-[#13131a] border border-[#2a2a3e] rounded-xl hover:border-purple-500/30 transition-all group">
                    <div className="w-12 h-12 bg-[#1e1e2e] rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                      <Film className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white text-sm group-hover:text-purple-300 transition-colors truncate">{ep.title}</p>
                      <p className="text-xs text-gray-500">{new Date(ep.createdAt).toLocaleDateString("fr-FR")}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[ep.status] || STATUS_COLORS.draft}`}>{ep.status}</span>
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-purple-400 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Characters preview */}
          {series.characters.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-white flex items-center gap-2"><Users className="w-4 h-4 text-blue-400" /> Casting</h2>
                <Link href={`/series/${id}/characters`} className="text-xs text-purple-400 hover:text-purple-300">Gérer</Link>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {series.characters.map(char => (
                  <div key={char.id} className="flex-shrink-0 w-24 text-center">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-purple-600 to-blue-600 mx-auto mb-1 flex items-center justify-center text-white font-bold text-xl border-2 border-[#2a2a3e]">
                      {char.referenceImageUrl ? (
                        <img src={char.referenceImageUrl} alt={char.name} className="w-full h-full object-cover" />
                      ) : char.name[0]}
                    </div>
                    <p className="text-xs font-semibold text-white truncate">{char.name}</p>
                    {char.voiceProfile && <p className="text-xs text-orange-400 truncate">🎙</p>}
                  </div>
                ))}
                <Link href={`/series/${id}/characters`} className="flex-shrink-0 w-16 h-16 rounded-full bg-[#1e1e2e] border-2 border-dashed border-[#2a2a3e] hover:border-purple-500 flex items-center justify-center transition-all mt-0 self-start">
                  <Plus className="w-5 h-5 text-gray-500" />
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Episodes Tab */}
      {activeTab === "episodes" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white text-lg">Tous les épisodes</h2>
            <Link href={`/series/${id}/episodes`} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-all">
              <Plus className="w-4 h-4" /> Nouvel épisode
            </Link>
          </div>
          {series.episodes.length === 0 ? (
            <div className="text-center py-16 bg-[#13131a] border border-dashed border-[#2a2a3e] rounded-2xl">
              <Film className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">Aucun épisode pour l&apos;instant</p>
              <Link href={`/series/${id}/episodes`} className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all">
                <Plus className="w-4 h-4" /> Créer le premier épisode
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {series.episodes.map(ep => (
                <div key={ep.id} className="bg-[#13131a] border border-[#2a2a3e] rounded-xl overflow-hidden hover:border-purple-500/30 transition-all group">
                  <div className="flex items-center gap-4 p-4">
                    {/* Thumbnail */}
                    <div className="w-20 h-14 bg-[#1e1e2e] rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border border-[#2a2a3e]">
                      <Film className="w-6 h-6 text-gray-600" />
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white group-hover:text-purple-300 transition-colors truncate">{ep.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{new Date(ep.createdAt).toLocaleDateString("fr-FR")} · {ep.format}</p>
                    </div>
                    {/* Status + Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[ep.status] || STATUS_COLORS.draft}`}>{ep.status}</span>
                      <Link href={`/episodes/${ep.id}/editor`} className="flex items-center gap-1 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-600/30 text-purple-300 text-xs rounded-lg transition-all">
                        <Zap className="w-3 h-3" /> Ouvrir
                      </Link>
                      <Link href={`/episodes/${ep.id}/import`} className="p-1.5 bg-orange-600/20 hover:bg-orange-600/40 border border-orange-600/30 text-orange-300 rounded-lg transition-all" title="Importer scénario JSON">
                        <FileJson className="w-3.5 h-3.5" />
                      </Link>
                      <button onClick={() => setDeleteEpId(ep.id)} className="p-1.5 bg-red-600/0 hover:bg-red-600/20 text-gray-600 hover:text-red-400 rounded-lg transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {/* Sub-navigation for episode */}
                  <div className="flex gap-1 px-4 pb-3">
                    {[
                      { label: "Éditeur", href: `/episodes/${ep.id}/editor`, icon: Settings2 },
                      { label: "Storyboard", href: `/episodes/${ep.id}/storyboard`, icon: Image },
                      { label: "Audio", href: `/episodes/${ep.id}/audio`, icon: Volume2 },
                      { label: "Vidéo", href: `/episodes/${ep.id}/video`, icon: Video },
                    ].map(({ label, href, icon: Icon }) => (
                      <Link key={label} href={href} className="flex items-center gap-1 px-2 py-1 bg-[#1e1e2e] hover:bg-[#2a2a3e] border border-[#2a2a3e] text-gray-400 hover:text-white text-xs rounded-lg transition-all">
                        <Icon className="w-3 h-3" /> {label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Characters Tab */}
      {activeTab === "characters" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white text-lg">Personnages ({series.characters.length})</h2>
            <Link href={`/series/${id}/characters`} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-all">
              <Settings2 className="w-4 h-4" /> Gérer les personnages
            </Link>
          </div>
          {series.characters.length === 0 ? (
            <div className="text-center py-16 bg-[#13131a] border border-dashed border-[#2a2a3e] rounded-2xl">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">Aucun personnage. Créez votre casting !</p>
              <Link href={`/series/${id}/characters`} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all">
                <Plus className="w-4 h-4" /> Ajouter des personnages
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {series.characters.map(char => (
                <div key={char.id} className="bg-[#13131a] border border-[#2a2a3e] rounded-xl overflow-hidden">
                  <div className="aspect-square bg-[#1e1e2e] flex items-center justify-center overflow-hidden">
                    {char.referenceImageUrl ? (
                      <img src={char.referenceImageUrl} alt={char.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                        {char.name[0]}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-bold text-white text-sm">{char.name}</p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{char.outfit}</p>
                    {char.voiceProfile && <p className="text-xs text-orange-400 mt-1 truncate">🎙 {char.voiceProfile}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Environments Tab */}
      {activeTab === "environments" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white text-lg">Décors ({series.environments.length})</h2>
            <Link href={`/series/${id}/environments`} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-all">
              <Settings2 className="w-4 h-4" /> Gérer les décors
            </Link>
          </div>
          {series.environments.length === 0 ? (
            <div className="text-center py-16 bg-[#13131a] border border-dashed border-[#2a2a3e] rounded-2xl">
              <MapPin className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">Aucun décor. Créez vos lieux de tournage !</p>
              <Link href={`/series/${id}/environments`} className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-all">
                <Plus className="w-4 h-4" /> Ajouter des décors
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {series.environments.map(env => (
                <div key={env.id} className="bg-[#13131a] border border-[#2a2a3e] rounded-xl overflow-hidden">
                  <div className="aspect-video bg-[#1e1e2e] flex items-center justify-center overflow-hidden">
                    {env.previewImageUrl ? (
                      <img src={env.previewImageUrl} alt={env.name} className="w-full h-full object-cover" />
                    ) : (
                      <MapPin className="w-10 h-10 text-gray-600" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-bold text-white">{env.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{env.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
