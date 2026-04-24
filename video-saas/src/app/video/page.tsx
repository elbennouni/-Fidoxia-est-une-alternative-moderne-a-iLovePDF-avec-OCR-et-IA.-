"use client";

import { useMemo, useState } from "react";
import { Card, Field, Input, Select } from "@/components/ui";
import { VIDEO_THEMES } from "@/lib/video-themes";

type Series = {
  id: string;
  title: string;
  style: (typeof VIDEO_THEMES)[number]["key"];
};

type Episode = {
  id: string;
  title: string;
  currentStep: string;
  audioValidated: boolean;
};

type Shot = {
  id: string;
  prompt: string;
  videoUrl: string;
  provider: string;
  validated: boolean;
  scene: {
    sceneOrder: number;
    action: string;
    qcStatus: string;
    qcNotes: string | null;
  };
};

export default function VideoPage() {
  const [series, setSeries] = useState<Series[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [seriesId, setSeriesId] = useState("");
  const [episodeId, setEpisodeId] = useState("");
  const [provider, setProvider] = useState<"KLING" | "REPLICATE" | "OTHER">("KLING");
  const [format, setFormat] = useState<"VERTICAL_9_16" | "HORIZONTAL_16_9">("VERTICAL_9_16");
  const [duration, setDuration] = useState(6);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadSeries() {
    setError(null);
    const response = await fetch("/api/series");
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Erreur chargement series");
      return;
    }
    setSeries(payload.series ?? []);
  }

  async function loadEpisodes(targetSeriesId: string) {
    setError(null);
    setEpisodeId("");
    setShots([]);
    const response = await fetch(`/api/series/${targetSeriesId}/episodes`);
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Erreur chargement episodes");
      return;
    }
    setEpisodes(payload.episodes ?? []);
  }

  async function loadShots(targetSeriesId: string, targetEpisodeId: string) {
    setError(null);
    const response = await fetch(`/api/series/${targetSeriesId}/episodes/${targetEpisodeId}/video`);
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Erreur chargement videos");
      return;
    }
    setShots(payload.shots ?? []);
  }

  async function generateVideo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!seriesId || !episodeId) {
      setError("Selectionne une serie et un episode.");
      return;
    }
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch(`/api/series/${seriesId}/episodes/${episodeId}/video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          format,
          durationSecPerScene: duration,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Echec generation video");
        return;
      }
      setStatus(
        `Video generee: ${payload.generated} plans, ${payload.regenerated} regeneration(s) QC automatique.`,
      );
      await loadShots(seriesId, episodeId);
    } finally {
      setLoading(false);
    }
  }

  const selectedEpisode = useMemo(
    () => episodes.find((episode) => episode.id === episodeId) ?? null,
    [episodes, episodeId],
  );

  return (
    <main className="space-y-6">
      <section className="space-y-6">
        <h1>Video generation</h1>
        <p className="muted">
          STEP 7 strict. Generation bloquee tant que storyboard et audio valide ne sont pas completes.
        </p>

        <Card>
          <h2>Selection episode</h2>
          <div className="grid-2">
            <Field label="Serie">
              <div className="row">
                <Select
                  value={seriesId}
                  onChange={async (event) => {
                    setSeriesId(event.target.value);
                    if (event.target.value) {
                      await loadEpisodes(event.target.value);
                    }
                  }}
                >
                  <option value="">Choisir</option>
                  {series.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </Select>
                <button type="button" onClick={loadSeries}>
                  Charger
                </button>
              </div>
            </Field>
            <Field label="Episode">
              <div className="row">
                <Select
                  value={episodeId}
                  onChange={async (event) => {
                    setEpisodeId(event.target.value);
                    if (seriesId && event.target.value) {
                      await loadShots(seriesId, event.target.value);
                    }
                  }}
                >
                  <option value="">Choisir</option>
                  {episodes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} ({item.currentStep})
                    </option>
                  ))}
                </Select>
                {seriesId && episodeId ? (
                  <button type="button" onClick={() => loadShots(seriesId, episodeId)}>
                    Rafraichir
                  </button>
                ) : null}
              </div>
            </Field>
          </div>
          {selectedEpisode ? (
            <p className="muted">
              audioValidated: {selectedEpisode.audioValidated ? "oui" : "non"} | step:{" "}
              {selectedEpisode.currentStep}
            </p>
          ) : null}
        </Card>

        <Card>
          <h2>Configurer et lancer video</h2>
          <form className="stack" onSubmit={generateVideo}>
            <div className="grid-3">
              <Field label="Provider">
                <Select
                  value={provider}
                  onChange={(event) =>
                    setProvider(event.target.value as "KLING" | "REPLICATE" | "OTHER")
                  }
                >
                  <option value="KLING">Kling</option>
                  <option value="REPLICATE">Replicate</option>
                  <option value="OTHER">Other API</option>
                </Select>
              </Field>
              <Field label="Format output">
                <Select
                  value={format}
                  onChange={(event) =>
                    setFormat(event.target.value as "VERTICAL_9_16" | "HORIZONTAL_16_9")
                  }
                >
                  <option value="VERTICAL_9_16">9:16 TikTok</option>
                  <option value="HORIZONTAL_16_9">16:9 YouTube</option>
                </Select>
              </Field>
              <Field label="Duree / scene (sec)">
                <Input
                  type="number"
                  min={2}
                  max={40}
                  value={duration}
                  onChange={(event) => setDuration(Number(event.target.value))}
                />
              </Field>
            </div>
            <button type="submit" disabled={loading}>
              {loading ? "Generation..." : "Generer la video"}
            </button>
          </form>
        </Card>

        {error ? <p className="error">{error}</p> : null}
        {status ? <p className="success">{status}</p> : null}

        <Card>
          <h2>Shots videos</h2>
          <ul className="stack">
            {shots.map((shot) => (
              <li key={shot.id} className="list-item">
                <p>
                  <strong>Scene {shot.scene.sceneOrder}</strong> - {shot.provider} - QC{" "}
                  {shot.scene.qcStatus}
                </p>
                <p className="muted">{shot.scene.action}</p>
                <p className="muted">URL: {shot.videoUrl}</p>
                <p className="muted">Valide: {shot.validated ? "oui" : "non"}</p>
                {shot.scene.qcNotes ? <p className="muted">QC notes: {shot.scene.qcNotes}</p> : null}
                <details>
                  <summary>Prompt video</summary>
                  <pre className="pre-wrap">{shot.prompt}</pre>
                </details>
              </li>
            ))}
            {shots.length === 0 ? <li className="muted">Aucun shot video genere.</li> : null}
          </ul>
        </Card>
      </section>
    </main>
  );
}
