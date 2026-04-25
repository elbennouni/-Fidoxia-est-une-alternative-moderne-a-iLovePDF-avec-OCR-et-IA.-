import Navbar from "@/components/ui/Navbar";
import ProducerModePanel from "@/components/chatbot/ProducerModePanel";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navbar />
      <div className="pt-16 xl:pr-[444px]">
        <main>{children}</main>
      </div>
      <div className="hidden xl:block fixed top-20 right-4 z-40 w-[420px] max-h-[calc(100vh-96px)] overflow-y-auto">
        <ProducerModePanel />
      </div>
    </div>
  );
}
