"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/series", label: "Series" },
  { href: "/characters", label: "Characters" },
  { href: "/environments", label: "Environments" },
  { href: "/story", label: "Story" },
  { href: "/storyboard", label: "Storyboard" },
  { href: "/audio", label: "Audio" },
  { href: "/video", label: "Video" },
  { href: "/library", label: "Library" },
];

export function NavBar() {
  const pathname = usePathname();
  const hiddenOn = new Set(["/", "/login", "/register"]);
  if (hiddenOn.has(pathname)) {
    return null;
  }

  return (
    <header className="border-b border-white/10 bg-black/40 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-lg font-semibold text-white">
            Viral Episodes SaaS
          </Link>
          <span className="hidden text-xs text-white/60 md:inline">Script → Storyboard → Audio → Video</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {links.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-1.5 ${
                  active ? "bg-cyan-500 text-black" : "text-white/80 hover:bg-white/10"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <LogoutButton />
        </div>
      </nav>
    </header>
  );
}
