import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import ApiKeyFetchBridge from "@/components/providers/ApiKeyFetchBridge";

export const metadata: Metadata = {
  title: "SeriesForge AI - Generate Animated Series",
  description: "Create AI-powered animated series with intelligent multi-agent pipeline",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-[#0a0a0f] text-gray-100">
        <ApiKeyFetchBridge />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#1e1e2e",
              color: "#f0f0ff",
              border: "1px solid #2a2a3e",
            },
          }}
        />
        {children}
      </body>
    </html>
  );
}
