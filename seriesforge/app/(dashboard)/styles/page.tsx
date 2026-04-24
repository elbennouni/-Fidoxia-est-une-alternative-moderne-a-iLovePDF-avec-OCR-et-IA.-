"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Palette, Check, ChevronRight, Sparkles, Copy, Loader2, Image, Play } from "lucide-react";
import { VISUAL_STYLE_PRESETS, STYLE_CATEGORIES, type VisualStylePreset } from "@/lib/visualStyles";

const BADGE_COLORS: Record<string, string> = {
  "Populaire": "bg-purple-600/20 border-purple-500/40 text-purple-300",
  "Tendance": "bg-pink-600/20 border-pink-500/40 text-pink-300",
  "Poétique": "bg-blue-600/20 border-blue-500/40 text-blue-300",
  "Signature": "bg-orange-600/20 border-orange-500/40 text-orange-300",
  "Magique": "bg-yellow-600/20 border-yellow-500/40 text-yellow-300",
  "Épique": "bg-red-600/20 border-red-500/40 text-red-300",
  "Action": "bg-green-600/20 border-green-500/40 text-green-300",
};

const CATEGORY_ICONS: Record<string, string> = {
  "Animation 3D": "🎬",
  "Animation 2D": "🖍️",
  "Cinéma": "🎥",
  "Manga / Anime": "⚔️",
  "Art": "🎨",
  "Réaliste": "📸",
  "Fantastique": "🐉",
  "Rétro": "🕹️",
};

// Gradient backgrounds as placeholders before preview is generated
const STYLE_GRADIENTS: Record<string, string> = {
  "pixar-3d": "from-orange-500 via-yellow-400 to-blue-500",
  "pixar-realtv": "from-cyan-500 via-yellow-400 to-orange-500",
  "dreamworks-3d": "from-emerald-500 via-teal-400 to-blue-600",
  "claymation": "from-amber-400 via-orange-300 to-pink-400",
  "disney-3d": "from-purple-500 via-pink-400 to-yellow-400",
  "cartoon-2d": "from-red-500 via-yellow-400 to-blue-500",
  "south-park": "from-blue-400 via-cyan-300 to-white",
  "anime-modern": "from-indigo-600 via-purple-500 to-pink-500",
  "miyazaki": "from-green-400 via-emerald-300 to-sky-400",
  "manga-bw": "from-gray-800 via-gray-400 to-gray-100",
  "chibi": "from-pink-400 via-rose-300 to-purple-400",
  "nolan-cinematic": "from-blue-900 via-slate-700 to-gray-900",
  "wes-anderson": "from-pink-300 via-amber-200 to-red-300",
  "cinematic-realistic": "from-amber-600 via-orange-500 to-gray-800",
  "noir-film": "from-gray-900 via-gray-700 to-gray-400",
  "watercolor": "from-blue-200 via-purple-200 to-pink-200",
  "comic-marvel": "from-red-600 via-yellow-400 to-blue-600",
  "oil-painting": "from-amber-800 via-amber-600 to-orange-400",
  "hyperrealistic": "from-gray-500 via-gray-400 to-gray-300",
  "vintage-photo": "from-amber-700 via-yellow-600 to-amber-400",
  "dark-fantasy": "from-purple-900 via-indigo-800 to-gray-900",
  "cyberpunk": "from-purple-600 via-pink-500 to-blue-600",
  "fairy-tale": "from-yellow-300 via-purple-400 to-blue-400",
  "retro-80s": "from-purple-600 via-pink-500 to-orange-400",
  "pixel-art": "from-green-600 via-teal-500 to-blue-600",
};

