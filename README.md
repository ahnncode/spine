# ReadRead

Rank books, not stars. Every book you finish goes head-to-head with ones you've read, and lands on an honest, ranked shelf with a score that means something.

This is the core-loop build: sign-in, Goodreads import, book search, the ranking flow, quick "sharpen" matchups, and your shelf. Social features (feed, friends, taste match, streaks) come next.

## Stack

- **Next.js 16** (App Router, TypeScript), hosted on Netlify
- **Supabase** for email sign-in and Postgres, protected by row-level security
- **Open Library** for book search and cover art (no API key needed)

## Setup

1. **Create a Supabase project** at supabase.com.
2. **Run the schema.** In the Supabase dashboard, open SQL Editor, paste `supabase/migrations/20261102170000_core.sql`, and run it.
3. **Allow sign-in redirects.** Under Authentication → URL Configuration, set the Site URL to your deployed URL and add `http://localhost:3000/**` (and your Netlify URL with `/**`) to Redirect URLs.
4. **Add your keys.** Copy `.env.example` to `.env.local` and fill in the project URL and anon key from Project Settings → API.
5. **Run it.**
   ```bash
   npm install
   npm run dev
   ```

## Deploy to Netlify

Import the GitHub repo in Netlify; it detects Next.js automatically. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` under Site configuration → Environment variables, then deploy.

## How ranking works

- You first say how a book landed: **Loved it** (6.7–10), **It was fine** (3.4–6.6) or **Not for me** (0–3.3).
- The app then runs a binary search against books already in that bucket, so placing a book among 100 others takes at most 7 head-to-heads.
- Scores come from position: the best book in a bucket gets the top of its range and the rest spread evenly below. Ranking one book can nudge others' scores, the way Beli works.
- **Goodreads import:** 4–5 stars → Loved, 3 → Fine, 1–2 → Not for me, unrated reads → "To rank", to-read and currently-reading → Want to read. Within a bucket, books start ordered by stars, then by Goodreads' community average. They're flagged as rough until you sharpen them with quick matchups of neighbouring books.

Code map: `src/lib/ranking.ts` (placement and scoring), `src/lib/goodreads.ts` (CSV parsing), `src/lib/data.ts` (Supabase reads and writes), `src/app/*` (screens).

## Scripts

- `npm run dev` — local dev server
- `npm test` — unit tests for ranking, scoring and the Goodreads parser
- `npm run build` — production build
