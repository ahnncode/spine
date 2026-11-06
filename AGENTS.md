<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Shipping

readread deploys once a day. Commit and push work to the `dev` branch, never
straight to `main`. `.github/workflows/daily-deploy.yml` moves `dev` onto
`main` at 09:07 UTC when there's anything new, and Netlify deploys `main`.
Netlify skips every other branch (see `netlify.toml`). To ship sooner, run
"Daily deploy" from the GitHub Actions tab.

Database changes the new code needs must be run in the Supabase SQL Editor
before the next daily deploy.
