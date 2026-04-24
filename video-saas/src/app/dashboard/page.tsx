"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Page, SectionCard, StatCard } from "@/components/ui";

type DashboardData = {
  stats: {
    seriesCount: number;
    episodeCount: number;
    sceneCount: number;
    videoCount: number;
    assetCount: number;
  };
  recentSeries: Array<{
    id: string;
    title: string;
    style: string;
    format: string;
    tone: string;
    updatedAt: string;
    episodes: Array<{
      id: string;
      title: string;
      episodeNumber: number;
      currentStep: string;
    }>;
  }>;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      const response = await fetch("/api/dashboard");
      if (!response.ok) {
        setError("Impossible de charger le dashboard.");
        return;
      }
      setData((await response.json()) as DashboardData);
    };
    void load();
  }, []);

  return (
    <Page
      title="Dashboard SaaS"
      subtitle="Pipeline strict: Script -> Storyboard -> Audio -> Video"
      actions={
        <Link className="btn btn-primary" href="/series">
          Gerer les series
        </Link>
      }
    >
      {error ? <div className="alert-error">{error}</div> : null}
      <div className="grid grid-cols-5">
        <StatCard label="Series" value={data?.stats.seriesCount ?? "-"} />
        <StatCard label="Episodes" value={data?.stats.episodeCount ?? "-"} />
        <StatCard label="Scenes" value={data?.stats.sceneCount ?? "-"} />
        <StatCard label="Videos" value={data?.stats.videoCount ?? "-"} />
        <StatCard label="Assets" value={data?.stats.assetCount ?? "-"} />
      </div>
      <SectionCard
        title="Series recentes"
        subtitle="Clique sur une serie pour ouvrir le pipeline episode"
      >
        <div className="list">
          {(data?.recentSeries ?? []).map((series) => (
            <div className="item" key={series.id}>
              <div>
                <p className="item-title">{series.title}</p>
                <p className="item-subtitle">
                  {series.style} • {series.tone} • {series.format}
                </p>
              </div>
              <div className="row gap-8">
                {series.episodes[0] ? (
                  <span className="badge">
                    Ep {series.episodes[0].episodeNumber} - {series.episodes[0].currentStep}
                  </span>
                ) : (
                  <span className="badge badge-muted">Aucun episode</span>
                )}
                <Link className="btn btn-secondary" href={`/series/${series.id}`}>
                  Ouvrir
                </Link>
              </div>
            </div>
          ))}
          {(data?.recentSeries ?? []).length === 0 ? (
            <p className="muted">Aucune serie pour le moment.</p>
          ) : null}
        </div>
      </SectionCard>
    </Page>
  );
}
