"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowLeft, Upload, Sparkles, Loader2, CheckCircle, ChevronDown, ChevronUp,
  Palette, Copy, Image, Zap, FileJson, Info
} from "lucide-react";
import { CostBadge, CostSummary } from "@/components/ui/CostBadge";
import { COSTS } from "@/lib/costs";

interface ArtisticDirection {
  colorPalette: string;
  lightingStyle: string;
  cameraStyle: string;
  characterDesignStyle: string;
  backgroundStyle: string;
  overallMood: string;
  visualReferences: string;
  negativeElements: string;
}

interface Scene {
  id: string;
  sceneNumber: number;
  timecode?: string;
  location?: string;
  charactersJson?: string;
  action?: string;
  narration?: string;
  dialogue?: string;
  camera?: string;
  emotion?: string;
  soundDesign?: string;
  imagePrompt?: string;
  videoPrompt?: string;
}

interface ImportResult {
  success: boolean;
  episodeTitle: string;
  synopsis: string;
  sceneCount: number;
  artisticDirection: ArtisticDirection;
  scenes: Scene[];
}

const EXAMPLE_JSON = `{
  "episode": "La Grande Trahison",
  "scenes": [
    {
      "numero": 1,
      "lieu": "Plage de Konanta",
      "personnages": ["Hassan", "Sarah"],
      "action": "Hassan et Sarah construisent un abri de fortune avec des palmes",
      "dialogue": "Hassan: 'T'inquiète pas, j'ai déjà fait du camping en forêt.\\nSarah: 'En forêt de béton tu veux dire ?'",
      "narration": "Jour 3. Les alliances se forment... ou pas.",
      "ambiance": "Soleil de plomb, humour décalé"
    },
    {
      "numero": 2,
      "lieu": "Zone de défi - Corde au dessus de l'eau",
      "personnages": ["Roger", "Karim", "Abel"],
      "action": "Roger tente de traverser la corde mais glisse et tombe à l'eau",
      "dialogue": "Abel: 'Et ROGER est éliminé !\\nKarim (sarcastique): 'C'était écrit d'avance...'",
      "narration": "La gravité, ennemie jurée de Roger.",
      "ambiance": "Rires, eau qui éclabousse, musique épique qui déraille"
    }
  ]
}`;

