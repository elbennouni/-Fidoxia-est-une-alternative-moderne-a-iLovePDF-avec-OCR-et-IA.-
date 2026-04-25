import ProducerModePanel from "@/components/chatbot/ProducerModePanel";

export default async function SeriesContextLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="max-w-[1800px] mx-auto px-4 py-8 xl:grid xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-6 xl:items-start">
      <div className="min-w-0">
        {children}
      </div>
      <div className="hidden xl:block xl:sticky xl:top-20 self-start">
        <ProducerModePanel
          variant="series-compact"
          seriesId={id}
          integrated
        />
      </div>
    </div>
  );
}
