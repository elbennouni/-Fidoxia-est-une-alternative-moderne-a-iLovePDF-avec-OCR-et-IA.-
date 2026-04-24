"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowLeft, Volume2, Loader2, Copy, Music, Mic, Play, Sparkles,
  ExternalLink, CheckCircle, X, Settings, Square, Upload, Trash2, SlidersHorizontal, RotateCcw,
  Pencil, Save
} from "lucide-react";
import { CostBadge } from "@/components/ui/CostBadge";
import { COSTS } from "@/lib/costs";

interface HeyGenVoice {
  voice_id: string;
  name: string;
  language: string;
  gender: string;
  preview_audio?: string;
}

interface Character {
  id: string;
  name: string;
  voiceProfile?: string;
  heygenVoiceId?: string;
  referenceImageUrl?: string;
}

interface Scene {
  id: string;
  sceneNumber: number;
  timecode?: string;
  location?: string;
  charactersJson?: string;
  narration?: string;
  dialogue?: string;
  soundDesign?: string;
  audioPrompt?: string;
  voiceProvider?: string;
  voiceUrl?: string;
  action?: string;
}

interface Episode {
  id: string;
  title: string;
  bgMusicUrl?: string | null;
  bgMusicName?: string | null;
  bgMusicVolume?: number;
  series: {
    id: string;
    title: string;
    characters: Character[];
  };
  scenes: Scene[];
}

