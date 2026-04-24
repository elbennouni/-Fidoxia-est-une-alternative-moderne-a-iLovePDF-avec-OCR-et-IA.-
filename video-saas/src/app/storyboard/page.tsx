"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Label, Select } from "@/components/ui";

type Series = { id: string; title: string };
type Episode = { id: string; title: string; episodeNumber: number };
type Frame = {
  id: string;
  prompt: string;
  imageUrl: string;
  provider: string;
  validated: boolean;
  scene: { sceneOrder: number; action: string; emotion: string };
};

export default function StoryboardPage() {
  const [series, setSeries] = useState<Series[]>([]);
  const [selectedSeries, setSelectedSeries] = useState("");
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState("");
  const [frames, setFrames] = useState<Frame[]>([]);
  const [imageProvider, setImageProvider] = useState("placeholder-image-ai");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const selectedSeriesTitle = useMemo(
    () => series.find((s) => s.id === selectedSeries)?.title ?? "",
    [series, selectedSeries],
  );

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/series");
      const data = await response.json();
      if (response.ok) {
        setSeries(data.series ?? []);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedSeries) {
      setEpisodes([]);
      setSelectedEpisode("");
      return;
    }
    void (async () => {
      const response = await fetch(`/api/series/${selectedSeries}/episodes`);
      const data = await response.json();
      if (response.ok) {
        setEpisodes(data.episodes ?? []);
        if (data.episodes?.[0]?.id) {
          setSelectedEpisode(data.episodes[0].id);
        }
      }
    })();
  }, [selectedSeries]);

  useEffect(() => {
    if (!selectedSeries || !selectedEpisode) {
      setFrames([]);
      return;
    }
    void loadFrames(selectedSeries, selectedEpisode);
  }, [selectedSeries, selectedEpisode]);

  async function loadFrames(seriesId: string, episodeId: string) {
    const response = await fetch(`/api/series/${seriesId}/episodes/${episodeId}/storyboard`);
    const data = await response.json();
    if (response.ok) {
      setFrames(data.frames ?? []);
      setMessage("");
    } else {
      setFrames([]);
      setMessage(data.error ?? "Storyboard indisponible pour cet episode.");
    }
  }

  async function generateStoryboard(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSeries || !selectedEpisode) return;
    setLoading(true);
    setMessage("");
    const response = await fetch(`/api/series/${selectedSeries}/episodes/${selectedEpisode}/storyboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageProvider }),
    });
    const data = await response.json();
    if (response.ok) {
      setMessage("Storyboard genere avec succes.");
      await loadFrames(selectedSeries, selectedEpisode);
    } else {
      setMessage(data.error ?? "Erreur generation storyboard.");
    }
    setLoading(false);
  }

  return (
    <div className="container-page space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Storyboard viewer (STEP 5)</h1>
        <p className="text-sm text-slate-600">
          Generation image-first par scene avec prompts stricts (personnages, environnement, emotion, camera, style).
        </p>
      </div>

      <Card className="space-y-4">
        <div>
          <Label>Serie</Label>
          <Select value={selectedSeries} onChange={(e) => setSelectedSeries(e.target.value)}>
            <option value="">Choisir une serie</option>
            {series.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label>Episode</Label>
          <Select value={selectedEpisode} onChange={(e) => setSelectedEpisode(e.target.value)}>
            <option value="">Choisir un episode</option>
            {episodes.map((item) => (
              <option key={item.id} value={item.id}>
                Episode {item.episodeNumber} - {item.title}
              </option>
            ))}
          </Select>
        </div>

        <form className="grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={generateStoryboard}>
          <div>
            <Label>Image provider</Label>
            <Input
              value={imageProvider}
              onChange={(e) => setImageProvider(e.target.value)}
              placeholder="placeholder-image-ai"
            />
          </div>
          <Button type="submit" disabled={loading || !selectedSeries || !selectedEpisode}>
            {loading ? "Generation..." : "Generer storyboard"}
          </Button>
        </form>
        {message && <p className="text-sm text-slate-700">{message}</p>}
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-medium">
          Frames {selectedSeriesTitle ? `- ${selectedSeriesTitle}` : ""}
        </h2>
        {frames.length === 0 ? (
          <p className="text-sm text-slate-600">Aucun frame pour le moment.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {frames.map((frame) => (
              <article key={frame.id} className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 text-sm font-semibold">
                  Scene {frame.scene.sceneOrder} - {frame.provider}
                </div>
                <img
                  src={frame.imageUrl}
                  alt={`Scene ${frame.scene.sceneOrder}`}
                  className="mb-3 h-56 w-full rounded-lg border border-slate-200 object-cover"
                />
                <p className="mb-2 text-xs text-slate-700">{frame.scene.action}</p>
                <p className="mb-2 text-xs text-slate-700">Emotion: {frame.scene.emotion}</p>
                <details className="text-xs text-slate-600">
                  <summary className="cursor-pointer">Prompt</summary>
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-100 p-2">{frame.prompt}</pre>
                </details>
              </article>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
