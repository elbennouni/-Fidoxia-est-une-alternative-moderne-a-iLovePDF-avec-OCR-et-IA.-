"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { VIDEO_THEMES } from "@/lib/video-themes";
import { Card, Input, PrimaryButton, SecondaryButton } from "@/components/ui";

type Episode = {
  id: string;
  title: string;
  episodeNumber: number;
  currentStep: string;
};

type SeriesData = {
  id: string;
  title: string;
  style: string;
  format: string;
  tone: string;
  characters: Array<{ id: string }>;
  environments: Array<{ id: string }>;
  episodes: Episode[];
};

export default function SeriesDetailPage({
  params,
}: {
  params: Promise<{ seriesId: string }>;
}) {
  const [seriesId, setSeriesId] = useState("");
  const [series, setSeries] = useState<SeriesData | null>(null);
  const [title, setTitle] = useState("");
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    params.then(({ seriesId: id }) => setSeriesId(id));
  }, [params]);

  async function load() {
    if (!seriesId) return;
    const res = await fetch(`/api/series/${seriesId}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Serie introuvable.");
      return;
    }
    setSeries(json.series);
    setEpisodeNumber((json.series.episodes?.length ?? 0) + 1);
    setError("");
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId]);

  async function createEpisode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!series) return;
    const res = await fetch(`/api/series/${series.id}/episodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, episodeNumber }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Creation episode impossible.");
      return;
    }
    setTitle("");
    await load();
  }

  if (!series) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-white/70">Chargement serie...</p>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>
    );
  }

  const theme = VIDEO_THEMES.find((item) => item.key === series.style);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">{series.title}</h1>
          <p className="text-sm text-white/70">
            Style: {theme?.label} · Format: {series.format} · Tone: {series.tone}
          </p>
        </div>
        <Link href="/series">
          <SecondaryButton>Retour series</SecondaryButton>
        </Link>
      </div>

      <Card title="Nouvel episode">
        <form onSubmit={createEpisode} className="grid gap-3 md:grid-cols-3">
          <Input
            label="Titre episode"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <Input
            label="Numero"
            type="number"
            min={1}
            value={episodeNumber}
            onChange={(e) => setEpisodeNumber(Number(e.target.value))}
            required
          />
          <div className="flex items-end">
            <PrimaryButton type="submit">Creer episode</PrimaryButton>
          </div>
        </form>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Personnages">{series.characters.length} personnage(s)</Card>
        <Card title="Environnements">{series.environments.length} environnement(s)</Card>
        <Card title="Episodes">{series.episodes.length} episode(s)</Card>
      </div>

      <Card title="Episodes">
        <div className="space-y-3">
          {series.episodes.length === 0 ? (
            <p className="text-sm text-white/70">Aucun episode.</p>
          ) : (
            series.episodes.map((episode) => (
              <div key={episode.id} className="rounded-xl border border-white/10 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">
                      Episode {episode.episodeNumber}: {episode.title}
                    </p>
                    <p className="text-sm text-white/70">Step: {episode.currentStep}</p>
                  </div>
                  <Link href={`/series/${series.id}/episodes/${episode.id}`}>
                    <SecondaryButton>Ouvrir pipeline</SecondaryButton>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
