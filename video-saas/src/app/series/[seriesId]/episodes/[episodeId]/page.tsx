"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, EmptyState, Field, PageHeader, Pill, PrimaryButton, SecondaryButton } from "@/components/ui";

type Scene = {
  id: string;
  sceneOrder: number;
  action: string;
  charactersInShot: string;
  emotion: string;
  location: string;
  qcStatus: "PENDING" | "PASS" | "FAIL";
  qcNotes: string | null;
  storyboard: { id: string; imageUrl: string; prompt: string; provider: string } | null;
  audio: { id: string; audioUrl: string; narration: string; dialogue: string; validated: boolean } | null;
  video: { id: string; videoUrl: string; prompt: string; provider: string; validated: boolean } | null;
};

type EpisodeResponse = {
  episode: {
    id: string;
    title: string;
    episodeNumber: number;
    currentStep: string;
    audioValidated: boolean;
    scriptOverview: string | null;
  };
  scenes: Scene[];
  charactersCount: number;
  environmentsCount: number;
};

export default function EpisodeEditorPage({
  params,
}: {
  params: Promise<{ seriesId: string; episodeId: string }>;
}) {
  const [seriesId, setSeriesId] = useState("");
  const [episodeId, setEpisodeId] = useState("");
  const [data, setData] = useState<EpisodeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");

  const [brief, setBrief] = useState(
    "Episode dramatique avec conflit progressif, rebondissements et resolution partielle.",
  );
  const [sceneCount, setSceneCount] = useState(5);
  const [imageProvider, setImageProvider] = useState("placeholder-image-ai");
  const [voiceProvider, setVoiceProvider] = useState<"HEYGEN" | "FALLBACK">("FALLBACK");
  const [musicStyle, setMusicStyle] = useState("dramatic synth");
  const [sfxStyle, setSfxStyle] = useState("cinematic impacts");
  const [videoProvider, setVideoProvider] = useState<"KLING" | "REPLICATE" | "OTHER">("OTHER");
  const [durationSecPerScene, setDurationSecPerScene] = useState(6);
  const [videoFormat, setVideoFormat] = useState<"" | "VERTICAL_9_16" | "HORIZONTAL_16_9">("");

  useEffect(() => {
    params.then((p) => {
      setSeriesId(p.seriesId);
      setEpisodeId(p.episodeId);
    });
  }, [params]);

  async function load() {
    if (!seriesId || !episodeId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/series/${seriesId}/episodes/${episodeId}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Impossible de charger l&apos;episode.");
      }
      setData(json as EpisodeResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId, episodeId]);

  async function callApi(
    actionLabel: string,
    url: string,
    method: "POST" | "PATCH",
    body: Record<string, unknown>,
  ) {
    setBusyAction(actionLabel);
    setError("");
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
                    throw new Error(json.error ?? `${actionLabel} a echoue.`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : `${actionLabel} a echoue.`);
    } finally {
      setBusyAction("");
    }
  }

  const hasScenes = (data?.scenes?.length ?? 0) > 0;
  const storyboardReady = useMemo(
    () => (data?.scenes ?? []).length > 0 && (data?.scenes ?? []).every((scene) => scene.storyboard),
    [data?.scenes],
  );
  const audioReady = useMemo(
    () => (data?.scenes ?? []).length > 0 && (data?.scenes ?? []).every((scene) => scene.audio),
    [data?.scenes],
  );
  const allAudioValidated = data?.episode.audioValidated ?? false;
  const videoGenerated = useMemo(
    () => (data?.scenes ?? []).length > 0 && (data?.scenes ?? []).every((scene) => scene.video),
    [data?.scenes],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          data
            ? `Episode ${data.episode.episodeNumber} — ${data.episode.title}`
            : "Episode Editor"
        }
        subtitle="Pipeline strict: Script -> Storyboard -> Audio -> Video"
        right={
          <div className="flex gap-2">
            <Link href={`/series/${seriesId}`}>
              <SecondaryButton>Retour serie</SecondaryButton>
            </Link>
            <PrimaryButton onClick={load}>Rafraichir</PrimaryButton>
          </div>
        }
      />

      {error && (
        <Card className="border-red-500/40 text-red-300">
          <p>{error}</p>
        </Card>
      )}

      {loading && <Card>Chargement...</Card>}

      {!loading && !data && <EmptyState title="Episode introuvable" description="Verifie les identifiants." />}

      {data && (
        <>
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <Pill>Step actuel: {data.episode.currentStep}</Pill>
              <Pill>{data.charactersCount} personnages</Pill>
              <Pill>{data.environmentsCount} environnements</Pill>
              <Pill>{data.scenes.length} scenes</Pill>
              <Pill>{data.episode.audioValidated ? "Audio valide" : "Audio non valide"}</Pill>
            </div>
            <p className="mt-3 text-sm text-gray-300">
              Rappel regles: jamais de video avant storyboard + audio valide, continuites strictes et QC obligatoire.
            </p>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold">Etape 4 — Story generation</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field
                label="Brief narratif"
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                multiline
              />
              <Field
                label="Nombre de scenes"
                type="number"
                min={1}
                max={12}
                value={sceneCount}
                onChange={(event) => setSceneCount(Number(event.target.value))}
              />
            </div>
            <div className="mt-4">
              <PrimaryButton
                disabled={busyAction !== ""}
                onClick={() =>
                  callApi("Generation story", `/api/series/${seriesId}/episodes/${episodeId}/story`, "POST", {
                    brief,
                    sceneCount,
                  })
                }
              >
                {busyAction === "Generation story" ? "Generation..." : "Generer script structure"}
              </PrimaryButton>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold">Etape 5 — Storyboard (image first)</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field
                label="Image provider"
                value={imageProvider}
                onChange={(event) => setImageProvider(event.target.value)}
              />
            </div>
            <div className="mt-4 flex gap-2">
              <PrimaryButton
                disabled={busyAction !== "" || !hasScenes}
                onClick={() =>
                  callApi(
                    "Generation storyboard",
                    `/api/series/${seriesId}/episodes/${episodeId}/storyboard`,
                    "POST",
                    { imageProvider },
                  )
                }
              >
                {busyAction === "Generation storyboard" ? "Generation..." : "Generer storyboard"}
              </PrimaryButton>
              <Link href={`/series/${seriesId}/episodes/${episodeId}/storyboard`}>
                <SecondaryButton>Ouvrir storyboard viewer</SecondaryButton>
              </Link>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold">Etape 6 — Audio layer + validation</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Field
                label="Voice provider"
                select
                value={voiceProvider}
                onChange={(event) => setVoiceProvider(event.target.value as "HEYGEN" | "FALLBACK")}
                options={[
                  { value: "HEYGEN", label: "HeyGen" },
                  { value: "FALLBACK", label: "Fallback" },
                ]}
              />
              <Field
                label="Music style"
                value={musicStyle}
                onChange={(event) => setMusicStyle(event.target.value)}
              />
              <Field
                label="SFX style"
                value={sfxStyle}
                onChange={(event) => setSfxStyle(event.target.value)}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <PrimaryButton
                disabled={busyAction !== "" || !storyboardReady || !seriesId || !episodeId}
                onClick={() =>
                  callApi("Generation audio", `/api/series/${seriesId}/episodes/${episodeId}/audio`, "POST", {
                    voiceProvider,
                    musicStyle,
                    sfxStyle,
                  })
                }
              >
                {busyAction === "Generation audio" ? "Generation..." : "Generer audio"}
              </PrimaryButton>
              <SecondaryButton
                disabled={busyAction !== "" || !audioReady || !seriesId || !episodeId}
                onClick={() =>
                  callApi("Validation audio", `/api/series/${seriesId}/episodes/${episodeId}/audio`, "PATCH", {
                    validateAll: true,
                  })
                }
              >
                {busyAction === "Validation audio" ? "Validation..." : "Valider tout l&apos;audio"}
              </SecondaryButton>
              <Link href={`/series/${seriesId}/episodes/${episodeId}/audio`}>
                <SecondaryButton>Page audio validation</SecondaryButton>
              </Link>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold">Etape 7 — Video generation (last step)</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Field
                label="Video provider"
                select
                value={videoProvider}
                onChange={(event) =>
                  setVideoProvider(event.target.value as "KLING" | "REPLICATE" | "OTHER")
                }
                options={[
                  { value: "KLING", label: "Kling" },
                  { value: "REPLICATE", label: "Replicate" },
                  { value: "OTHER", label: "Other API" },
                ]}
              />
              <Field
                label="Format override (optional)"
                select
                value={videoFormat}
                onChange={(event) =>
                  setVideoFormat(event.target.value as "" | "VERTICAL_9_16" | "HORIZONTAL_16_9")
                }
                options={[
                  { value: "", label: "Serie default" },
                  { value: "VERTICAL_9_16", label: "9:16 TikTok" },
                  { value: "HORIZONTAL_16_9", label: "16:9 YouTube" },
                ]}
              />
              <Field
                label="Duree/scene (sec)"
                type="number"
                min={2}
                max={40}
                value={durationSecPerScene}
                onChange={(event) => setDurationSecPerScene(Number(event.target.value))}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <PrimaryButton
                disabled={busyAction !== "" || !allAudioValidated || !seriesId || !episodeId}
                onClick={() =>
                  callApi("Generation video", `/api/series/${seriesId}/episodes/${episodeId}/video`, "POST", {
                    provider: videoProvider,
                    durationSecPerScene,
                    ...(videoFormat ? { format: videoFormat } : {}),
                  })
                }
              >
                {busyAction === "Generation video" ? "Generation..." : "Generer video"}
              </PrimaryButton>
              <Link href={`/series/${seriesId}/episodes/${episodeId}/video`}>
                <SecondaryButton>Page video generation</SecondaryButton>
              </Link>
            </div>
            {!allAudioValidated && (
              <p className="mt-2 text-sm text-yellow-300">
                Bloque: la video est interdite avant validation audio complete.
              </p>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold">Scenes</h2>
            {!hasScenes && <EmptyState title="Aucune scene" description="Genere le script pour commencer." />}
            {hasScenes && (
              <div className="mt-4 space-y-3">
                {data.scenes.map((scene) => (
                  <div key={scene.id} className="rounded-lg border border-gray-700 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">Scene {scene.sceneOrder}</span>
                      <Pill>QC: {scene.qcStatus}</Pill>
                      {scene.storyboard && <Pill>Storyboard OK</Pill>}
                      {scene.audio && <Pill>{scene.audio.validated ? "Audio valide" : "Audio en attente"}</Pill>}
                      {scene.video && <Pill>{scene.video.validated ? "Video validee" : "Video QC fail"}</Pill>}
                    </div>
                    <p className="mt-2 text-sm text-gray-200">{scene.action}</p>
                    <p className="text-xs text-gray-400">
                      Personnages: {scene.charactersInShot} | Emotion: {scene.emotion} | Lieu: {scene.location}
                    </p>
                    {scene.qcNotes && <p className="mt-1 text-xs text-amber-300">QC notes: {scene.qcNotes}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold">Etat global</h2>
            <p className="mt-2 text-sm text-gray-300">
              Storyboard: {storyboardReady ? "complet" : "incomplet"} | Audio:{" "}
              {allAudioValidated ? "valide" : audioReady ? "genere (non valide)" : "absent"} | Video:{" "}
              {videoGenerated ? "generee" : "non generee"}
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
