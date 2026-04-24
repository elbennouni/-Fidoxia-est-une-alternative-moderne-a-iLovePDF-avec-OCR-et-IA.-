"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Grid, Input, SectionTitle, Select, TextArea } from "@/components/ui";

type Series = {
  id: string;
  title: string;
};

type Character = {
  id: string;
  name: string;
  physicalDescription: string;
  outfit: string;
  personality: string;
  voiceProvider: "HEYGEN" | "FALLBACK";
  voiceConfig: string;
  consistencyId: string;
};

const defaultForm = {
  name: "",
  physicalDescription: "",
  outfit: "",
  personality: "",
  voiceProvider: "FALLBACK",
  voiceConfig: "",
  referenceImage: "",
  consistencyId: "",
};

export default function CharactersPage() {
  const [series, setSeries] = useState<Series[]>([]);
  const [selectedSeries, setSelectedSeries] = useState("");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [message, setMessage] = useState("");

  const selectedSeriesTitle = useMemo(
    () => series.find((item) => item.id === selectedSeries)?.title ?? "",
    [series, selectedSeries],
  );

  async function loadSeries() {
    const res = await fetch("/api/series");
    if (!res.ok) return;
    const data = await res.json();
    setSeries(data.series ?? []);
    if (!selectedSeries && data.series?.length > 0) {
      setSelectedSeries(data.series[0].id);
    }
  }

  async function loadCharacters(seriesId: string) {
    const res = await fetch(`/api/series/${seriesId}/characters`);
    if (!res.ok) return;
    const data = await res.json();
    setCharacters(data.characters ?? []);
  }

  useEffect(() => {
    void loadSeries();
  }, []);

  useEffect(() => {
    if (selectedSeries) {
      void loadCharacters(selectedSeries);
    } else {
      setCharacters([]);
    }
  }, [selectedSeries]);

  async function onCreateCharacter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedSeries) return;

    const res = await fetch(`/api/series/${selectedSeries}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error ?? "Creation personnage impossible");
      return;
    }
    setMessage("Personnage cree.");
    setForm(defaultForm);
    void loadCharacters(selectedSeries);
  }

  return (
    <main className="space-y-6">
      <SectionTitle
        title="Character manager (Step 2)"
        subtitle="Descriptions strictes + outfit lock + consistency ID obligatoires."
      />

      {message ? <p className="text-sm text-indigo-200">{message}</p> : null}

      <Card>
        <label className="text-sm text-slate-300">Serie cible</label>
        <Select value={selectedSeries} onChange={(e) => setSelectedSeries(e.target.value)}>
          <option value="">Selectionner une serie</option>
          {series.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </Select>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-white">
          Nouveau personnage {selectedSeriesTitle ? `pour "${selectedSeriesTitle}"` : ""}
        </h3>
        <form className="mt-4 space-y-3" onSubmit={onCreateCharacter}>
          <Input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Nom"
            required
          />
          <TextArea
            value={form.physicalDescription}
            onChange={(e) => setForm((prev) => ({ ...prev, physicalDescription: e.target.value }))}
            placeholder="Description physique stricte"
            required
          />
          <TextArea
            value={form.outfit}
            onChange={(e) => setForm((prev) => ({ ...prev, outfit: e.target.value }))}
            placeholder="Outfit verrouille"
            required
          />
          <TextArea
            value={form.personality}
            onChange={(e) => setForm((prev) => ({ ...prev, personality: e.target.value }))}
            placeholder="Personnalite"
            required
          />
          <Grid cols={2}>
            <Select
              value={form.voiceProvider}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, voiceProvider: e.target.value as "HEYGEN" | "FALLBACK" }))
              }
            >
              <option value="FALLBACK">Fallback</option>
              <option value="HEYGEN">HeyGen</option>
            </Select>
            <Input
              value={form.consistencyId}
              onChange={(e) => setForm((prev) => ({ ...prev, consistencyId: e.target.value }))}
              placeholder="Consistency ID"
              required
            />
          </Grid>
          <Input
            value={form.voiceConfig}
            onChange={(e) => setForm((prev) => ({ ...prev, voiceConfig: e.target.value }))}
            placeholder="Voice config (HeyGen ID, timbre...)"
            required
          />
          <Input
            value={form.referenceImage}
            onChange={(e) => setForm((prev) => ({ ...prev, referenceImage: e.target.value }))}
            placeholder="URL image reference (optionnel)"
          />
          <Button type="submit" disabled={!selectedSeries}>
            Creer personnage
          </Button>
        </form>
      </Card>

      <Grid cols={2}>
        {characters.map((character) => (
          <Card key={character.id}>
            <div className="flex items-center justify-between">
              <h4 className="text-white font-semibold">{character.name}</h4>
              <Badge>{character.consistencyId}</Badge>
            </div>
            <p className="mt-2 text-sm text-slate-300">{character.physicalDescription}</p>
            <p className="mt-2 text-sm text-slate-400">Outfit: {character.outfit}</p>
            <p className="mt-2 text-sm text-slate-400">Voix: {character.voiceProvider}</p>
          </Card>
        ))}
      </Grid>
    </main>
  );
}
