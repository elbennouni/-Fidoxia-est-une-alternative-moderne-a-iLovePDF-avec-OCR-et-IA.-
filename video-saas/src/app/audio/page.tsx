"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Button, Card, Field, Select } from "@/components/ui";
import { useSearchParams } from "next/navigation";

type Series = { id: string; title: string };
type Episode = { id: string; title: string; episodeNumber: number };
type SceneAudio = {
  id: string;
  sceneOrder: number;
  action: string;
  emotion: string;
  audio: { id: string; narration: string; dialogue: string; audioUrl: string; validated: boolean } | null;
};

function AudioPageContent() {
  const params = useSearchParams();
  const [series, setSeries] = useState<Series[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [sceneRows, setSceneRows] = useState<SceneAudio[]>([]);
  const [selectedSeries, setSelectedSeries] = useState(params.get("seriesId") ?? "");
  const [selectedEpisode, setSelectedEpisode] = useState(params.get("episodeId") ?? "");
  const [message, setMessage] = useState("");
  const [musicStyle, setMusicStyle] = useState("orchestral dramatique");
  const [sfxStyle, setSfxStyle] = useState("impacts legers et ambiance");
  const [voiceProvider, setVoiceProvider] = useState<"HEYGEN" | "FALLBACK">("FALLBACK");
  const [loading, setLoading] = useState(false);

  const selectedEpisodeLabel = useMemo(
    () => episodes.find((episode) => episode.id === selectedEpisode)?.title ?? "",
    [episodes, selectedEpisode],
  );

  useEffect(() => {
    void loadSeries();
  }, []);

  useEffect(() => {
    if (!selectedSeries) return;
    void loadEpisodes(selectedSeries);
  }, [selectedSeries]);

  useEffect(() => {
    if (!selectedSeries || !selectedEpisode) return;
    void loadEpisodeAudio(selectedSeries, selectedEpisode);
  }, [selectedSeries, selectedEpisode]);

  async function loadSeries() {
    const response = await fetch("/api/series");
    if (!response.ok) return;
    const data = await response.json();
    setSeries(data.series ?? []);
    if (!selectedSeries && data.series?.[0]) {
      setSelectedSeries(data.series[0].id);
    }
  }

  async function loadEpisodes(seriesId: string) {
    const response = await fetch(`/api/series/${seriesId}/episodes`);
    if (!response.ok) return;
    const data = await response.json();
    setEpisodes(data.episodes ?? []);
    if (!selectedEpisode && data.episodes?.[0]) {
      setSelectedEpisode(data.episodes[0].id);
    }
  }

  async function loadEpisodeAudio(seriesId: string, episodeId: string) {
    const response = await fetch(`/api/series/${seriesId}/episodes/${episodeId}`);
    if (!response.ok) return;
    const data = await response.json();
    setSceneRows(data.scenes ?? []);
  }

  async function generateAudio() {
    if (!selectedSeries || !selectedEpisode) return;
    setLoading(true);
    setMessage("");
    const response = await fetch(`/api/series/${selectedSeries}/episodes/${selectedEpisode}/audio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voiceProvider,
        musicStyle,
        sfxStyle,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Erreur generation audio");
    } else {
      setMessage(`Audio genere (${data.takes?.length ?? 0} scenes).`);
      await loadEpisodeAudio(selectedSeries, selectedEpisode);
    }
    setLoading(false);
  }

  async function validateAllAudio() {
    if (!selectedSeries || !selectedEpisode) return;
    setLoading(true);
    const response = await fetch(
      `/api/series/${selectedSeries}/episodes/${selectedEpisode}/audio/validate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ validateAll: true }),
      },
    );
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Erreur validation audio");
    } else {
      setMessage(`Validation audio OK (${data.validatedCount} scenes).`);
      await loadEpisodeAudio(selectedSeries, selectedEpisode);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-white">Audio validation page</h1>
      <p className="text-sm text-white/70">
        Step 6: generation narration/dialogues + validation obligatoire avant video.
      </p>

      <Card>
        <Field label="Serie">
          <Select value={selectedSeries} onChange={(event) => setSelectedSeries(event.target.value)}>
            <option value="">Selectionner une serie</option>
            {series.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Episode">
          <Select value={selectedEpisode} onChange={(event) => setSelectedEpisode(event.target.value)}>
            <option value="">Selectionner un episode</option>
            {episodes.map((item) => (
              <option key={item.id} value={item.id}>
                E{item.episodeNumber} - {item.title}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Voice provider">
          <Select
            value={voiceProvider}
            onChange={(event) => setVoiceProvider(event.target.value as "HEYGEN" | "FALLBACK")}
          >
            <option value="FALLBACK">Fallback TTS</option>
            <option value="HEYGEN">HeyGen compatible</option>
          </Select>
        </Field>

        <Field label="Style musique">
          <input
            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            value={musicStyle}
            onChange={(event) => setMusicStyle(event.target.value)}
          />
        </Field>

        <Field label="Style SFX">
          <input
            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            value={sfxStyle}
            onChange={(event) => setSfxStyle(event.target.value)}
          />
        </Field>

        <div className="flex gap-2">
          <Button onClick={generateAudio} disabled={loading}>
            Generer audio
          </Button>
          <Button onClick={validateAllAudio} disabled={loading || sceneRows.length === 0}>
            Valider tout l&apos;audio
          </Button>
        </div>
      </Card>

      {message ? <p className="text-sm text-cyan-200">{message}</p> : null}

      <Card>
        <h3 className="text-lg font-semibold text-white">
          Etat audio {selectedEpisodeLabel ? `- ${selectedEpisodeLabel}` : ""}
        </h3>
        <div className="mt-3 space-y-3">
          {sceneRows.map((scene) => (
            <div key={scene.id} className="rounded-lg border border-white/10 p-3 text-sm text-white/85">
              <p className="font-semibold">Scene #{scene.sceneOrder}</p>
              <p className="text-white/70">{scene.action}</p>
              <p>Narration: {scene.audio?.narration ?? "-"}</p>
              <p>Dialogue: {scene.audio?.dialogue ?? "-"}</p>
              <p>
                Audio URL:{" "}
                {scene.audio?.audioUrl ? (
                  <a
                    className="text-cyan-300 underline"
                    href={scene.audio.audioUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ecouter
                  </a>
                ) : (
                  "-"
                )}
              </p>
              <p>Valide: {scene.audio?.validated ? "Oui" : "Non"}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default function AudioPage() {
  return (
    <Suspense fallback={<div className="text-sm text-white/70">Chargement...</div>}>
      <AudioPageContent />
    </Suspense>
  );
}
