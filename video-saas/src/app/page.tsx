import Link from "next/link";
import { VIDEO_THEMES } from "@/lib/video-themes";
import { Card, PageShell, SectionTitle } from "@/components/ui";

export default function HomePage() {
  return (
    <PageShell>
      <section className="space-y-6">
        <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">AI Video Series SaaS</p>
        <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
          Genere des episodes coherents, automatiquement, etape par etape.
        </h1>
        <p className="max-w-3xl text-white/70">
          Pipeline obligatoire: Script → Storyboard → Audio → Video. Le systeme enforce la
          coherence des personnages, des outfits, du style visuel et des environnements.
        </p>
        <div className="flex gap-3">
          <Link className="btn-primary" href="/register">
            Commencer
          </Link>
          <Link className="btn-secondary" href="/login">
            Se connecter
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle
          title="10 themes styles video inclus"
          subtitle="Pixar 3D, anime, cinematique, fruit drama, et 6 autres themes."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {VIDEO_THEMES.map((theme) => (
            <Card key={theme.key} className="space-y-2">
              <p className="text-sm font-semibold text-white">{theme.label}</p>
              <p className="text-sm text-white/70">{theme.description}</p>
            </Card>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
