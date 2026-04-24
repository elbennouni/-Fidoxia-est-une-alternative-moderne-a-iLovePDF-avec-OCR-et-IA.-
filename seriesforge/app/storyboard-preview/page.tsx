"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Copy,
  Eye,
  Image,
  MapPin,
  Mic,
  RefreshCw,
  Users,
  X,
} from "lucide-react";

type ImageHistoryEntry = {
  url: string;
  generator: string;
  createdAt: string;
};

type CharacterRef = {
  id: string;
  name: string;
  referenceImageUrl?: string;
  visualDNA?: string | null;
};

type EnvironmentRef = {
  id: string;
  name: string;
  previewImageUrl?: string;
  description: string;
};

type ScenePreview = {
  id: string;
  sceneNumber: number;
  timecode: string;
  location: string;
  action: string;
  emotion: string;
  imagePrompt: string;
  videoPrompt: string;
  imageUrl: string;
  imageHistory: ImageHistoryEntry[];
  characters: CharacterRef[];
  environment: EnvironmentRef;
  voiceUrl?: string;
  qualityScore: number;
  generatorName: string;
};

const MOCK_SCENES: ScenePreview[] = [
  {
    id: "scene-1",
    sceneNumber: 1,
    timecode: "00:00",
    location: "Plage Solarys",
    action: "Sarah confronte Hassan devant le totem juste avant l'épreuve.",
    emotion: "tension, humiliation, défi",
    imagePrompt:
      "Pixar 3D cinematic keyframe, vertical 9:16. Location: Plage Solarys. Action: Sarah confronte Hassan devant le totem juste avant l'épreuve. Emotion: tension, humiliation, défi. Camera: medium close-up on active speaker, reaction cutaways. References to use exactly: CHARACTER: Sarah — Visage, tenue, expression et silhouette exacts a fournir au moteur image | CHARACTER: Hassan — Visage, tenue, expression et silhouette exacts a fournir au moteur image | ENVIRONMENT: Plage Solarys — Décor principal de la scène à fournir en référence si disponible | PROP: totem — Accessoire de cohérence à injecter dans le prompt et les références. Maintain strict character resemblance, exact outfits, coherent props and no visible text in the image.",
    videoPrompt:
      "Cinematic animated vertical 9:16 video scene. Main action: Sarah confronte Hassan devant le totem juste avant l'épreuve. Camera progression: medium close-up on active speaker, reaction cutaways. Emotional tone: tension, humiliation, défi. Environment: Plage Solarys. Visible speakers: Sarah, Hassan. Only the active speaker moves lips. Keep listeners' mouths mostly closed. Dialogue lines to stage: Sarah: Tu m'as menti. Hassan: J'ai protégé l'équipe. No visible text, no subtitles, no logo, keep exact character resemblance and same outfits across the whole clip.",
    imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
    imageHistory: [
      {
        url: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=900&q=80",
        generator: "Nano Banana Pro",
        createdAt: "2026-04-24T21:30:00.000Z",
      },
      {
        url: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=900&q=80",
        generator: "Ideogram Character",
        createdAt: "2026-04-24T21:12:00.000Z",
      },
    ],
    characters: [
      {
        id: "char-sarah",
        name: "Sarah",
        referenceImageUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80",
        visualDNA: "locked",
      },
      {
        id: "char-hassan",
        name: "Hassan",
        referenceImageUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80",
        visualDNA: "locked",
      },
    ],
    environment: {
      id: "env-solarys",
      name: "Plage Solarys",
      description: "Plage tropicale principale, sable clair, totem central, lumière chaude.",
      previewImageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
    },
    voiceUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    qualityScore: 91,
    generatorName: "Nano Banana Pro",
  },
  {
    id: "scene-2",
    sceneNumber: 2,
    timecode: "00:08",
    location: "Camp Vornak",
    action: "Plan narratif sur le camp pendant que la tension monte avant la décision.",
    emotion: "méfiance, attente",
    imagePrompt:
      "Pixar 3D cinematic keyframe, vertical 9:16. Location: Camp Vornak. Action: Plan narratif sur le camp pendant que la tension monte avant la décision. Emotion: méfiance, attente. Camera: wide establishing shot then push-in. References to use exactly: ENVIRONMENT: Camp Vornak — Décor principal de la scène à fournir en référence si disponible. Maintain strict character resemblance, exact outfits, coherent props and no visible text in the image.",
    videoPrompt:
      "Cinematic animated vertical 9:16 video scene. Main action: Plan narratif sur le camp pendant que la tension monte avant la décision. Camera progression: wide establishing shot then push-in. Emotional tone: méfiance, attente. Environment: Camp Vornak. No visible dialogue performance required. Use eyes, body language and reactions under narration. No visible text, no subtitles, no logo, keep exact character resemblance and same outfits across the whole clip.",
    imageUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
    imageHistory: [
      {
        url: "https://images.unsplash.com/photo-1526778548025-fa2f459cd5ce?auto=format&fit=crop&w=900&q=80",
        generator: "FLUX Dev",
        createdAt: "2026-04-24T21:18:00.000Z",
      },
    ],
    characters: [],
    environment: {
      id: "env-vornak",
      name: "Camp Vornak",
      description: "Campement de nuit, torches, feu de camp, ambiance lourde.",
      previewImageUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
    },
    qualityScore: 86,
    generatorName: "FLUX Dev",
  },
];