export default function StylesPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>("Tous");
  const [selectedStyle, setSelectedStyle] = useState<VisualStylePreset | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [generatingPreview, setGeneratingPreview] = useState<string | null>(null);

  const allCategories = ["Tous", ...STYLE_CATEGORIES];

  const filtered = VISUAL_STYLE_PRESETS.filter(s => {
    const matchCat = selectedCategory === "Tous" || s.category === selectedCategory;
    const matchSearch = !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    return matchCat && matchSearch;
  });

  // Load cached previews from localStorage
  useEffect(() => {
    const cached: Record<string, string> = {};
    VISUAL_STYLE_PRESETS.forEach(s => {
      const url = localStorage.getItem(`style-preview-${s.id}`);
      if (url) cached[s.id] = url;
    });
    if (Object.keys(cached).length > 0) setPreviews(cached);
  }, []);

  async function generatePreview(style: VisualStylePreset) {
    if (previews[style.id] || generatingPreview) return;
    setGeneratingPreview(style.id);
    try {
      const res = await fetch("/api/styles/generate-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleId: style.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreviews(p => ({ ...p, [style.id]: data.imageUrl }));
      localStorage.setItem(`style-preview-${style.id}`, data.imageUrl);
      if (!data.cached) toast.success(`Aperçu "${style.name}" généré !`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur génération aperçu");
    } finally {
      setGeneratingPreview(null);
    }
  }

  async function generateAllPreviews() {
    const stylesToGenerate = filtered.filter(s => !previews[s.id]);
    if (stylesToGenerate.length === 0) { toast("Tous les aperçus sont déjà générés !", { icon: "✅" }); return; }
    toast.loading(`Génération de ${stylesToGenerate.length} aperçus...`, { id: "batch", duration: 120000 });
    for (const style of stylesToGenerate.slice(0, 8)) { // max 8 at a time
      await generatePreview(style);
    }
    toast.dismiss("batch");
    toast.success("Aperçus générés !");
  }

  function copyPrompt(style: VisualStylePreset) {
    navigator.clipboard.writeText(style.promptKeywords);
    toast.success("Prompt copié !");
  }

  function applyToSeries(style: VisualStylePreset) {
    localStorage.setItem("sf_selected_style", JSON.stringify(style));
    toast.success(`Style "${style.name}" sélectionné !`);
    router.push("/series");
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Palette className="w-7 h-7 text-purple-400" /> Styles Visuels
          </h1>
          <p className="text-gray-400 mt-1">Choisissez le style de votre série — aperçu généré par IA</p>
        </div>
        <button
          onClick={generateAllPreviews}
          disabled={!!generatingPreview}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-600/30 text-purple-300 text-sm font-medium rounded-xl transition-all disabled:opacity-50"
        >
          {generatingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Générer tous les aperçus
        </button>
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Rechercher... (Pixar, Nolan, Ghibli, Cyberpunk, Fantasy...)"
          className="w-full px-4 py-3 bg-[#13131a] border border-[#2a2a3e] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
        />
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {allCategories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
              selectedCategory === cat
                ? "bg-purple-600 text-white"
                : "bg-[#13131a] border border-[#2a2a3e] text-gray-400 hover:text-white hover:border-purple-500/30"
            }`}
          >
            {cat !== "Tous" && CATEGORY_ICONS[cat]}
            {cat}
            <span className="text-xs opacity-60">
              ({cat === "Tous" ? VISUAL_STYLE_PRESETS.length : VISUAL_STYLE_PRESETS.filter(s => s.category === cat).length})
            </span>
          </button>
        ))}
      </div>

      {/* Style Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filtered.map(style => {
          const previewUrl = previews[style.id];
          const isGenerating = generatingPreview === style.id;
          const gradient = STYLE_GRADIENTS[style.id] || "from-purple-600 to-blue-600";
          const isSelected = selectedStyle?.id === style.id;

          return (
            <div
              key={style.id}
              onClick={() => setSelectedStyle(isSelected ? null : style)}
              className={`bg-[#13131a] border rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02] group ${
                isSelected
                  ? "border-purple-500/60 ring-2 ring-purple-500/30"
                  : "border-[#2a2a3e] hover:border-purple-500/40"
              }`}
            >
              {/* Thumbnail */}
              <div className="relative aspect-[9/16] overflow-hidden">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={style.name}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                    <div className="text-center">
                      <div className="text-4xl mb-2">{style.emoji}</div>
                      <button
                        onClick={e => { e.stopPropagation(); generatePreview(style); }}
                        disabled={isGenerating || !!generatingPreview}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white text-xs rounded-lg transition-all mx-auto disabled:opacity-50"
                      >
                        {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Image className="w-3 h-3" />}
                        {isGenerating ? "..." : "Aperçu"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Overlay with selected check */}
                {isSelected && (
                  <div className="absolute inset-0 bg-purple-600/20 flex items-center justify-center">
                    <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center shadow-lg">
                      <Check className="w-5 h-5 text-white" />
                    </div>
                  </div>
                )}

                {/* Badge */}
                {style.badge && (
                  <div className="absolute top-2 left-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full border backdrop-blur-sm ${BADGE_COLORS[style.badge] || "bg-gray-600/60 border-gray-500/40 text-gray-300"}`}>
                      {style.badge}
                    </span>
                  </div>
                )}

                {/* Regenerate button on hover if has preview */}
                {previewUrl && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      // Clear cache and regenerate
                      localStorage.removeItem(`style-preview-${style.id}`);
                      setPreviews(p => { const n = { ...p }; delete n[style.id]; return n; });
                    }}
                    className="absolute top-2 right-2 p-1 bg-black/40 hover:bg-black/70 text-white/60 hover:text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    title="Regénérer l'aperçu"
                  >
                    <Loader2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <div className="flex items-center justify-between mb-0.5">
                  <h3 className="font-bold text-white text-sm">{style.emoji} {style.name}</h3>
                </div>
                <p className="text-xs text-gray-500 mb-2 line-clamp-2">{style.description}</p>
                <div className="flex gap-1.5">
                  <button
                    onClick={e => { e.stopPropagation(); copyPrompt(style); }}
                    className="flex items-center gap-1 px-2 py-1 bg-[#1e1e2e] hover:bg-[#2a2a3e] border border-[#2a2a3e] text-gray-400 hover:text-white text-xs rounded-lg transition-all"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); applyToSeries(style); }}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-600/30 text-purple-300 text-xs rounded-lg transition-all"
                  >
                    <Sparkles className="w-3 h-3" /> Utiliser
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Side Panel */}
      {selectedStyle && (
        <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[360px] bg-[#0a0a0f] border-l border-[#2a2a3e] shadow-2xl overflow-y-auto scrollbar-thin">
          <div className="p-5">
            {/* Preview image */}
            {previews[selectedStyle.id] ? (
              <div className="aspect-[9/16] rounded-xl overflow-hidden mb-4 border border-[#2a2a3e]">
                <img src={previews[selectedStyle.id]} alt={selectedStyle.name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className={`aspect-[9/16] rounded-xl overflow-hidden mb-4 bg-gradient-to-br ${STYLE_GRADIENTS[selectedStyle.id] || "from-purple-600 to-blue-600"} flex items-center justify-center`}>
                <div className="text-center">
                  <div className="text-5xl mb-3">{selectedStyle.emoji}</div>
                  <button
                    onClick={() => generatePreview(selectedStyle)}
                    disabled={!!generatingPreview}
                    className="flex items-center gap-2 px-4 py-2 bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white text-sm rounded-xl transition-all mx-auto disabled:opacity-50"
                  >
                    {generatingPreview === selectedStyle.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {generatingPreview === selectedStyle.id ? "Génération..." : "Générer l'aperçu"}
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedStyle.emoji} {selectedStyle.name}</h2>
                <p className="text-xs text-gray-500">{selectedStyle.category}</p>
              </div>
              <button onClick={() => setSelectedStyle(null)} className="text-gray-400 hover:text-white p-1.5 bg-[#1e1e2e] rounded-lg">✕</button>
            </div>

            <p className="text-gray-300 text-sm mb-4 leading-relaxed">{selectedStyle.description}</p>

            <div className="space-y-3 mb-5">
              <div className="bg-[#13131a] border border-[#2a2a3e] rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">🎨 Palette</p>
                <p className="text-sm text-gray-200">{selectedStyle.colorPalette}</p>
              </div>
              {selectedStyle.reference && (
                <div className="bg-[#13131a] border border-[#2a2a3e] rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">🎬 Références</p>
                  <p className="text-sm text-gray-200">{selectedStyle.reference}</p>
                </div>
              )}
              <div className="bg-[#13131a] border border-purple-600/20 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-500">Prompt keywords</p>
                  <button onClick={() => copyPrompt(selectedStyle)} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                    <Copy className="w-3 h-3" /> Copier
                  </button>
                </div>
                <p className="text-xs text-purple-200 font-mono leading-relaxed line-clamp-4">{selectedStyle.promptKeywords}</p>
              </div>
            </div>

            <button
              onClick={() => applyToSeries(selectedStyle)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all"
            >
              <Sparkles className="w-5 h-5" /> Utiliser pour une série
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Palette className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Aucun style trouvé pour "{searchQuery}"</p>
        </div>
      )}
    </div>
  );
}
