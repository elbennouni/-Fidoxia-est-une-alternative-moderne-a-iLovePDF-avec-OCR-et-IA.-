"use client";

import ProducerModePanel from "@/components/chatbot/ProducerModePanel";

export default function EpisodeWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6 items-start">
        <div>{children}</div>
        <div className="xl:sticky xl:top-24 self-start">
          <ProducerModePanel
            variant="episode-full"
          />
        </div>
      </div>
    </div>
  );
}
