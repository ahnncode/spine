import type { NextRequest } from "next/server";

/**
 * Same-origin copy of a book cover, so the browser can read its colours to
 * tint the book page. Open Library covers redirect to archive.org, which
 * doesn't allow cross-origin reads. Only known cover hosts are fetched.
 */
const ALLOWED = [/^covers\.openlibrary\.org$/, /(^|\.)archive\.org$/, /^is\d-ssl\.mzstatic\.com$/, /^books\.google\.com$/, /^books\.googleusercontent\.com$/];
const MAX_BYTES = 3_000_000;

function allowed(raw: string): URL | null {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && ALLOWED.some((r) => r.test(u.hostname)) ? u : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const target = allowed(req.nextUrl.searchParams.get("u") ?? "");
  if (!target) return new Response("Not a cover", { status: 400 });

  // Follow redirects by hand so every hop stays on an allowed host.
  let url: URL = target;
  let res: Response | null = null;
  for (let hop = 0; hop < 4; hop++) {
    try {
      res = await fetch(url, { redirect: "manual", headers: { "user-agent": "readread cover tint" } });
    } catch {
      return new Response("Cover host unreachable", { status: 502 });
    }
    if (res.status >= 300 && res.status < 400) {
      const next = allowed(new URL(res.headers.get("location") ?? "", url).toString());
      if (!next) return new Response("Redirected off cover hosts", { status: 502 });
      url = next;
      continue;
    }
    break;
  }
  if (!res || !res.ok) return new Response("No cover", { status: 404 });
  const type = res.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) return new Response("Not an image", { status: 415 });
  const body = await res.arrayBuffer();
  if (body.byteLength > MAX_BYTES) return new Response("Too big", { status: 413 });

  return new Response(body, {
    headers: {
      "content-type": type,
      "cache-control": "public, max-age=604800, s-maxage=2592000, immutable",
    },
  });
}
