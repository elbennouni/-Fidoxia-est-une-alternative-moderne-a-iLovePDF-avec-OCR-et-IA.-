"use client";

import { useEffect, useState } from "react";
import { Card, EmptyState, Field, Select, SectionTitle, TextArea } from "@/components/ui";

type Series = {
  id: string;
  title: string;
};

type Environment = {
  id: string;
  locationName: string;
  visualDescription: string;
  lighting: string;
  mood: string;
  reusable: boolean;
};

export default function EnvironmentsPage() {
  const [series, setSeries] = useState<Series[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState("");
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({
    locationName: "",
    visualDescription: "",
    lighting: "",
    mood: "",
    reusable: true,
  });

  async function loadSeries() {
    const res = await fetch("/api/series");
    const data = await res.json();
    setSeries(data.series ?? []);
    if (!selectedSeriesId && data.series?.[0]) {
      setSelectedSeriesId(data.series[0].id);
    }
  }

  async function loadEnvironments(seriesId: string) {
    if (!seriesId) return;
    const res = await fetch(`/api/series/${seriesId}/environments`);
    const data = await res.json();
    setEnvironments(data.environments ?? []);
  }

  useEffect(() => {
    loadSeries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadEnvironments(selectedSeriesId);
  }, [selectedSeriesId]);

  async function createEnvironment(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Creation environnement...");
    const res = await fetch(`/api/series/${selectedSeriesId}/environments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = await res.json();
      setStatus(data.error ?? "Erreur creation environnement");
      return;
    }
    setForm({
      locationName: "",
      visualDescription: "",
      lighting: "",
      mood: "",
      reusable: true,
    });
    await loadEnvironments(selectedSeriesId);
    setStatus("Environnement cree.");
  }

  return (
    <main className="space-y-6">
      <SectionTitle
        title="Environment manager"
        subtitle="STEP 3 — lieux reutilisables pour coherence et caching."
      />

      <Card>
        <h2 className="text-lg font-semibold mb-4">Ajouter un environnement</h2>
        <form onSubmit={createEnvironment} className="grid gap-3 md:grid-cols-2">
          <Select
            label="Serie"
            value={selectedSeriesId}
            onChange={(e) => setSelectedSeriesId(e.target.value)}
            options={series.map((item) => ({ label: item.title, value: item.id }))}
          />
          <Field
            label="Location name"
            value={form.locationName}
            onChange={(e) => setForm((prev) => ({ ...prev, locationName: e.target.value }))}
          />
          <TextArea
            label="Description visuelle stricte"
            value={form.visualDescription}
            onChange={(e) => setForm((prev) => ({ ...prev, visualDescription: e.target.value }))}
          />
          <Field
            label="Lighting"
            value={form.lighting}
            onChange={(e) => setForm((prev) => ({ ...prev, lighting: e.target.value }))}
          />
          <Field
            label="Mood"
            value={form.mood}
            onChange={(e) => setForm((prev) => ({ ...prev, mood: e.target.value }))}
          />
          <Select
            label="Reusable"
            value={String(form.reusable)}
            onChange={(e) => setForm((prev) => ({ ...prev, reusable: e.target.value === "true" }))}
            options={[
              { label: "Oui", value: "true" },
              { label: "Non", value: "false" },
            ]}
          />
          <button className="btn-primary md:col-span-2" type="submit">
            Creer environnement
          </button>
        </form>
        {status && <p className="mt-3 text-sm text-slate-300">{status}</p>}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {environments.map((item) => (
          <Card key={item.id}>
            <p className="text-lg font-semibold">{item.locationName}</p>
            <p className="text-sm text-slate-300 mt-1">{item.visualDescription}</p>
            <p className="text-xs text-slate-400 mt-2">Lighting: {item.lighting}</p>
            <p className="text-xs text-slate-400">Mood: {item.mood}</p>
            <p className="text-xs text-slate-400">Reusable: {item.reusable ? "Oui" : "Non"}</p>
          </Card>
        ))}
      </div>

      {environments.length === 0 && <EmptyState title="Aucun environnement" subtitle="Cree tes premiers lieux." />}
    </main>
  );
}
