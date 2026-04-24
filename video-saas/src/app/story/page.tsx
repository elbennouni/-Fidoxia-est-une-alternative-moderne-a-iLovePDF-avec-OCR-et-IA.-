import Link from "next/link";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, EmptyState, Page, SectionTitle, Table } from "@/components/ui";

type StoryEpisode = {
  id: string;
  episodeNumber: number;
  title: string;
  series: {
    id: string;
    title: string;
  };
  scenes: Array<{
    sceneOrder: number;
    action: string;
    emotion: string;
    location: string;
  }>;
};

export default async function StoryPage() {
  const userId = await requireUserId();
  const episodes: StoryEpisode[] = userId
    ? await prisma.episode.findMany({
        where: { series: { userId } },
        include: {
          series: { select: { id: true, title: true } },
          scenes: {
            orderBy: { sceneOrder: "asc" },
            take: 3,
          },
        },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  return (
    <Page title="Story Editor">
      <SectionTitle
        title="Scripts structures"
        subtitle="Chaque scene contient action, personnages, emotion et location."
      />

      {episodes.length === 0 ? (
        <EmptyState
          title="Aucun episode disponible"
          description="Cree une serie puis un episode pour lancer la generation de story."
        />
      ) : (
        <div className="space-y-4">
          {episodes.map((episode) => (
            <Card key={episode.id}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">{episode.series.title}</h3>
                  <p className="text-sm text-zinc-400">
                    Episode #{episode.episodeNumber} — {episode.title}
                  </p>
                </div>
                <Link
                  href={`/series/${episode.series.id}/episodes/${episode.id}`}
                  className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
                >
                  Ouvrir l&apos;editeur
                </Link>
              </div>
              <Table
                headers={["Scene", "Action", "Emotion", "Lieu"]}
                rows={episode.scenes.map((scene) => [
                  `#${scene.sceneOrder}`,
                  scene.action,
                  scene.emotion,
                  scene.location,
                ])}
              />
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}
