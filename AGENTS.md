<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Shipping

readread deploys every other day. Commit and push work to the `dev` branch,
never straight to `main`. `.github/workflows/daily-deploy.yml` moves `dev`
onto `main` at 09:07 UTC every second night (when the days since 1970 are
even) if there's anything new, and Netlify deploys `main`. Netlify skips every
other branch (see `netlify.toml`). To ship sooner, run "Deploy" from the
GitHub Actions tab.

Database changes the new code needs must be run in the Supabase SQL Editor
before the next deploy.

## Design

The brand book (design system artifact "readread": https://claude.ai/artifact/DjZSjH7WAjRvdxB3eWhbcQ) is the source of truth for colour, type, spacing and voice. In code:

- Colours come from the tokens in `src/app/globals.css`. No hex in components except illustration palettes (`books.ts`, `genres.ts`, `clubs.ts`, `avatars.ts`). Text on `panel` or cobalt cards uses the `--on-panel*` tokens.
- Font sizes: 12, 13, 14, 15, 16, 17, 20, 24, 28, 36, 44, 52 (64/96/132 for illustration-sized numbers). Weights stop at 700.
- Radii: `--radius-xs/s/m/l/sheet/pill`. Anything round uses `--radius-pill`.
- It must feel made by people, not generated:
  - Lists and feed posts sit on the page with hairline dividers; one or two cards per screen at most.
  - At most one sentence-case `eyebrow` per screen; never uppercase tracked labels.
  - No formula copy: no "X, not Y" (except the tagline), no punchy fragment subheads, no paragraphs that summarise what faces or covers could show. Prefer specific lines built from the reader's data.
  - Motion with personality only in the ranking matchup; one hand-drawn touch (the #1 circle). Don't add more of either without removing one.
