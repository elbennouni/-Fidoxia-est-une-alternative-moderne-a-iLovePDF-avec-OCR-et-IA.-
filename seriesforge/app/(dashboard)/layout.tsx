import Navbar from "@/components/ui/Navbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navbar />
      <div className="pt-16">
        <main>{children}</main>
      </div>
    </div>
  );
}
