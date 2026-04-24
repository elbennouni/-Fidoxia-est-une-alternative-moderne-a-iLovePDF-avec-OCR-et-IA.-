"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Card, Page, PrimaryButton, SecondaryButton } from "@/components/ui";

type Frame = {
  id: string;
  prompt: string;
  imageUrl: string;
  provider: string;
  scene: {
    sceneOrder: number;
    action: string;
    emotion: string;
  };
};

export default function EpisodeStoryboardPage({
  params,
}: {
  params: Promise<{ seriesId: string; episodeId: string }>;
}) {
  const [seriesId, setSeriesId] = useState("");
  const [episodeId, setEpisodeId] = useState("");
  const [frames, setFrames] = useState<Frame[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((resolved) => {
      setSeriesId(resolved.seriesId);
      setEpisodeId(resolved.episodeId);
    });
  }, [params]);

  async function load() {
    if (!seriesId || !episodeId) return;
    const response = await fetch(`/api/series/${seriesId}/episodes/${episodeId}/storyboard`);
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Storyboard indisponible.");
      setFrames([]);
      return;
    }
    setError(null);
    setFrames(data.frames ?? []);
  }

  useEffect(() => {
    void load();
  }, [seriesId, episodeId]);

  return (
    <Page
      title="Storyboard viewer episode"
      subtitle="Frames image-first pour controle visuel avant audio/video."
      actions={
        <div className="flex gap-2">
          <SecondaryButton onClick={() => void load()}>Rafraichir</SecondaryButton>
          <Link href={`/series/${seriesId}/episodes/${episodeId}`}>
            <PrimaryButton>Retour editeur episode</PrimaryButton>
          </Link>
        </div>
      }
    >
      {error ? <Card className="text-sm text-red-300">{error}</Card> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {frames.map((frame) => (
          <Card key={frame.id} title={`Scene ${frame.scene.sceneOrder} (${frame.provider})`}>
            <div className="mb-3 overflow-hidden rounded-lg border border-white/10">
              <Image
                src={frame.imageUrl}
                alt={`Scene ${frame.scene.sceneOrder}`}
                width={1080}
                height={1920}
                className="h-72 w-full object-cover"
                unoptimized
              />
            </div>
            <p className="text-sm text-white/80">{frame.scene.action}</p>
            <p className="text-xs text-white/60">Emotion: {frame.scene.emotion}</p>
            <details className="mt-2 text-xs text-white/70">
              <summary className="cursor-pointer">Voir prompt</summary>
              <pre className="mt-2 whitespace-pre-wrap rounded bg-black/40 p-2">{frame.prompt}</pre>
            </details>
          </Card>
        ))}
        {frames.length === 0 && !error ? (
          <Card className="text-sm text-white/70">Aucun frame genere pour cet episode.</Card>
        ) : null}
      </div>
    </Page>
  );
}
