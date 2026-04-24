"use client";

import { use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AudioPage from "@/app/audio/page";
import { SecondaryButton } from "@/components/ui";

export default function EpisodeAudioWrapper({
  params,
}: {
  params: Promise<{ seriesId: string; episodeId: string }>;
}) {
  const { seriesId, episodeId } = use(params);
  const searchParams = useSearchParams();
  const qs = searchParams.toString();

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Link href={`/series/${seriesId}/episodes/${episodeId}`}>
          <SecondaryButton>Retour episode</SecondaryButton>
        </Link>
        <Link href={`/audio?seriesId=${seriesId}&episodeId=${episodeId}${qs ? `&${qs}` : ""}`}>
          <SecondaryButton>Ouvrir en plein ecran</SecondaryButton>
        </Link>
      </div>
      <AudioPage />
    </div>
  );
}
