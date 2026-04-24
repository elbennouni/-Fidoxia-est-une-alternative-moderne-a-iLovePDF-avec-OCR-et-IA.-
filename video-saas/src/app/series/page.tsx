"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Card, Input, Select, StatCard } from "@/components/ui";
import { VIDEO_THEMES, type VideoThemeKey } from "@/lib/video-themes";

type SeriesItem = {
  id: string;
  title: string;
  style: string;
  format: string;
  tone: string;
  defaultDuration: number;
  _count: {
    episodes: number;
    characters: number;
    environments: number;
  };
};

const FORMAT_OPTIONS = [
  { value: "VERTICAL_9_16", label: "Vertical 9:16 (TikTok)" },
  { value: "HORIZONTAL_16_9", label: "Horizontal 16:9 (YouTube)" },
];

export default function SeriesPage() {
  const [series, setSeries] = useState<SeriesItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{
    title: string;
    style: VideoThemeKey;
    format: "VERTICAL_9_16" | "HORIZONTAL_16_9";
    defaultDuration: string;
    tone: string;
  }>({
    title: "",
    style: VIDEO_THEMES[0].key,
    format: "VERTICAL_9_16",
    defaultDuration: "60",
    tone: "drama",
  });

  async function loadSeries() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/series");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Erreur chargement series");
      }
      setSeries(data.series ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSeries();
  }, []);

  async function createSeries(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const response = await fetch("/api/series", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        defaultDuration: Number(form.defaultDuration),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Creation impossible");
      return;
    }
    setForm({
      title: "",
      style: VIDEO_THEMES[0].key,
      format: "VERTICAL_9_16",
      defaultDuration: "60",
      tone: "drama",
    });
    await loadSeries();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Series list</h1>
      <p className="text-sm text-zinc-600">
        Etape 1 - Series setup. Definis le style, le format, la duree et le ton de la serie.
      </p>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total series" value={series.length} />
        <StatCard
          label="Episodes"
          value={series.reduce((acc, item) => acc + item._count.episodes, 0)}
        />
        <StatCard
          label="Characters"
          value={series.reduce((acc, item) => acc + item._count.characters, 0)}
        />
        <StatCard
          label="Environments"
          value={series.reduce((acc, item) => acc + item._count.environments, 0)}
        />
      </div>

      <Card title="Create a new series">
        <form onSubmit={createSeries} className="grid gap-3 md:grid-cols-2">
          <Input
            label="Title"
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            required
          />
          <Select
            label="Style"
            value={form.style}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, style: event.target.value as VideoThemeKey }))
            }
            options={VIDEO_THEMES.map((theme) => ({
              value: theme.key,
              label: `${theme.label} - ${theme.description}`,
            }))}
          />
          <Select
            label="Format"
            value={form.format}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                format: event.target.value as "VERTICAL_9_16" | "HORIZONTAL_16_9",
              }))
            }
            options={FORMAT_OPTIONS}
          />
          <Input
            label="Default duration (sec)"
            type="number"
            value={form.defaultDuration}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, defaultDuration: event.target.value }))
            }
            required
          />
          <Input
            label="Tone"
            value={form.tone}
            onChange={(event) => setForm((prev) => ({ ...prev, tone: event.target.value }))}
            required
          />
          <div className="md:col-span-2">
            <Button type="submit">Create series</Button>
          </div>
        </form>
      </Card>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        {loading ? (
          <Card>
            <p className="text-sm">Chargement...</p>
          </Card>
        ) : series.length === 0 ? (
          <Card>
            <p className="text-sm text-zinc-600">Aucune serie pour le moment.</p>
          </Card>
        ) : (
          series.map((item) => (
            <Card key={item.id} title={item.title}>
              <div className="space-y-2 text-sm text-zinc-700">
                <p>Style: {item.style}</p>
                <p>Format: {item.format}</p>
                <p>Tone: {item.tone}</p>
                <p>Duration: {item.defaultDuration}s</p>
                <p>
                  Assets: {item._count.characters} persos, {item._count.environments} envs
                </p>
              </div>
              <div className="mt-3 flex gap-2">
                <Link href={`/series/${item.id}`}>
                  <Button variant="secondary">Open series</Button>
                </Link>
                <Link href={`/series/${item.id}`}>
                  <Button variant="ghost">Episodes</Button>
                </Link>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
