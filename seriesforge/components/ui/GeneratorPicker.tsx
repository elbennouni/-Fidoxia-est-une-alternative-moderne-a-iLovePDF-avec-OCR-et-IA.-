"use client";

import { useState } from "react";
import { Check, Star, Zap, ChevronDown, ExternalLink, ImageIcon, Video } from "lucide-react";
import { IMAGE_GENERATORS, VIDEO_GENERATORS, type ImageGenerator, type VideoGenerator } from "@/lib/generators";

const QUALITY_COLORS = {
  low: "text-gray-400",
  medium: "text-blue-400",
  high: "text-green-400",
  ultra: "text-purple-400",
};

const SPEED_ICONS = {
  instant: "⚡⚡⚡",
  fast: "⚡⚡",
  medium: "⚡",
  slow: "🐢",
};

const BADGE_COLORS: Record<string, string> = {
  "Recommandé": "bg-purple-600/20 border-purple-600/40 text-purple-300",
  "Gratuit": "bg-green-600/20 border-green-600/40 text-green-300",
  "img2img": "bg-blue-600/20 border-blue-600/40 text-blue-300",
  "Ultra": "bg-yellow-600/20 border-yellow-600/40 text-yellow-300",
  "Pixar 3D": "bg-pink-600/20 border-pink-600/40 text-pink-300",
  "Nouveau": "bg-orange-600/20 border-orange-600/40 text-orange-300",
  "Cinéma": "bg-indigo-600/20 border-indigo-600/40 text-indigo-300",
  "3D": "bg-cyan-600/20 border-cyan-600/40 text-cyan-300",
  "Économique": "bg-teal-600/20 border-teal-600/40 text-teal-300",
  "Pas cher": "bg-lime-600/20 border-lime-600/40 text-lime-300",
};

interface ImageGeneratorPickerProps {
  selected: string;
  onSelect: (id: string) => void;
  onSetDefault: (id: string) => void;
  defaultId: string;
  compact?: boolean;
}

export function ImageGeneratorPicker({ selected, onSelect, onSetDefault, defaultId, compact = false }: ImageGeneratorPickerProps) {
  const [open, setOpen] = useState(false);
  const current = IMAGE_GENERATORS.find(g => g.id === selected) || IMAGE_GENERATORS[0];

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#1e1e2e] border border-[#2a2a3e] hover:border-purple-500/50 rounded-xl text-sm transition-all"
        >
          <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-white font-medium">{current.name}</span>
          <span className="text-yellow-400/70 font-mono text-xs">~${current.pricePerImage.toFixed(3)}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="absolute top-full mt-1 left-0 z-50 w-[480px] max-h-[70vh] overflow-y-auto bg-[#13131a] border border-[#2a2a3e] rounded-xl shadow-2xl scrollbar-thin">
            <div className="p-2">
              {IMAGE_GENERATORS.map(gen => (
                <GeneratorCard
                  key={gen.id}
                  gen={gen}
                  selected={selected === gen.id}
                  isDefault={defaultId === gen.id}
                  onSelect={() => { onSelect(gen.id); setOpen(false); }}
                  onSetDefault={() => { onSetDefault(gen.id); }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-purple-400" /> Générateur d'images
        </h3>
        <span className="text-xs text-gray-500">Cliquez pour changer • ⭐ = défaut</span>
      </div>
      <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto scrollbar-thin pr-1">
        {IMAGE_GENERATORS.map(gen => (
          <GeneratorCard
            key={gen.id}
            gen={gen}
            selected={selected === gen.id}
            isDefault={defaultId === gen.id}
            onSelect={() => onSelect(gen.id)}
            onSetDefault={() => onSetDefault(gen.id)}
          />
        ))}
      </div>
    </div>
  );
}

function GeneratorCard({
  gen, selected, isDefault, onSelect, onSetDefault
}: {
  gen: ImageGenerator;
  selected: boolean;
  isDefault: boolean;
  onSelect: () => void;
  onSetDefault: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
        selected
          ? "border-purple-500/60 bg-purple-600/10"
          : "border-[#2a2a3e] hover:border-purple-500/30 bg-[#1e1e2e] hover:bg-[#252535]"
      }`}
    >
      <div className="flex-shrink-0">
        {selected ? (
          <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full border-2 border-[#3a3a4e]" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-white text-sm">{gen.name}</span>
          <span className="text-xs text-gray-500">{gen.provider}</span>
          {gen.badge && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full border ${BADGE_COLORS[gen.badge] || "bg-gray-600/20 border-gray-600/40 text-gray-300"}`}>
              {gen.badge}
            </span>
          )}
          {gen.free && !gen.badge && (
            <span className="text-xs px-1.5 py-0.5 rounded-full border bg-green-600/20 border-green-600/40 text-green-300">Gratuit</span>
          )}
          {isDefault && <span className="text-yellow-400 text-xs flex items-center gap-0.5"><Star className="w-3 h-3 fill-current" /> défaut</span>}
        </div>
        <p className="text-xs text-gray-400 mt-0.5 truncate">{gen.description}</p>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className={`text-xs font-medium ${QUALITY_COLORS[gen.quality]}`}>Qualité {gen.quality}</span>
          <span className="text-xs text-gray-500">{SPEED_ICONS[gen.speed]} {gen.speed}</span>
          {gen.supportsImgToImg && <span className="text-xs text-blue-400">📎 img2img</span>}
          {gen.supportsReference && <span className="text-xs text-teal-400">🎭 référence</span>}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-yellow-400 font-mono font-bold text-sm">~${gen.pricePerImage.toFixed(3)}</span>
        <button
          onClick={e => { e.stopPropagation(); onSetDefault(); }}
          className={`text-xs px-2 py-0.5 rounded-lg transition-all ${
            isDefault
              ? "bg-yellow-600/20 border border-yellow-600/30 text-yellow-400"
              : "bg-[#2a2a3e] border border-[#3a3a4e] text-gray-500 hover:text-yellow-400 hover:border-yellow-600/30"
          }`}
        >
          {isDefault ? "⭐ Défaut" : "Mettre défaut"}
        </button>
      </div>
    </div>
  );
}