export default function AudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [voices, setVoices] = useState<HeyGenVoice[]>([]);
  const [voicesSource, setVoicesSource] = useState<"heygen" | "mock">("mock");
  const [voicesNote, setVoicesNote] = useState("");
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [generatingVoice, setGeneratingVoice] = useState<string | null>(null);
  const [showVoicePicker, setShowVoicePicker] = useState<{ charId: string; charName: string; isNarrator?: boolean } | null>(null);
  const [voiceFilter, setVoiceFilter] = useState("fr");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [narratorVoiceId, setNarratorVoiceId] = useState<string>("");
  const [narratorVoiceName, setNarratorVoiceName] = useState<string>("");
  // Background music state
  const [bgMusicUrl, setBgMusicUrl] = useState<string | null>(null);
  const [bgMusicName, setBgMusicName] = useState<string | null>(null);
  const [bgMusicVolume, setBgMusicVolume] = useState<number>(0.2);
  const [uploadingMusic, setUploadingMusic] = useState(false);
  const [savingVolume, setSavingVolume] = useState(false);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);
  const [playingBg, setPlayingBg] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [editingField, setEditingField] = useState<{ sceneId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => { fetchData(); fetchVoices(); fetchElevenLabsVoices(); }, [id]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/episodes/${id}`);
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      setEpisode(data);
      setCharacters(data.series?.characters || []);
      if (data.bgMusicUrl) setBgMusicUrl(data.bgMusicUrl);
      if (data.bgMusicName) setBgMusicName(data.bgMusicName);
      if (data.bgMusicVolume !== undefined) setBgMusicVolume(data.bgMusicVolume);
    } finally { setLoading(false); }
  }

  async function fetchVoices() {
    setLoadingVoices(true);
    try {
      const res = await fetch("/api/heygen/voices");
      const data = await res.json();
      setVoices(data.voices || []);
      setVoicesSource(data.source || "mock");
      if (data.note) setVoicesNote(data.note);
    } finally { setLoadingVoices(false); }
  }

  async function fetchElevenLabsVoices() {
    try {
      const res = await fetch("/api/elevenlabs/voices");
      const data = await res.json();
      if (data.voices?.length > 0) {
        setVoices(prev => {
          const elVoices = data.voices.map((v: HeyGenVoice) => ({ ...v, provider: "elevenlabs" }));
          // Put ElevenLabs at top if we have API key
          return data.source === "elevenlabs" ? [...elVoices, ...prev] : [...prev, ...elVoices];
        });
      }
    } catch {}
  }

  async function assignVoiceToCharacter(charId: string, voice: HeyGenVoice) {
    // If assigning to narrator
    if (showVoicePicker?.isNarrator) {
      setNarratorVoiceId(voice.voice_id);
      setNarratorVoiceName(voice.name);
      toast.success(`Voix narrateur "${voice.name}" assignée !`);
      setShowVoicePicker(null);
      return;
    }
    try {
      await fetch(`/api/characters/${charId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceProfile: voice.name, heygenVoiceId: voice.voice_id }),
      });
      toast.success(`Voix "${voice.name}" assignée !`);
      setShowVoicePicker(null);
      fetchData();
    } catch { toast.error("Erreur assignation"); }
  }

  async function handleMusicUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMusic(true);
    const t = toast.loading(`Upload "${file.name}"...`);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("volume", String(bgMusicVolume));
      const res = await fetch(`/api/episodes/${id}/bg-music`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBgMusicUrl(data.bgMusicUrl);
      setBgMusicName(data.bgMusicName);
      toast.dismiss(t);
      toast.success(`Musique "${file.name}" ajoutée !`);
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Upload échoué");
    } finally {
      setUploadingMusic(false);
      if (musicInputRef.current) musicInputRef.current.value = "";
    }
  }

  async function handleVolumeChange(newVolume: number) {
    setBgMusicVolume(newVolume);
    // Update bg audio volume in real-time
    if (bgAudioRef.current) bgAudioRef.current.volume = newVolume;
  }

  async function saveVolume() {
    setSavingVolume(true);
    try {
      await fetch(`/api/episodes/${id}/bg-music`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volume: bgMusicVolume }),
      });
      toast.success("Volume sauvegardé !");
    } finally { setSavingVolume(false); }
  }

  async function removeMusic() {
    await fetch(`/api/episodes/${id}/bg-music`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remove: true }),
    });
    setBgMusicUrl(null);
    setBgMusicName(null);
    setPlayingBg(false);
    if (bgAudioRef.current) { bgAudioRef.current.pause(); bgAudioRef.current = null; }
    toast.success("Musique supprimée");
  }

  function toggleBgMusic() {
    if (!bgMusicUrl) return;
    if (playingBg && bgAudioRef.current) {
      bgAudioRef.current.pause();
      setPlayingBg(false);
    } else {
      const audio = new Audio(bgMusicUrl);
      audio.volume = bgMusicVolume;
      audio.loop = true;
      audio.play();
      bgAudioRef.current = audio;
      setPlayingBg(true);
      audio.onended = () => setPlayingBg(false);
    }
  }

  function startEdit(sceneId: string, field: string, currentValue: string) {
    setEditingField({ sceneId, field });
    setEditValue(currentValue);
  }

  async function saveEdit() {
    if (!editingField) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/scenes/${editingField.sceneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [editingField.field]: editValue }),
      });
      if (!res.ok) throw new Error("Erreur sauvegarde");
      toast.success("Texte sauvegardé ! L'audio a été réinitialisé.");
      setEditingField(null);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSavingEdit(false);
    }
  }

  function cancelEdit() {
    setEditingField(null);
    setEditValue("");
  }

  async function deleteSceneVoice(sceneId: string) {
    try {
      await fetch(`/api/scenes/${sceneId}/voice`, { method: "DELETE" });
      toast.success("Audio supprimé");
      fetchData();
    } catch {
      toast.error("Erreur suppression");
    }
  }

  async function generateNarratorVoice(scene: Scene, text: string) {
    if (!narratorVoiceId) {
      toast.error("Assignez d'abord une voix au Narrateur (section ci-dessus)");
      return;
    }
    setGeneratingVoice(`${scene.id}-Narrateur`);
    const t = toast.loading(`Génération voix narrateur (Scène ${scene.sceneNumber})...`);
    try {
      const res = await fetch("/api/heygen/generate-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId: scene.id, text, voiceId: narratorVoiceId, characterName: "Narrateur" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.dismiss(t);
      if (data.mock) {
        toast("Mode démo — ajoutez HEYGEN_API_KEY pour les vraies voix", { icon: "ℹ️" });
      } else {
        toast.success("Voix narrateur générée !");
        fetchData();
      }
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally { setGeneratingVoice(null); }
  }

  // Get character voice ID from current state (refreshed after assignment)
  function getCharVoiceId(charName: string): string | null {
    const char = characters.find(c =>
      c.name.toLowerCase() === charName.toLowerCase() ||
      charName.toLowerCase().includes(c.name.toLowerCase())
    );
    return char?.heygenVoiceId || null;
  }

  async function generateVoiceForScene(scene: Scene, text: string, characterName: string) {
    const voiceId = getCharVoiceId(characterName);
    if (!voiceId) {
      toast.error(`Assignez d'abord une voix HeyGen à ${characterName} (section Casting ci-dessus)`, { duration: 5000 });
      return;
    }
    setGeneratingVoice(`${scene.id}-${characterName}`);
    const t = toast.loading(`Génération voix de ${characterName}...`);
    try {
      // Route to correct API based on voice prefix
      const endpoint = voiceId.startsWith("el-") ? "/api/elevenlabs/generate-voice" : "/api/heygen/generate-voice";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId: scene.id, text, voiceId, characterName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.dismiss(t);
      if (data.mock) {
        toast("Mode démo — ajoutez HEYGEN_API_KEY pour les vraies voix", { icon: "ℹ️" });
      } else {
        toast.success(`Voix de ${characterName} générée !`);
        fetchData();
      }
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally { setGeneratingVoice(null); }
  }

  // Generate all dialogues of a scene as a single combined audio
  async function generateFullSceneAudio(scene: Scene) {
    // Combine: narration + all dialogue lines
    const parts: string[] = [];
    if (scene.narration?.trim()) parts.push(scene.narration.trim());
    if (scene.dialogue?.trim()) parts.push(scene.dialogue.trim());
    const fullText = parts.join("\n\n");
    if (!fullText) { toast.error("Pas de texte dans cette scène"); return; }

    // Use narrator voice for full scene, or first character voice
    const voiceId = narratorVoiceId || getCharVoiceId(
      (JSON.parse(scene.charactersJson || "[]") as string[])[0] || ""
    );
    if (!voiceId) {
      toast.error("Assignez une voix au Narrateur ou à un personnage d'abord", { duration: 5000 });
      return;
    }
    setGeneratingVoice(`${scene.id}-full`);
    const t = toast.loading(`Génération audio complet scène ${scene.sceneNumber}...`);
    try {
      const ep2 = voiceId.startsWith("el-") ? "/api/elevenlabs/generate-voice" : "/api/heygen/generate-voice";
      const res = await fetch(ep2, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId: scene.id, text: fullText, voiceId, characterName: "Scène complète" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.dismiss(t);
      if (data.mock) toast("Mode démo", { icon: "ℹ️" });
      else { toast.success(`Audio scène ${scene.sceneNumber} généré !`); fetchData(); }
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally { setGeneratingVoice(null); }
  }

  function copy(text: string) { navigator.clipboard.writeText(text); toast.success("Copié !"); }

  function playAudio(url: string, id: string) {
    if (playingAudio === id) {
      audioRef.current?.pause();
      setPlayingAudio(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play();
    setPlayingAudio(id);
    audio.onended = () => setPlayingAudio(null);
    audio.onerror = () => { setPlayingAudio(null); toast.error("Lecture impossible"); };
  }

  function PlayButton({ url, id, size = "sm" }: { url: string; id: string; size?: "sm" | "md" }) {
    const isPlaying = playingAudio === id;
    const sizeClass = size === "md" ? "px-3 py-2 text-sm gap-2" : "px-2 py-1.5 text-xs gap-1";
    return (
      <button
        onClick={() => playAudio(url, id)}
        className={`flex items-center ${sizeClass} bg-green-600/20 hover:bg-green-600/40 border border-green-600/30 text-green-300 rounded-lg transition-all flex-shrink-0`}
      >
        {isPlaying ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
        {isPlaying ? "Stop" : "Écouter"}
      </button>
    );
  }

  function parseDialogueLines(dialogue: string): Array<{ character: string; line: string }> {
    const lines = dialogue.split("\n").filter(l => l.trim());
    return lines.map(line => {
      const match = line.match(/^([^:]+):\s*(.+)$/);
      if (match) return { character: match[1].trim(), line: match[2].trim() };
      return { character: "Narrateur", line: line.trim() };
    });
  }

  const filteredVoices = voices.filter(v =>
    voiceFilter === "all" || v.language === voiceFilter || v.gender === voiceFilter
  );

  // Inline editable text field component
  function EditableField({
    sceneId, field, value, label, color = "blue", multiline = true
  }: {
    sceneId: string; field: string; value: string; label: string;
    color?: "blue" | "purple"; multiline?: boolean;
  }) {
    const isEditing = editingField?.sceneId === sceneId && editingField?.field === field;
    const colorStyles = {
      blue: "bg-blue-900/10 border-blue-600/30 text-blue-200",
      purple: "bg-purple-900/10 border-purple-600/30 text-purple-200",
    };

    return (
      <div className="group">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium flex items-center gap-1">
            <Mic className="w-3 h-3" /> {label}
          </p>
          {!isEditing && (
            <button
              onClick={() => startEdit(sceneId, field, value)}
              className="flex items-center gap-1 px-2 py-0.5 text-xs text-gray-500 hover:text-white bg-[#1e1e2e] hover:bg-purple-600/20 border border-[#2a2a3e] hover:border-purple-500/40 rounded-lg transition-all opacity-0 group-hover:opacity-100"
            >
              <Pencil className="w-3 h-3" /> Modifier
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2">
            {multiline ? (
              <textarea
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                rows={Math.max(3, editValue.split("\n").length + 1)}
                className={`w-full px-3 py-2 rounded-xl border text-sm leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-purple-500 ${colorStyles[color]} bg-opacity-80`}
                autoFocus
              />
            ) : (
              <input
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 ${colorStyles[color]}`}
                autoFocus
              />
            )}
            <div className="flex gap-2">
              <button
                onClick={saveEdit}
                disabled={savingEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-all"
              >
                {savingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Sauvegarder
              </button>
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e1e2e] border border-[#2a2a3e] text-gray-400 hover:text-white text-xs rounded-lg transition-all"
              >
                <X className="w-3 h-3" /> Annuler
              </button>
              <span className="text-xs text-gray-600 self-center ml-1">⚠ L'audio sera réinitialisé</span>
            </div>
          </div>
        ) : (
          <div
            className={`rounded-xl p-3 border cursor-pointer hover:opacity-90 transition-opacity ${colorStyles[color]}`}
            onClick={() => startEdit(sceneId, field, value)}
            title="Cliquer pour modifier"
          >
            {field === "narration" ? (
              <p className="text-sm leading-relaxed italic">&ldquo;{value}&rdquo;</p>
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-line">{value}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>;
  if (!episode) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href={`/episodes/${id}/editor`} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" /> Retour à l'éditeur
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Volume2 className="w-7 h-7 text-orange-400" /> Audio & Voix HeyGen
            </h1>
            <p className="text-gray-400 mt-1">{episode.title}</p>
          </div>
          {episode.scenes.some(s => s.voiceUrl) && (
            <button
              onClick={async () => {
                if (!confirm("Supprimer tous les audios générés pour regénérer ?")) return;
                for (const scene of episode.scenes) {
                  if (scene.voiceUrl) await fetch(`/api/scenes/${scene.id}/voice`, { method: "DELETE" });
                }
                toast.success("Tous les audios supprimés — vous pouvez maintenant les regénérer");
                fetchData();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[#1e1e2e] hover:bg-red-600/20 border border-[#2a2a3e] hover:border-red-600/30 text-gray-400 hover:text-red-400 text-sm rounded-xl transition-all"
            >
              <RotateCcw className="w-4 h-4" /> Tout réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* HeyGen Connection Status */}
      <div className={`mb-6 p-4 rounded-xl border flex items-start gap-3 ${voicesSource === "heygen" ? "bg-green-900/20 border-green-600/30" : "bg-orange-900/20 border-orange-600/30"}`}>
        <div className={`p-1.5 rounded-full mt-0.5 ${voicesSource === "heygen" ? "bg-green-600" : "bg-orange-600"}`}>
          {voicesSource === "heygen" ? <CheckCircle className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4 text-white" />}
        </div>
        <div className="flex-1">
          <p className={`font-semibold text-sm ${voicesSource === "heygen" ? "text-green-300" : "text-orange-300"}`}>
            {voicesSource === "heygen" ? "✅ HeyGen connecté — voix réelles disponibles" : "⚠ Mode démo — voix simulées"}
          </p>
          {voicesNote && <p className="text-xs text-gray-400 mt-0.5">{voicesNote}</p>}
          {voicesSource !== "heygen" && (
            <Link href="/settings" className="inline-flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 mt-1 transition-colors">
              <Settings className="w-3 h-3" /> Ajouter HEYGEN_API_KEY dans Paramètres
            </Link>
          )}
        </div>
        <a href="https://app.heygen.com/settings?nav=API" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors whitespace-nowrap">
          HeyGen <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Voice Picker Modal */}
      {showVoicePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#13131a] border border-[#2a2a3e] rounded-2xl w-full max-w-2xl p-6 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Mic className="w-5 h-5 text-orange-400" /> Voix pour {showVoicePicker.charName}
              </h2>
              <button onClick={() => setShowVoicePicker(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {[
                { id: "fr", label: "🇫🇷 Français (priorité)" },
                { id: "all", label: "Toutes les langues" },
                { id: "en", label: "🇬🇧 English" },
                { id: "male", label: "♂ Homme" },
                { id: "female", label: "♀ Femme" },
              ].map(f => (
                <button key={f.id} onClick={() => setVoiceFilter(f.id)} className={`px-3 py-1.5 rounded-lg text-sm transition-all ${voiceFilter === f.id ? "bg-orange-600 text-white" : "bg-[#1e1e2e] border border-[#2a2a3e] text-gray-400 hover:text-white"}`}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Voice list */}
            <div className="overflow-y-auto flex-1 space-y-2 scrollbar-thin pr-1">
              {loadingVoices ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-orange-400" /></div>
              ) : filteredVoices.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Aucune voix trouvée</p>
              ) : filteredVoices.map(voice => (
                <div key={voice.voice_id} className={`flex items-center gap-3 p-3 border rounded-xl transition-all ${playingAudio === `voice-${voice.voice_id}` ? "border-green-500/50 bg-green-900/10" : "bg-[#1e1e2e] border-[#2a2a3e] hover:border-orange-500/50"}`}>
                  <div className="flex-1">
                    <p className="font-medium text-white text-sm">{voice.name}</p>
                    <div className="flex gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{voice.language === "fr" ? "🇫🇷" : voice.language === "en" ? "🇬🇧" : "🌐"} {voice.language}</span>
                      <span className="text-xs text-gray-500">·</span>
                      <span className="text-xs text-gray-400">{voice.gender === "male" ? "♂" : "♀"} {voice.gender}</span>
                    </div>
                  </div>
                  {voice.preview_audio ? (
                    <PlayButton url={voice.preview_audio} id={`voice-${voice.voice_id}`} />
                  ) : (
                    <span className="text-xs text-gray-600 px-2">Pas de preview</span>
                  )}
                  <button
                    onClick={() => assignVoiceToCharacter(showVoicePicker!.charId, voice)}
                    className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium rounded-lg transition-all flex-shrink-0"
                  >
                    Assigner
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Background Music */}
      <input ref={musicInputRef} type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac" className="hidden" onChange={handleMusicUpload} />

      <div className="mb-6 bg-[#13131a] border border-[#2a2a3e] rounded-xl p-5">
        <h2 className="font-bold text-white mb-4 flex items-center gap-2">
          <Music className="w-5 h-5 text-purple-400" /> Musique de fond
        </h2>

        {bgMusicUrl ? (
          <div className="space-y-4">
            {/* Music info + controls */}
            <div className="flex items-center gap-3 p-3 bg-purple-900/10 border border-purple-600/30 rounded-xl">
              <div className="p-2 bg-purple-600/20 rounded-lg flex-shrink-0">
                <Music className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{bgMusicName}</p>
                <p className="text-xs text-gray-400">Volume: {Math.round(bgMusicVolume * 100)}%</p>
              </div>
              <button
                onClick={toggleBgMusic}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${playingBg ? "bg-red-600/20 border border-red-600/30 text-red-300" : "bg-green-600/20 border border-green-600/30 text-green-300"}`}
              >
                {playingBg ? <><Square className="w-3 h-3 fill-current" /> Stop</> : <><Play className="w-3 h-3 fill-current" /> Écouter</>}
              </button>
              <button onClick={removeMusic} className="p-1.5 bg-red-600/0 hover:bg-red-600/20 text-gray-500 hover:text-red-400 rounded-lg transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Volume Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-300 flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-purple-400" />
                  Volume musique de fond
                  <span className="text-xs text-gray-500">(garde les voix audibles)</span>
                </label>
                <span className="text-sm font-mono text-purple-300">{Math.round(bgMusicVolume * 100)}%</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">0%</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={bgMusicVolume}
                  onChange={e => handleVolumeChange(parseFloat(e.target.value))}
                  className="flex-1 h-2 appearance-none bg-[#2a2a3e] rounded-full cursor-pointer accent-purple-500"
                />
                <span className="text-xs text-gray-500">100%</span>
              </div>
              {/* Visual guide */}
              <div className="flex gap-2 text-xs">
                {[
                  { label: "Recommandé", range: "15-30%", active: bgMusicVolume >= 0.15 && bgMusicVolume <= 0.30 },
                  { label: "Discret", range: "5-15%", active: bgMusicVolume < 0.15 },
                  { label: "Fort", range: "30%+", active: bgMusicVolume > 0.30 },
                ].map(({ label, range, active }) => (
                  <span key={label} className={`px-2 py-0.5 rounded-full border ${active ? "bg-purple-600/20 border-purple-600/30 text-purple-300" : "bg-[#1e1e2e] border-[#2a2a3e] text-gray-500"}`}>
                    {label} ({range})
                  </span>
                ))}
              </div>
              <button
                onClick={saveVolume}
                disabled={savingVolume}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-600/30 text-purple-300 text-sm rounded-xl transition-all disabled:opacity-50"
              >
                {savingVolume ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                Sauvegarder le volume
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 border border-dashed border-[#2a2a3e] rounded-xl">
            <Music className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm mb-1">Ajoutez une musique de fond à votre épisode</p>
            <p className="text-gray-500 text-xs mb-4">MP3, WAV, OGG, M4A — le volume sera ajusté pour ne pas étouffer les voix</p>
            <button
              onClick={() => musicInputRef.current?.click()}
              disabled={uploadingMusic}
              className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-xl transition-all mx-auto"
            >
              {uploadingMusic ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploadingMusic ? "Upload..." : "Uploader une musique"}
            </button>
          </div>
        )}

        {/* Quick replace button if music exists */}
        {bgMusicUrl && (
          <button
            onClick={() => musicInputRef.current?.click()}
            disabled={uploadingMusic}
            className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-[#1e1e2e] hover:bg-[#2a2a3e] border border-[#2a2a3e] text-gray-400 hover:text-white text-xs rounded-lg transition-all disabled:opacity-50"
          >
            {uploadingMusic ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Remplacer la musique
          </button>
        )}
      </div>

      {/* Characters Voice Assignment */}
      <div className="mb-6 bg-[#13131a] border border-[#2a2a3e] rounded-xl p-5">
        <h2 className="font-bold text-white mb-4 flex items-center gap-2">
          <Mic className="w-5 h-5 text-orange-400" /> Voix des personnages
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {/* Narrator — special character */}
            <div className={`p-3 rounded-xl border text-center transition-all ${narratorVoiceId ? "border-blue-600/40 bg-blue-900/10" : "border-dashed border-[#2a2a3e] bg-[#1e1e2e]"}`}>
              <div className="w-12 h-12 rounded-full mx-auto mb-2 border-2 border-blue-500/40 flex items-center justify-center bg-gradient-to-br from-blue-700 to-purple-700">
                <Mic className="w-6 h-6 text-white" />
              </div>
              <p className="font-semibold text-white text-sm mb-1">🎙 Narrateur</p>
              {narratorVoiceId ? (
                <p className="text-xs text-blue-400 mb-2 line-clamp-1">✅ {narratorVoiceName}</p>
              ) : (
                <p className="text-xs text-gray-500 mb-2">Voix off à assigner</p>
              )}
              <button
                onClick={() => setShowVoicePicker({ charId: "narrator", charName: "Narrateur", isNarrator: true })}
                className="w-full py-1.5 text-xs bg-blue-600/20 hover:bg-blue-600/40 border border-blue-600/30 text-blue-300 rounded-lg transition-all"
              >
                {narratorVoiceId ? "Changer" : "Assigner voix FR"}
              </button>
            </div>

            {characters.length === 0 ? (
              <div className="col-span-3 flex items-center justify-center text-gray-500 text-sm py-4">
                Ajoutez des personnages à la série d'abord
              </div>
            ) : characters.map(char => (
              <div key={char.id} className={`p-3 rounded-xl border text-center transition-all ${char.heygenVoiceId ? "border-green-600/40 bg-green-900/10" : "border-[#2a2a3e] bg-[#1e1e2e]"}`}>
                <div className="w-12 h-12 rounded-full overflow-hidden mx-auto mb-2 border-2 border-[#2a2a3e] flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-600">
                  {char.referenceImageUrl ? (
                    <img src={char.referenceImageUrl} alt={char.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white font-bold text-lg">{char.name[0]}</span>
                  )}
                </div>
                <p className="font-semibold text-white text-sm mb-1">{char.name}</p>
                {char.heygenVoiceId ? (
                  <p className="text-xs text-green-400 mb-2 line-clamp-1">✅ {char.voiceProfile}</p>
                ) : (
                  <p className="text-xs text-gray-500 mb-2">Pas de voix</p>
                )}
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => setShowVoicePicker({ charId: char.id, charName: char.name })}
                    className="w-full py-1.5 text-xs bg-orange-600/20 hover:bg-orange-600/40 border border-orange-600/30 text-orange-300 rounded-lg transition-all"
                  >
                    {char.heygenVoiceId ? "Changer voix" : "Assigner voix"}
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Scenes Audio */}
      {episode.scenes.length > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 p-3 bg-blue-900/10 border border-blue-600/20 rounded-xl">
          <div>
            <p className="text-sm text-blue-200 font-medium">🇫🇷 Dialogues en anglais ?</p>
            <p className="text-xs text-gray-400">Traduis tous les textes en français avant de générer les voix</p>
          </div>
          <button
            onClick={async () => {
              const t = toast.loading("🇫🇷 Traduction en cours...");
              try {
                const res = await fetch(`/api/episodes/${id}/translate-to-french`, { method: "POST" });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                toast.dismiss(t);
                toast.success(`✅ ${data.translated} scènes traduites ! Vous pouvez maintenant générer les voix.`, { duration: 6000 });
                fetchData();
              } catch (err) {
                toast.dismiss(t);
                toast.error(err instanceof Error ? err.message : "Erreur traduction");
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-all whitespace-nowrap"
          >
            🇫🇷 Traduire en français
          </button>
        </div>
      )}

      {episode.scenes.length === 0 ? (
        <div className="text-center py-16 bg-[#13131a] border border-dashed border-[#2a2a3e] rounded-2xl">
          <Volume2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Générez d'abord le pipeline de l'épisode</p>
          <Link href={`/episodes/${id}/editor`} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all">
            Aller à l'éditeur
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {episode.scenes.map(scene => {
            const dialogueLines = scene.dialogue ? parseDialogueLines(scene.dialogue) : [];
            return (
              <div key={scene.id} className="bg-[#13131a] border border-[#2a2a3e] rounded-xl overflow-hidden">
                {/* Scene header */}
                <div className="flex items-center gap-3 p-4 border-b border-[#2a2a3e]">
                  <div className="w-8 h-8 bg-orange-600/20 border border-orange-600/30 rounded-full flex items-center justify-center text-orange-300 font-bold text-sm flex-shrink-0">
                    {scene.sceneNumber}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">{scene.location || `Scène ${scene.sceneNumber}`}</p>
                    {scene.timecode && <p className="text-xs text-gray-500">{scene.timecode}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {scene.voiceUrl ? (
                      <span className="text-xs px-2 py-0.5 bg-green-600/20 border border-green-600/30 rounded-full text-green-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Audio ✅
                      </span>
                    ) : (
                      <button
                        onClick={() => generateFullSceneAudio(scene)}
                        disabled={generatingVoice === `${scene.id}-full`}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-all"
                        title="Génère un seul audio avec narration + tous les dialogues"
                      >
                        {generatingVoice === `${scene.id}-full` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        Générer tout l'audio
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {/* Narration */}
                  {scene.narration && (
                    <div>
                      <div className="bg-blue-900/10 border border-blue-600/30 rounded-xl p-3 flex items-start gap-3">
                        <div className="flex-1">
                          <EditableField
                            sceneId={scene.id}
                            field="narration"
                            value={scene.narration!}
                            label="Narration (Voix off)"
                            color="blue"
                          />
                          {scene.voiceUrl && (
                            <div className="mt-2 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <PlayButton url={scene.voiceUrl} id={`narration-${scene.id}`} />
                                <audio controls src={scene.voiceUrl} className="h-7 flex-1" />
                              </div>
                              <div className="flex gap-1.5">
                                <button onClick={() => deleteSceneVoice(scene.id)} className="flex items-center gap-1 px-2 py-0.5 bg-[#1e1e2e] hover:bg-orange-600/20 border border-[#2a2a3e] hover:border-orange-600/30 text-gray-500 hover:text-orange-300 text-xs rounded-lg transition-all">
                                  <RotateCcw className="w-2.5 h-2.5" /> Regénérer
                                </button>
                                <button onClick={() => deleteSceneVoice(scene.id)} className="flex items-center gap-1 px-2 py-0.5 bg-[#1e1e2e] hover:bg-red-600/20 border border-[#2a2a3e] hover:border-red-600/30 text-gray-500 hover:text-red-400 text-xs rounded-lg transition-all">
                                  <Trash2 className="w-2.5 h-2.5" /> Supprimer
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <button
                            onClick={() => generateNarratorVoice(scene, scene.narration!)}
                            disabled={!!generatingVoice || !narratorVoiceId}
                            title={!narratorVoiceId ? "Assignez d'abord une voix au Narrateur" : "Générer la voix narrateur"}
                            className="flex items-center gap-1 px-2 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 disabled:opacity-40 disabled:cursor-not-allowed border border-blue-600/30 text-blue-300 text-xs rounded-lg transition-all"
                          >
                            {generatingVoice === `${scene.id}-Narrateur` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            {narratorVoiceId ? "Générer" : "⚠ Assigner voix d'abord"}
                          </button>
                          {narratorVoiceName && <p className="text-xs text-blue-400/60">🎙 {narratorVoiceName.split("—")[0]}</p>}
                          <CostBadge cost={COSTS["heygen-tts"] * Math.max(1, Math.ceil((scene.narration?.length || 100) / 1000))} label="TTS" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Dialogue lines */}
                  {dialogueLines.length > 0 && (
                    <div>
                      <EditableField
                        sceneId={scene.id}
                        field="dialogue"
                        value={scene.dialogue!}
                        label="Dialogues"
                        color="purple"
                      />
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium flex items-center gap-1 mt-3 mb-2">
                        <Volume2 className="w-3 h-3" /> Générer par ligne
                      </p>
                      <div className="space-y-2">
                        {dialogueLines.map((line, idx) => {
                          const char = characters.find(c => c.name.toLowerCase() === line.character.toLowerCase());
                          const hasVoice = !!getCharVoiceId(line.character);
                          return (
                            <div key={idx} className={`rounded-xl p-3 border flex items-start gap-3 ${hasVoice ? "bg-purple-900/10 border-purple-600/30" : "bg-[#1e1e2e] border-[#2a2a3e]"}`}>
                              {char?.referenceImageUrl ? (
                                <img src={char.referenceImageUrl} alt={char.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-[#2a2a3e]" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                  {line.character[0]}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-semibold text-white text-xs">{line.character}</p>
                                  {char?.voiceProfile && (
                                    <span className="text-xs text-orange-400">🎙 {char.voiceProfile}</span>
                                  )}
                                  {!hasVoice && (
                                    <button
                                      onClick={() => char && setShowVoicePicker({ charId: char.id, charName: char.name })}
                                      className="text-xs text-gray-500 hover:text-orange-400 transition-colors"
                                    >
                                      (assigner voix)
                                    </button>
                                  )}
                                </div>
                                <p className="text-sm text-gray-200 leading-relaxed">{line.line}</p>
                              </div>
                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <button
                                  onClick={() => generateVoiceForScene(scene, line.line, line.character)}
                                  disabled={!!generatingVoice || !hasVoice}
                                  title={!hasVoice ? `Assignez d'abord une voix à ${line.character}` : "Générer la voix"}
                                  className="flex items-center gap-1 px-2 py-1.5 bg-orange-600/20 hover:bg-orange-600/40 disabled:opacity-40 disabled:cursor-not-allowed border border-orange-600/30 text-orange-300 text-xs rounded-lg transition-all"
                                >
                                  {generatingVoice === `${scene.id}-${line.character}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                  Voix
                                </button>
                                <CostBadge cost={COSTS["heygen-tts"] * Math.max(1, Math.ceil(line.line.length / 1000))} label="TTS" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sound Design */}
                  {scene.soundDesign && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                        <Music className="w-3 h-3" /> Ambiance sonore
                      </p>
                      <div className="bg-[#1e1e2e] border border-[#2a2a3e] rounded-xl p-3">
                        <p className="text-sm text-gray-300">🎵 {scene.soundDesign}</p>
                      </div>
                    </div>
                  )}

                  {/* Audio player if generated */}
                  {scene.voiceUrl && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                          <Play className="w-3 h-3" /> Audio généré
                        </p>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => {
                              // Regénérer = d'abord supprimer puis regénérer le dernier
                              deleteSceneVoice(scene.id);
                            }}
                            className="flex items-center gap-1 px-2 py-1 bg-[#1e1e2e] hover:bg-orange-600/20 border border-[#2a2a3e] hover:border-orange-600/30 text-gray-400 hover:text-orange-300 text-xs rounded-lg transition-all"
                            title="Supprimer cet audio pour en générer un nouveau"
                          >
                            <RotateCcw className="w-3 h-3" /> Regénérer
                          </button>
                          <button
                            onClick={() => deleteSceneVoice(scene.id)}
                            className="flex items-center gap-1 px-2 py-1 bg-[#1e1e2e] hover:bg-red-600/20 border border-[#2a2a3e] hover:border-red-600/30 text-gray-400 hover:text-red-400 text-xs rounded-lg transition-all"
                            title="Supprimer cet audio"
                          >
                            <Trash2 className="w-3 h-3" /> Supprimer
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-green-900/10 border border-green-600/20 rounded-xl">
                        <PlayButton url={scene.voiceUrl} id={`scene-audio-${scene.id}`} size="md" />
                        <audio controls src={scene.voiceUrl} className="flex-1 h-8" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
