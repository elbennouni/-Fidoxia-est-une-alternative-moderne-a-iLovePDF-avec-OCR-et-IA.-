# AI Video Series SaaS

SaaS complet Next.js pour generer des episodes video IA avec pipeline strict:

1. Series setup
2. Characters
3. Environments
4. Story generation (OpenAI + fallback)
5. Storyboard (image-first)
6. Audio layer + validation obligatoire
7. Video generation (Kling/Replicate/Other)

## Styles video inclus (10 themes)

- Pixar 3D
- Anime
- Cinematique
- Fruit Drama
- Dessin anime 2D
- Realiste
- Low Poly
- Stop Motion
- Sci-Fi Neon
- Documentaire anime

## Stack

- Next.js App Router + TypeScript
- API routes Node.js
- Prisma + SQLite
- Auth JWT cookie
- Architecture modulaire (lib/services/routes/pages)

## Installation

```bash
npm install
npx prisma migrate dev --name init
npx prisma generate
```

## Lancement local

```bash
npm run dev
```

## Verification production

```bash
npm run lint
npm run build
```

## Pages UI disponibles

- /login
- /register
- /dashboard
- /series
- /characters
- /environments
- /story
- /storyboard
- /audio
- /video
- /library

Pages detail episode:

- /series/[seriesId]/episodes/[episodeId]
- /series/[seriesId]/episodes/[episodeId]/storyboard
- /series/[seriesId]/episodes/[episodeId]/audio
- /series/[seriesId]/episodes/[episodeId]/video

## Variables d'environnement

Configurer `.env`:

```bash
DATABASE_URL="file:./dev.db"
AUTH_SECRET="change-this-secret"
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4.1-mini"
```

Si `OPENAI_API_KEY` est vide, la generation story fonctionne en mode fallback.