interface VideoGeneratorPickerProps {
  selected: string;
  onSelect: (id: string) => void;
  onSetDefault: (id: string) => void;
  defaultId: string;
  duration?: 5 | 10;
}

export function VideoGeneratorPicker({ selected, onSelect, onSetDefault, defaultId, duration = 5 }: VideoGeneratorPickerProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <Video className="w-4 h-4 text-green-400" /> Générateur de vidéos
        </h3>
        <div className="flex gap-2 text-xs text-gray-500">
          <span>Prix pour {duration}s</span>
          <span>⭐ = défaut</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto scrollbar-thin pr-1">
        {VIDEO_GENERATORS.map(gen => (
          <VideoGeneratorCard
            key={gen.id}
            gen={gen}
            selected={selected === gen.id}
            isDefault={defaultId === gen.id}
            onSelect={() => onSelect(gen.id)}
            onSetDefault={() => onSetDefault(gen.id)}
            duration={duration}
          />
        ))}
      </div>
    </div>
  );
}

function VideoGeneratorCard({
  gen, selected, isDefault, onSelect, onSetDefault, duration
}: {
  gen: VideoGenerator;
  selected: boolean;
  isDefault: boolean;
  onSelect: () => void;
  onSetDefault: () => void;
  duration: number;
}) {
  const price = duration <= 5 ? gen.pricePer5s : gen.pricePer10s;

  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
        selected
          ? "border-green-500/60 bg-green-600/10"
          : "border-[#2a2a3e] hover:border-green-500/30 bg-[#1e1e2e] hover:bg-[#252535]"
      }`}
    >
      <div className="flex-shrink-0">
        {selected ? (
          <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full border-2 border-[#3a3a4e]" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-white text-sm">{gen.name}</span>
          <span className="text-xs text-gray-500">{gen.provider}</span>
          {gen.badge && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full border ${BADGE_COLORS[gen.badge] || "bg-gray-600/20 border-gray-600/40 text-gray-300"}`}>
              {gen.badge}
            </span>
          )}
          {isDefault && <span className="text-yellow-400 text-xs flex items-center gap-0.5"><Star className="w-3 h-3 fill-current" /> défaut</span>}
        </div>
        <p className="text-xs text-gray-400 mt-0.5 truncate">{gen.description}</p>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className={`text-xs font-medium ${QUALITY_COLORS[gen.quality]}`}>Qualité {gen.quality}</span>
          <span className="text-xs text-gray-500">max {gen.maxDuration}s</span>
          {gen.supportsImgToVideo && <span className="text-xs text-teal-400">🖼→🎬 img2video</span>}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-yellow-400 font-mono font-bold text-sm">~${price.toFixed(2)}</span>
        <div className="flex gap-1">
          <a href={gen.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="p-1 bg-[#2a2a3e] rounded hover:bg-[#3a3a4e] transition-all">
            <ExternalLink className="w-3 h-3 text-gray-400" />
          </a>
          <button
            onClick={e => { e.stopPropagation(); onSetDefault(); }}
            className={`text-xs px-2 py-0.5 rounded-lg transition-all ${
              isDefault
                ? "bg-yellow-600/20 border border-yellow-600/30 text-yellow-400"
                : "bg-[#2a2a3e] border border-[#3a3a4e] text-gray-500 hover:text-yellow-400 hover:border-yellow-600/30"
            }`}
          >
            {isDefault ? "⭐" : "Défaut"}
          </button>
        </div>
      </div>
    </div>
  );
}
