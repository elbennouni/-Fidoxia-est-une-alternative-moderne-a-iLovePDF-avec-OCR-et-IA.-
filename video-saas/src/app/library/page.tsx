"use client";

import { useEffect, useState } from "react";
import { Card, Input, Pill, PrimaryButton, SectionTitle } from "@/components/ui";

type SeriesOption = { id: string; title: string };
type LibraryAsset = {
  id: string;
  type: string;
  name: string;
  description: string;
  fileUrl: string;
  reusable: boolean;
  seriesId: string | null;
};

export default function LibraryPage() {
  const [series, setSeries] = useState<SeriesOption[]>([]);
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    seriesId: "",
    type: "INTRO",
    name: "",
    description: "",
    fileUrl: "",
    reusable: true,
    metadata: "",
  });

  async function load() {
    const [seriesRes, assetsRes] = await Promise.all([fetch("/api/series"), fetch("/api/library")]);
    if (!seriesRes.ok || !assetsRes.ok) {
      throw new Error("Impossible de charger la bibliotheque.");
    }
    const seriesJson = await seriesRes.json();
    const assetsJson = await assetsRes.json();
    setSeries(seriesJson.series ?? []);
    setAssets(assetsJson.assets ?? []);
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const response = await fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        seriesId: form.seriesId || undefined,
      }),
    });
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      setError(json.error ?? "Creation asset echouee.");
      return;
    }
    setForm({
      seriesId: "",
      type: "INTRO",
      name: "",
      description: "",
      fileUrl: "",
      reusable: true,
      metadata: "",
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Asset Library reutilisable"
        subtitle="Intros, outros, scenes recurrentes, transitions, musique et SFX."
      />
      <div className="flex flex-wrap gap-2">
        <Pill>INTRO</Pill>
        <Pill>OUTRO</Pill>
        <Pill>RECURRING_SCENE</Pill>
        <Pill>TRANSITION</Pill>
        <Pill>MUSIC</Pill>
        <Pill>SFX</Pill>
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold">Ajouter un asset reutilisable</h2>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={onCreate}>
          <label className="text-sm">
            Type
            <select
              className="mt-1 w-full rounded border border-white/15 bg-black/30 px-3 py-2 text-sm"
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
            >
              <option value="INTRO">INTRO</option>
              <option value="OUTRO">OUTRO</option>
              <option value="RECURRING_SCENE">RECURRING_SCENE</option>
              <option value="TRANSITION">TRANSITION</option>
              <option value="MUSIC">MUSIC</option>
              <option value="SFX">SFX</option>
            </select>
          </label>

          <label className="text-sm">
            Serie liee (optionnel)
            <select
              className="mt-1 w-full rounded border border-white/15 bg-black/30 px-3 py-2 text-sm"
              value={form.seriesId}
              onChange={(e) => setForm((prev) => ({ ...prev, seriesId: e.target.value }))}
            >
              <option value="">Global utilisateur</option>
              {series.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>

          <Input
            label="Nom"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            required
          />
          <Input
            label="URL fichier"
            value={form.fileUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, fileUrl: e.target.value }))}
            required
          />
          <Input
            label="Metadata (optionnel)"
            value={form.metadata}
            onChange={(e) => setForm((prev) => ({ ...prev, metadata: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={form.reusable}
              onChange={(e) => setForm((prev) => ({ ...prev, reusable: e.target.checked }))}
            />
            Reutilisable sans regeneration
          </label>
          <div className="md:col-span-2">
            <PrimaryButton type="submit">Ajouter a la library</PrimaryButton>
          </div>
        </form>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Assets disponibles ({assets.length})</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {assets.map((asset) => (
            <div key={asset.id} className="rounded border border-white/10 bg-black/30 p-3 text-sm">
              <p className="font-semibold">
                [{asset.type}] {asset.name}
              </p>
              <p className="text-white/70">{asset.description}</p>
              <p className="text-xs text-cyan-300">{asset.fileUrl}</p>
              <p className="text-xs text-white/60">
                Scope: {asset.seriesId ? "Serie" : "Global"} | Reusable: {asset.reusable ? "oui" : "non"}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
