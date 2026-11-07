import { SITE_URL } from "@/lib/public";

/**
 * Search engines and AI search tools may read the public pages (home, books,
 * public profiles, invites, legal); the signed-in app stays out. Readers'
 * reviews are theirs, so AI training crawlers are kept out and the
 * Content-Signal line says the same: search and answers yes, training no.
 */
const PRIVATE = ["/feed", "/you", "/shelf", "/search", "/add", "/scan", "/import", "/sharpen", "/rank/", "/notifications", "/people", "/welcome", "/start", "/login", "/wrap/", "/u/*/shelf", "/u/*/follows"];
const PUBLIC = ["/", "/book/", "/u/", "/join/", "/privacy", "/terms", "/llms.txt"];

// Crawlers that collect pages to train AI models.
const TRAINING = ["GPTBot", "ClaudeBot", "Google-Extended", "Applebot-Extended", "CCBot", "meta-externalagent", "Bytespider"];
// AI search and answer tools that cite and link back.
const AI_SEARCH = ["OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User"];

function group(agents: string[], lines: string[]) {
  return [...agents.map((a) => `User-agent: ${a}`), ...lines].join("\n");
}

export function GET() {
  const rules = [...PUBLIC.map((p) => `Allow: ${p}`), ...PRIVATE.map((p) => `Disallow: ${p}`)];
  const body = [
    "# readread: rank books, not stars. https://readread.app",
    "# Content signals (https://contentsignals.org): search=yes, ai-input=yes, ai-train=no",
    "",
    group(["*"], ["Content-Signal: search=yes, ai-input=yes, ai-train=no", ...rules]),
    "",
    group(AI_SEARCH, rules),
    "",
    group(TRAINING, ["Disallow: /"]),
    "",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
