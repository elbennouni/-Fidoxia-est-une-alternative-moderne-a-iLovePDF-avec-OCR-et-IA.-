import ProducerModePanel from "@/components/chatbot/ProducerModePanel";

export default async function EpisodeWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="xl:pr-[444px]">
      {children}
      <div className="hidden xl:block fixed top-20 right-4 z-40 w-[420px] max-h-[calc(100vh-96px)] overflow-y-auto">
        <ProducerModePanel
          variant="episode-full"
          episodeId={id}
        />
      </div>
    </div>
  );
}