export default function ImportScenarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [jsonText, setJsonText] = useState("");
  const [artisticDirective, setArtisticDirective] = useState("");
  const [importing, setImporting] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [expandedScene, setExpandedScene] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState("");
  const [showExample, setShowExample] = useState(false);

  function validateJson(text: string): boolean {
    try {
      JSON.parse(text);
      setJsonError("");
      return true;
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : "JSON invalide");
      return false;
    }
  }

  async function handleImport() {
    if (!jsonText.trim()) { toast.error("Colle ton scénario JSON"); return; }
    if (!validateJson(jsonText)) { toast.error("Le JSON est invalide — vérifie la syntaxe"); return; }

    setImporting(true);
    const t = toast.loading("🎬 Analyse du scénario + direction artistique (1-2 min)...", { duration: 180000 });
    try {
      const parsed = JSON.parse(jsonText);
      const res = await fetch(`/api/episodes/${id}/import-scenario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawScenario: parsed, artisticDirective }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.dismiss(t);
      toast.success(`✅ ${data.sceneCount} scènes importées avec direction artistique !`);
      setResult(data);
      if (data.scenes?.length > 0) setExpandedScene(data.scenes[0].id);
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Import échoué");
    } finally {
      setImporting(false);
    }
  }

  async function generateAllImages() {
    setGeneratingImages(true);
    const t = toast.loading(`🖼 Génération de toutes les images DALL-E... (peut prendre 3-5 min)`, { duration: 400000 });
    try {
      const res = await fetch(`/api/episodes/${id}/generate-all-images`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.dismiss(t);
      toast.success(`✅ ${data.generated}/${data.total} images générées !`);
      // Reload scenes
      const epRes = await fetch(`/api/episodes/${id}`);
      const epData = await epRes.json();
      setResult(prev => prev ? { ...prev, scenes: epData.scenes } : prev);
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Génération échouée");
    } finally {
      setGeneratingImages(false);
    }
  }

  function copyPrompt(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Prompt copié !");
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href={`/episodes/${id}/editor`} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" /> Retour à l'éditeur
        </Link>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <FileJson className="w-7 h-7 text-purple-400" /> Importer un Scénario
        </h1>
        <p className="text-gray-400 mt-1">Colle ton scénario JSON de ChatGPT — l'IA l'analyse, crée les scènes et génère la direction artistique</p>
      </div>

      {!result ? (
        <div className="space-y-5">
          {/* Info banner */}
          <div className="flex items-start gap-3 p-4 bg-blue-900/20 border border-blue-600/30 rounded-xl">
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-200">
              <p className="font-semibold mb-1">Formats acceptés</p>
              <p className="text-blue-300">N'importe quel JSON — peu importe la structure. L'IA comprend tous les formats : scènes, actes, dialogues, descriptions, numérotations différentes, etc.</p>
            </div>
          </div>

          {/* JSON Input */}
          <div className="bg-[#13131a] border border-[#2a2a3e] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="font-semibold text-white flex items-center gap-2">
                <FileJson className="w-4 h-4 text-purple-400" /> Scénario JSON
              </label>
              <button
                onClick={() => { setShowExample(!showExample); if (!showExample) setJsonText(EXAMPLE_JSON); }}
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                {showExample ? "Masquer" : "Voir un exemple"}
              </button>
            </div>
            <textarea
              value={jsonText}
              onChange={e => { setJsonText(e.target.value); if (e.target.value) validateJson(e.target.value); }}
              placeholder={`Colle ici ton JSON ChatGPT...\n\n{\n  "episode": "...",\n  "scenes": [...]\n}`}
              rows={14}
              className={`w-full px-4 py-3 bg-[#1e1e2e] border rounded-xl text-sm text-gray-200 placeholder-gray-600 focus:outline-none font-mono resize-none transition-colors ${
                jsonError ? "border-red-500" : "border-[#2a2a3e] focus:border-purple-500"
              }`}
            />
            {jsonError && (
              <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                ⚠ {jsonError}
              </p>
            )}
            {jsonText && !jsonError && (
              <p className="text-xs text-green-400 mt-2">✅ JSON valide</p>
            )}
          </div>

          {/* Artistic Directive */}
          <div className="bg-[#13131a] border border-[#2a2a3e] rounded-xl p-5">
            <label className="font-semibold text-white flex items-center gap-2 mb-3">
              <Palette className="w-4 h-4 text-orange-400" /> Direction Artistique (optionnel)
            </label>
            <p className="text-sm text-gray-400 mb-3">Donne tes instructions artistiques spécifiques — couleurs, ambiance, style, références visuelles souhaitées</p>
            <textarea
              value={artisticDirective}
              onChange={e => setArtisticDirective(e.target.value)}
              placeholder="Ex: 'Je veux une palette chaude tropicale style Pixar Finding Nemo, avec des couleurs très saturées. Les scènes de compétition doivent être dynamiques avec des plans larges. Ambiance réalité TV fun et explosive. Pas de tons sombres.'"
              rows={4}
              className="w-full px-4 py-3 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>

          <div className="space-y-2">
            <button
              onClick={handleImport}
              disabled={importing || !jsonText.trim() || !!jsonError}
              className="w-full flex items-center justify-center gap-3 py-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl transition-all glow-purple"
            >
              {importing ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Analyse en cours...</>
              ) : (
                <><Sparkles className="w-5 h-5" /> Analyser + Créer Direction Artistique</>
              )}
            </button>
            <div className="flex justify-center">
              <CostSummary items={[
                { label: "Analyse scénario", cost: COSTS["gpt4o-import"] },
                { label: "Direction artistique", cost: COSTS["gpt4o-artistic"] },
                { label: "Prompts (~8 scènes)", cost: COSTS["gpt4o-qc"], qty: 8 },
              ]} />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Success header */}
          <div className="bg-green-900/20 border border-green-600/30 rounded-xl p-5 flex items-start gap-4">
            <CheckCircle className="w-8 h-8 text-green-400 flex-shrink-0" />
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white">{result.episodeTitle}</h2>
              <p className="text-gray-300 text-sm mt-1">{result.synopsis}</p>
              <p className="text-green-400 text-sm mt-2">{result.sceneCount} scènes · prompts images et vidéos générés</p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={generateAllImages}
                  disabled={generatingImages}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-all"
                >
                  {generatingImages ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
                  {generatingImages ? "Génération..." : "Générer toutes les images"}
                </button>
                <CostBadge cost={COSTS["dalle3-standard-portrait"] * (result?.sceneCount || 8)} label={`${result?.sceneCount || 8} imgs`} />
              </div>
              <Link
                href={`/episodes/${id}/editor`}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-[#1e1e2e] border border-[#2a2a3e] hover:border-purple-500/50 text-gray-300 text-sm rounded-xl transition-all"
              >
                <Zap className="w-4 h-4" /> Voir dans l'éditeur
              </Link>
            </div>
          </div>

          {/* Artistic Direction Card */}
          <div className="bg-[#13131a] border border-orange-600/30 rounded-xl p-5">
            <h3 className="font-bold text-white flex items-center gap-2 mb-4">
              <Palette className="w-5 h-5 text-orange-400" /> Direction Artistique générée
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: "🎨 Palette de couleurs", value: result.artisticDirection.colorPalette },
                { label: "💡 Style d'éclairage", value: result.artisticDirection.lightingStyle },
                { label: "🎥 Style de caméra", value: result.artisticDirection.cameraStyle },
                { label: "👤 Design des personnages", value: result.artisticDirection.characterDesignStyle },
                { label: "🌄 Style des décors", value: result.artisticDirection.backgroundStyle },
                { label: "✨ Ambiance générale", value: result.artisticDirection.overallMood },
                { label: "🎬 Références visuelles", value: result.artisticDirection.visualReferences },
                { label: "🚫 À éviter absolument", value: result.artisticDirection.negativeElements },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[#1e1e2e] rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">{label}</p>
                  <p className="text-sm text-gray-200">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Scenes */}
          <div>
            <h3 className="font-bold text-white text-xl mb-4">{result.scenes.length} Scènes analysées</h3>
            <div className="space-y-3">
              {result.scenes.map(scene => {
                const isExpanded = expandedScene === scene.id;
                const characters = JSON.parse(scene.charactersJson || "[]") as string[];
                return (
                  <div key={scene.id} className={`bg-[#13131a] border rounded-xl overflow-hidden ${isExpanded ? "border-purple-500/40" : "border-[#2a2a3e]"}`}>
                    <button
                      onClick={() => setExpandedScene(isExpanded ? null : scene.id)}
                      className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/2 transition-all"
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-600/20 border border-purple-600/40 flex items-center justify-center text-purple-300 font-bold text-sm flex-shrink-0">
                        {scene.sceneNumber}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {scene.location && <span className="text-white font-medium text-sm">📍 {scene.location}</span>}
                          {scene.timecode && <span className="text-xs text-gray-500">{scene.timecode}</span>}
                        </div>
                        {scene.action && <p className="text-xs text-gray-400 mt-0.5 truncate">{scene.action}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {scene.imagePrompt && <span className="text-xs text-purple-400">🎨 Prompt prêt</span>}
                        {(scene as Scene & { imageUrl?: string }).imageUrl && <span className="text-xs text-green-400">🖼 Image</span>}
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-[#2a2a3e] p-4 space-y-4">
                        {/* Characters */}
                        {characters.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {characters.map(c => (
                              <span key={c} className="text-xs px-2 py-0.5 bg-blue-600/20 border border-blue-600/30 rounded-full text-blue-300">{c}</span>
                            ))}
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Image */}
                          <div>
                            {(scene as Scene & { imageUrl?: string }).imageUrl ? (
                              <img
                                src={(scene as Scene & { imageUrl?: string }).imageUrl}
                                alt={`Scène ${scene.sceneNumber}`}
                                className="w-full rounded-xl border border-[#2a2a3e]"
                              />
                            ) : (
                              <div className="aspect-video bg-[#1e1e2e] border border-dashed border-[#2a2a3e] rounded-xl flex items-center justify-center">
                                <div className="text-center p-4">
                                  <Image className="w-6 h-6 text-gray-600 mx-auto mb-1" />
                                  <p className="text-xs text-gray-500">Clique "Générer toutes les images"</p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Script */}
                          <div className="space-y-2">
                            {scene.action && (
                              <div>
                                <p className="text-xs text-gray-500 uppercase mb-1">Action</p>
                                <p className="text-sm text-gray-300 bg-[#1e1e2e] rounded-lg p-2">{scene.action}</p>
                              </div>
                            )}
                            {scene.emotion && (
                              <div>
                                <p className="text-xs text-gray-500 uppercase mb-1">Émotion</p>
                                <p className="text-sm text-yellow-200 bg-yellow-900/10 border border-yellow-600/20 rounded-lg p-2">{scene.emotion}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Narration + Dialogue */}
                        {(scene.narration || scene.dialogue) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {scene.narration && (
                              <div>
                                <p className="text-xs text-gray-500 uppercase mb-1">Narration</p>
                                <div className="bg-blue-900/10 border border-blue-600/30 rounded-xl p-3">
                                  <p className="text-sm text-blue-200 italic leading-relaxed">&ldquo;{scene.narration}&rdquo;</p>
                                </div>
                              </div>
                            )}
                            {scene.dialogue && (
                              <div>
                                <p className="text-xs text-gray-500 uppercase mb-1">Dialogue</p>
                                <div className="bg-purple-900/10 border border-purple-600/30 rounded-xl p-3">
                                  <p className="text-sm text-purple-200 whitespace-pre-line leading-relaxed">{scene.dialogue}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Prompts */}
                        {scene.imagePrompt && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs text-gray-500 uppercase">Prompt Image (Direction Artistique incluse)</p>
                              <button onClick={() => copyPrompt(scene.imagePrompt!)} className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300">
                                <Copy className="w-3 h-3" /> Copier
                              </button>
                            </div>
                            <div className="bg-purple-900/10 border border-purple-600/20 rounded-xl p-3">
                              <p className="text-xs text-gray-300 font-mono leading-relaxed">{scene.imagePrompt}</p>
                            </div>
                          </div>
                        )}

                        {scene.videoPrompt && (
                          <details>
                            <summary className="cursor-pointer text-xs text-gray-500 uppercase tracking-wide py-1 hover:text-gray-300 list-none flex items-center justify-between">
                              Prompt Vidéo complet
                              <button onClick={() => copyPrompt(scene.videoPrompt!)} className="flex items-center gap-1 text-purple-400 hover:text-purple-300">
                                <Copy className="w-3 h-3" /> Copier
                              </button>
                            </summary>
                            <div className="mt-2 bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl p-3">
                              <p className="text-xs text-gray-400 whitespace-pre-wrap leading-relaxed">{scene.videoPrompt}</p>
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom actions */}
          <div className="flex gap-3 pt-4 border-t border-[#2a2a3e]">
            <button
              onClick={() => setResult(null)}
              className="px-5 py-3 border border-[#2a2a3e] text-gray-400 hover:border-gray-400 rounded-xl transition-all"
            >
              ← Importer un autre scénario
            </button>
            <Link
              href={`/episodes/${id}/editor`}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all"
            >
              <Zap className="w-5 h-5" /> Ouvrir dans l'éditeur complet
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