export default function StoryboardPreviewPage() {
  const [openPromptSceneId, setOpenPromptSceneId] = useState<string | null>(null);
  const [openHistorySceneId, setOpenHistorySceneId] = useState<string | null>(null);

  const promptScene = useMemo(
    () => MOCK_SCENES.find((scene) => scene.id === openPromptSceneId) || null,
    [openPromptSceneId]
  );
  const historyScene = useMemo(
    () => MOCK_SCENES.find((scene) => scene.id === openHistorySceneId) || null,
    [openHistorySceneId]
  );

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100">
      {promptScene && (
        <PromptModal
          scene={promptScene}
          onClose={() => setOpenPromptSceneId(null)}
          onCopy={copyText}
        />
      )}
      {historyScene && (
        <HistoryModal
          scene={historyScene}
          onClose={() => setOpenHistorySceneId(null)}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 py-8">
        <Link
          href="/producer-mode"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Retour à la preview Producteur IA
        </Link>

        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.3em] text-blue-400 mb-3">Preview</p>
          <h1 className="text-4xl font-bold text-white mb-3">Storyboard avancé</h1>
          <p className="text-gray-300 max-w-4xl">
            Cette preview publique montre l&apos;espace de réaction rapide : changement de moteur, régénération,
            historique miniature, popup prompt complet et visualisation des références exactes envoyées au moteur.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {MOCK_SCENES.map((scene) => (
            <div key={scene.id} className="bg-[#13131a] border border-[#2a2a3e] rounded-2xl overflow-hidden">
              <div className="aspect-[9/16] bg-[#1e1e2e] relative overflow-hidden">
                <img src={scene.imageUrl} alt={`Scene ${scene.sceneNumber}`} className="w-full h-full object-cover" />

                <div className="absolute top-2 left-2 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-black/70 text-white">
                    Scène {scene.sceneNumber}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-900/80 text-green-300">
                    {scene.qualityScore}
                  </span>
                </div>

                <div className="absolute top-2 right-2 flex items-center gap-2">
                  <div className="p-1 bg-green-600 rounded-full">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <button
                    onClick={() => setOpenHistorySceneId(scene.id)}
                    className="px-2 py-1 bg-black/70 hover:bg-black/90 text-white text-xs rounded-lg border border-white/10"
                  >
                    {scene.imageHistory.length} histo
                  </button>
                </div>

                <div className="absolute bottom-2 left-2 right-2">
                  <div className="flex gap-1 overflow-x-auto">
                    {scene.imageHistory.map((entry, idx) => (
                      <button
                        key={`${scene.id}-${idx}`}
                        onClick={() => setOpenHistorySceneId(scene.id)}
                        className="w-14 h-14 rounded-lg overflow-hidden border border-white/10 bg-black/70 flex-shrink-0"
                      >
                        <img src={entry.url} alt={`Historique ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-400">📍 {scene.location}</p>
                    <p className="text-sm text-white mt-1 line-clamp-2">{scene.action}</p>
                    <p className="text-xs text-gray-500 italic mt-1">{scene.emotion}</p>
                  </div>
                  <span className="text-xs text-gray-500">{scene.timecode}</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs px-2 py-0.5 rounded-full border bg-orange-600/20 border-orange-600/30 text-orange-300">
                    <Users className="inline w-3 h-3 mr-1" />
                    {scene.characters.length} perso
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full border bg-[#1e1e2e] border-[#2a2a3e] text-gray-400">
                    <MapPin className="inline w-3 h-3 mr-1" />
                    {scene.environment.name}
                  </span>
                  {scene.voiceUrl && (
                    <span className="text-xs px-2 py-0.5 rounded-full border bg-green-600/20 border-green-600/30 text-green-300">
                      <Mic className="inline w-3 h-3 mr-1" />
                      audio lipsync prêt
                    </span>
                  )}
                </div>

                <div className="rounded-xl border border-[#2a2a3e] bg-[#1e1e2e] p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Moteur image</p>
                  <p className="text-sm text-white">{scene.generatorName}</p>
                  <p className="text-xs text-gray-500 mt-1">Exemple de menu par scène pour réagir vite.</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-3 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-all">
                    <RefreshCw className="w-4 h-4" /> Regénérer
                  </button>
                  <button
                    onClick={() => setOpenPromptSceneId(scene.id)}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[#1e1e2e] border border-[#2a2a3e] hover:border-blue-500/50 text-gray-300 text-sm rounded-xl transition-all"
                  >
                    <Eye className="w-4 h-4" /> Prompt
                  </button>
                  <button
                    onClick={() => copyText(scene.imagePrompt)}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[#1e1e2e] border border-[#2a2a3e] hover:border-purple-500/50 text-gray-300 text-sm rounded-xl transition-all"
                  >
                    <Copy className="w-4 h-4" /> Copier
                  </button>
                </div>

                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <Image className="w-3 h-3" />
                  Menu rapide + références + prompts complets
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PromptModal({
  scene,
  onClose,
  onCopy,
}: {
  scene: ScenePreview;
  onClose: () => void;
  onCopy: (text: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#13131a] border border-[#2a2a3e] rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a3e]">
          <div>
            <h2 className="text-xl font-bold text-white">Prompt complet — Scène {scene.sceneNumber}</h2>
            <p className="text-sm text-gray-400 mt-1">Vue exacte des références fournies au moteur.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] max-h-[calc(90vh-84px)]">
          <div className="border-r border-[#2a2a3e] p-5 overflow-y-auto space-y-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Références personnages</p>
              <div className="grid grid-cols-2 gap-3">
                {scene.characters.map((char) => (
                  <div key={char.id} className="rounded-xl border border-[#2a2a3e] bg-[#1e1e2e] overflow-hidden">
                    <div className="aspect-square bg-[#11111a] flex items-center justify-center overflow-hidden">
                      {char.referenceImageUrl ? (
                        <img src={char.referenceImageUrl} alt={char.name} className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-6 h-6 text-gray-600" />
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium text-white truncate">{char.name}</p>
                      <p className="text-[11px] text-gray-500">{char.visualDNA ? "ADN visuel" : "sans ADN"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Décor / accessoire</p>
              <div className="rounded-xl border border-[#2a2a3e] bg-[#1e1e2e] overflow-hidden">
                <div className="aspect-video bg-[#11111a] flex items-center justify-center overflow-hidden">
                  {scene.environment.previewImageUrl ? (
                    <img src={scene.environment.previewImageUrl} alt={scene.environment.name} className="w-full h-full object-cover" />
                  ) : (
                    <MapPin className="w-6 h-6 text-gray-600" />
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-white">{scene.environment.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{scene.environment.description}</p>
                </div>
              </div>
            </div>

            {scene.voiceUrl && (
              <div className="rounded-xl border border-green-600/30 bg-green-900/10 p-3">
                <p className="text-sm text-green-300 mb-2">Audio disponible pour synchronisation labiale</p>
                <audio controls src={scene.voiceUrl} className="w-full h-10" />
              </div>
            )}
          </div>

          <div className="p-5 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Prompt image</p>
                <p className="text-sm text-gray-400 mt-1">Avec décor + personnages + prop + interdiction du texte visible.</p>
              </div>
              <button onClick={() => onCopy(scene.imagePrompt)} className="px-3 py-2 bg-blue-600/20 border border-blue-600/30 text-blue-300 text-sm rounded-xl">
                Copier
              </button>
            </div>
            <div className="rounded-xl border border-[#2a2a3e] bg-[#1e1e2e] p-4">
              <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{scene.imagePrompt}</p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Prompt vidéo</p>
                <p className="text-sm text-gray-400 mt-1">Avec règles de lipsync / active speaker / voix off.</p>
              </div>
              <button onClick={() => onCopy(scene.videoPrompt)} className="px-3 py-2 bg-purple-600/20 border border-purple-600/30 text-purple-300 text-sm rounded-xl">
                Copier
              </button>
            </div>
            <div className="rounded-xl border border-[#2a2a3e] bg-[#1e1e2e] p-4">
              <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{scene.videoPrompt}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryModal({
  scene,
  onClose,
}: {
  scene: ScenePreview;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#13131a] border border-[#2a2a3e] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a3e]">
          <h2 className="text-xl font-bold text-white">Historique — Scène {scene.sceneNumber}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[calc(90vh-84px)]">
          <div className="mb-5">
            <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Image actuelle</p>
            <img src={scene.imageUrl} alt="Image actuelle" className="w-full max-h-72 object-contain rounded-xl border border-green-600/20 bg-[#1e1e2e]" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {scene.imageHistory.map((entry, idx) => (
              <div key={`${entry.url}-${idx}`} className="rounded-xl overflow-hidden border border-[#2a2a3e] bg-[#1e1e2e]">
                <img src={entry.url} alt={`Historique ${idx + 1}`} className="w-full aspect-video object-cover" />
                <div className="p-3">
                  <p className="text-sm text-white truncate">{entry.generator}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    <Clock className="inline w-3 h-3 mr-1" />
                    {new Date(entry.createdAt).toLocaleString("fr-FR")}
                  </p>
                  <button className="mt-3 w-full py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-xl">
                    Restaurer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
