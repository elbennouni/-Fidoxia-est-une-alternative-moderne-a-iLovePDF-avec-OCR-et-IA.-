"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Palette, Check, ChevronRight, Sparkles, Copy } from "lucide-react";
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

export default function StylesPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>("Tous");
  const [selectedStyle, setSelectedStyle] = useState<VisualStylePreset | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const allCategories = ["Tous", ...STYLE_CATEGORIES];

  const filtered = VISUAL_STYLE_PRESETS.filter(s => {
    const matchCat = selectedCategory === "Tous" || s.category === selectedCategory;
    const matchSearch = !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    return matchCat && matchSearch;
  });

  function copyPrompt(style: VisualStylePreset) {
    navigator.clipboard.writeText(style.promptKeywords);
    toast.success("Prompt copié !");
  }

  function applyToSeries(style: VisualStylePreset) {
    // Store selected style in localStorage for series creation
    localStorage.setItem("sf_selected_style", JSON.stringify(style));
    toast.success(`Style "${style.name}" sélectionné ! Créez une série pour l'appliquer.`);
    router.push("/series");
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Palette className="w-7 h-7 text-purple-400" /> Styles Visuels
        </h1>
        <p className="text-gray-400 mt-1">Choisissez le style artistique de votre série — de Pixar à Miyazaki, Nolan, Cyberpunk et plus</p>
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Rechercher un style... (Pixar, Nolan, Ghibli, Cyberpunk...)"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(style => (
          <div
            key={style.id}
            onClick={() => setSelectedStyle(selectedStyle?.id === style.id ? null : style)}
            className={`bg-[#13131a] border rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.01] ${
              selectedStyle?.id === style.id
                ? "border-purple-500/60 bg-purple-600/5 ring-1 ring-purple-500/30"
                : "border-[#2a2a3e] hover:border-purple-500/30"
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-2xl">{style.emoji}</span>
              <div className="flex items-center gap-1.5">
                {style.badge && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full border ${BADGE_COLORS[style.badge] || "bg-gray-600/20 border-gray-500/40 text-gray-300"}`}>
                    {style.badge}
                  </span>
                )}
                {selectedStyle?.id === style.id && (
                  <div className="w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
            </div>

            <h3 className="font-bold text-white mb-1">{style.name}</h3>
            <span className="text-xs text-gray-500 mb-2 block">{style.category}</span>
            <p className="text-xs text-gray-400 leading-relaxed mb-3 line-clamp-3">{style.description}</p>

            <div className="flex flex-wrap gap-1 mb-3">
              <span className="text-xs px-2 py-0.5 bg-[#1e1e2e] border border-[#2a2a3e] rounded-full text-gray-400">
                🎨 {style.colorPalette}
              </span>
              {style.reference && (
                <span className="text-xs px-2 py-0.5 bg-[#1e1e2e] border border-[#2a2a3e] rounded-full text-gray-500 truncate max-w-[120px]">
                  🎬 {style.reference}
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={e => { e.stopPropagation(); copyPrompt(style); }}
                className="flex items-center gap-1 px-2 py-1.5 bg-[#1e1e2e] hover:bg-[#2a2a3e] border border-[#2a2a3e] text-gray-400 hover:text-white text-xs rounded-lg transition-all"
              >
                <Copy className="w-3 h-3" /> Prompt
              </button>
              <button
                onClick={e => { e.stopPropagation(); applyToSeries(style); }}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-600/30 text-purple-300 text-xs rounded-lg transition-all"
              >
                <Sparkles className="w-3 h-3" /> Utiliser
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Panel */}
      {selectedStyle && (
        <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-96 bg-[#0a0a0f] border-l border-[#2a2a3e] shadow-2xl overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedStyle.emoji}</span>
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedStyle.name}</h2>
                  <p className="text-xs text-gray-500">{selectedStyle.category}</p>
                </div>
              </div>
              <button onClick={() => setSelectedStyle(null)} className="text-gray-400 hover:text-white p-2">✕</button>
            </div>

            <p className="text-gray-300 text-sm mb-5 leading-relaxed">{selectedStyle.description}</p>

            <div className="space-y-4 mb-6">
              <div className="bg-[#13131a] border border-[#2a2a3e] rounded-xl p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Palette de couleurs</p>
                <p className="text-sm text-gray-200">🎨 {selectedStyle.colorPalette}</p>
              </div>

              {selectedStyle.reference && (
                <div className="bg-[#13131a] border border-[#2a2a3e] rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Références</p>
                  <p className="text-sm text-gray-200">🎬 {selectedStyle.reference}</p>
                </div>
              )}

              <div className="bg-[#13131a] border border-purple-600/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Prompt keywords</p>
                  <button onClick={() => copyPrompt(selectedStyle)} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                    <Copy className="w-3 h-3" /> Copier
                  </button>
                </div>
                <p className="text-xs text-purple-200 font-mono leading-relaxed">{selectedStyle.promptKeywords}</p>
              </div>

              <div className="bg-[#13131a] border border-red-600/20 rounded-xl p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Prompt négatif</p>
                <p className="text-xs text-red-300 font-mono leading-relaxed">{selectedStyle.negativePrompt}</p>
              </div>
            </div>

            <button
              onClick={() => applyToSeries(selectedStyle)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all"
            >
              <Sparkles className="w-5 h-5" /> Utiliser ce style pour une série
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16 bg-[#13131a] border border-dashed border-[#2a2a3e] rounded-2xl">
          <Palette className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Aucun style trouvé pour "{searchQuery}"</p>
        </div>
      )}
    </div>
  );
}
