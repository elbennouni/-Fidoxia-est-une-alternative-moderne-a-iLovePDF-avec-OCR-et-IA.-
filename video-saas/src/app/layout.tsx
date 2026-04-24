import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/nav";
import { LogoutButton } from "@/components/logout-button";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Series Video SaaS",
  description: "Pipeline complet Script > Storyboard > Audio > Video",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const hideShell = false;
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100">
        {!hideShell ? (
          <>
            <NavBar />
            <div className="mx-auto flex w-full max-w-6xl justify-end px-6 pt-3">
              <LogoutButton />
            </div>
          </>
        ) : null}
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
