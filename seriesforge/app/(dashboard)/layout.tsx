import Navbar from "@/components/ui/Navbar";
import ProducerModePanel from "@/components/chatbot/ProducerModePanel";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navbar />
      <div className="pt-16 xl:pr-[420px]">
        <main>{children}</main>
      </div>
      <ProducerModePanel />
    </div>
  );
}
