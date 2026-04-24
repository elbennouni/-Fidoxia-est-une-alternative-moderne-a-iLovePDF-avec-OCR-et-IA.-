"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowLeft, Volume2, Loader2, Copy, Music, Mic, Play, Pause, Sparkles,
  ExternalLink, CheckCircle, X, Settings, Square
} from "lucide-react";

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
}

interface Episode {
  id: string;
  title: string;
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
  const [showVoicePicker, setShowVoicePicker] = useState<{ charId: string; charName: string } | null>(null);
  const [voiceFilter, setVoiceFilter] = useState("all");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { fetchData(); fetchVoices(); }, [id]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/episodes/${id}`);
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      setEpisode(data);
      setCharacters(data.series?.characters || []);
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

  async function assignVoiceToCharacter(charId: string, voice: HeyGenVoice) {
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

  async function generateVoiceForScene(scene: Scene, text: string, characterName: string) {
    const char = characters.find(c => c.name === characterName);
    if (!char?.heygenVoiceId) {
      toast.error(`Assignez d'abord une voix HeyGen à ${characterName}`);
      return;
    }
    setGeneratingVoice(`${scene.id}-${characterName}`);
    const t = toast.loading(`Génération voix de ${characterName} (Scène ${scene.sceneNumber})...`);
    try {
      const res = await fetch("/api/heygen/generate-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId: scene.id, text, voiceId: char.heygenVoiceId, characterName }),
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

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>;
  if (!episode) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href={`/episodes/${id}/editor`} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" /> Retour à l'éditeur
        </Link>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Volume2 className="w-7 h-7 text-orange-400" /> Audio & Voix HeyGen
        </h1>
        <p className="text-gray-400 mt-1">{episode.title}</p>
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
              {["all", "fr", "en", "male", "female"].map(f => (
                <button key={f} onClick={() => setVoiceFilter(f)} className={`px-3 py-1.5 rounded-lg text-sm transition-all ${voiceFilter === f ? "bg-orange-600 text-white" : "bg-[#1e1e2e] border border-[#2a2a3e] text-gray-400 hover:text-white"}`}>
                  {f === "all" ? "Toutes" : f === "fr" ? "🇫🇷 Français" : f === "en" ? "🇬🇧 English" : f === "male" ? "Homme" : "Femme"}
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

      {/* Characters Voice Assignment */}
      <div className="mb-6 bg-[#13131a] border border-[#2a2a3e] rounded-xl p-5">
        <h2 className="font-bold text-white mb-4 flex items-center gap-2">
          <Mic className="w-5 h-5 text-orange-400" /> Voix des personnages
        </h2>
        {characters.length === 0 ? (
          <p className="text-gray-500 text-sm">Ajoutez des personnages à la série d'abord</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {characters.map(char => (
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
        )}
      </div>

      {/* Scenes Audio */}
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
                  <div className="flex-1">
                    <p className="font-medium text-white text-sm">{scene.location || `Scène ${scene.sceneNumber}`}</p>
                    {scene.timecode && <p className="text-xs text-gray-500">{scene.timecode}</p>}
                  </div>
                  {scene.voiceUrl && (
                    <span className="text-xs px-2 py-0.5 bg-green-600/20 border border-green-600/30 rounded-full text-green-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Audio généré
                    </span>
                  )}
                </div>

                <div className="p-4 space-y-4">
                  {/* Narration */}
                  {scene.narration && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium flex items-center gap-1">
                          <Mic className="w-3 h-3" /> Narration (Voix off)
                        </p>
                        <button onClick={() => copy(scene.narration!)} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                          <Copy className="w-3 h-3" /> Copier
                        </button>
                      </div>
                      <div className="bg-blue-900/10 border border-blue-600/30 rounded-xl p-3 flex items-start gap-3">
                        <div className="flex-1">
                          <p className="text-sm text-blue-200 italic leading-relaxed">&ldquo;{scene.narration}&rdquo;</p>
                          {scene.voiceUrl && (
                            <div className="mt-2 flex items-center gap-2">
                              <PlayButton url={scene.voiceUrl} id={`narration-${scene.id}`} />
                              <audio controls src={scene.voiceUrl} className="h-7 flex-1" />
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => generateVoiceForScene(scene, scene.narration!, "Narrateur")}
                          disabled={!!generatingVoice}
                          className="flex items-center gap-1 px-2 py-1.5 bg-orange-600/20 hover:bg-orange-600/40 border border-orange-600/30 text-orange-300 text-xs rounded-lg transition-all flex-shrink-0"
                        >
                          {generatingVoice === `${scene.id}-Narrateur` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                          Générer
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Dialogue lines */}
                  {dialogueLines.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium flex items-center gap-1 mb-2">
                        <Volume2 className="w-3 h-3" /> Dialogues
                      </p>
                      <div className="space-y-2">
                        {dialogueLines.map((line, idx) => {
                          const char = characters.find(c => c.name.toLowerCase() === line.character.toLowerCase());
                          const hasVoice = !!char?.heygenVoiceId;
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
                              <button
                                onClick={() => generateVoiceForScene(scene, line.line, line.character)}
                                disabled={!!generatingVoice || !hasVoice}
                                title={!hasVoice ? `Assignez d'abord une voix à ${line.character}` : "Générer la voix"}
                                className="flex items-center gap-1 px-2 py-1.5 bg-orange-600/20 hover:bg-orange-600/40 disabled:opacity-40 disabled:cursor-not-allowed border border-orange-600/30 text-orange-300 text-xs rounded-lg transition-all flex-shrink-0"
                              >
                                {generatingVoice === `${scene.id}-${line.character}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                Voix
                              </button>
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
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                        <Play className="w-3 h-3" /> Audio généré
                      </p>
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
