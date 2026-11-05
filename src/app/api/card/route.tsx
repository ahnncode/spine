import { createClient } from "@supabase/supabase-js";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { ACCENT, clamp, coverData, GROUND, INK, MUTED, OgAvatar, OgCover, ogFonts, ScoreDisc, Wordmark } from "@/lib/og";
import type { PublicBookCard } from "@/lib/public";
import { WRAP_SLIDES, wrapSlide, type WrapBook } from "@/lib/wrapCards";

/**
 * Share cards (1080×1350, made for Instagram stories and texts), built from
 * the signed-in reader's own data. The browser sends its session token; the
 * database's usual rules decide what this can see.
 */

const SIZE = { width: 1080, height: 1350 };
const BOOK_FIELDS = "title, author, cover_id, cover_url, isbn13";

type Card = { kind: "top" } | { kind: "twins"; username: string } | { kind: "verdict"; id: string } | { kind: "wrap"; slide: number; year: number };

function parse(req: NextRequest): Card | null {
  const p = req.nextUrl.searchParams;
  const kind = p.get("kind");
  if (kind === "top") return { kind };
  if (kind === "twins" && /^[a-z0-9_]{3,20}$/i.test(p.get("u") ?? "")) return { kind, username: p.get("u")!.toLowerCase() };
  if (kind === "verdict" && /^[0-9a-f-]{36}$/i.test(p.get("id") ?? "")) return { kind, id: p.get("id")! };
  if (kind === "wrap") {
    const slide = Number(p.get("slide") ?? 1);
    const year = Number(p.get("year") ?? new Date().getFullYear());
    if (Number.isInteger(slide) && slide >= 1 && slide <= WRAP_SLIDES && Number.isInteger(year) && year >= 2000 && year <= 2100) return { kind, slide, year };
  }
  return null;
}

function db(token: string) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type ProfileRow = { id: string; username: string | null; display_name: string | null; avatar_icon: string | null; avatar_color: string | null };
const nameOf = (p?: ProfileRow | null) => p?.display_name || p?.username || "Reader";

function Frame({ children, footer }: { children: React.ReactNode; footer: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: GROUND, padding: "72px 72px 60px", fontFamily: "Geist", color: INK }}>
      <Wordmark s={48} />
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>{children}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "GeistMono", fontSize: 24, color: MUTED }}>
        <span>{footer}</span>
        <span style={{ color: ACCENT }}>rank books, not stars</span>
      </div>
    </div>
  );
}

export async function GET(req: NextRequest) {
  const card = parse(req);
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!card || !token) return new Response("Bad request", { status: 400 });
  const sb = db(token);
  const { data: auth } = await sb.auth.getUser(token);
  const uid = auth.user?.id;
  if (!uid) return new Response("Sign in first", { status: 401 });
  const fonts = await ogFonts();
  const { data: me } = await sb.from("profiles").select("id, username, display_name, avatar_icon, avatar_color").eq("id", uid).maybeSingle<ProfileRow>();

  if (card.kind === "top") {
    const { data } = await sb
      .from("ranked_entries")
      .select(`book_id, score, overall_rank, book:books(${BOOK_FIELDS})`)
      .eq("user_id", uid)
      .order("overall_rank")
      .limit(10);
    const rows = ((data ?? []) as unknown as { book_id: string; score: number; overall_rank: number; book: PublicBookCard }[]);
    const covers = await Promise.all(rows.map((r) => coverData(r.book)));
    return new ImageResponse(
      (
        <Frame footer={me?.username ? `readread.app/u/${me.username}` : "readread.app"}>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
            <div style={{ display: "flex", fontFamily: "GeistMono", fontSize: 26, color: ACCENT, letterSpacing: "0.08em" }}>MY TOP {rows.length || 10}</div>
            <div style={{ display: "flex", fontFamily: "Bricolage", fontWeight: 800, fontSize: 64, letterSpacing: "-0.04em", marginTop: 6 }}>{clamp(nameOf(me), 24)}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 24, gap: 10 }}>
            {rows.map((r, i) => (
              <div key={r.book_id} style={{ display: "flex", alignItems: "center", gap: 22 }}>
                <div style={{ display: "flex", width: 46, fontFamily: "Bricolage", fontWeight: 800, fontSize: 38, color: i < 3 ? INK : MUTED }}>{i + 1}</div>
                <OgCover book={r.book} src={covers[i]} width={50} />
                <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                  <div style={{ display: "flex", fontFamily: "Bricolage", fontWeight: 700, fontSize: 32, lineHeight: 1.05 }}>{clamp(r.book.title, 34)}</div>
                  <div style={{ display: "flex", fontSize: 22, color: MUTED, marginTop: 2 }}>{clamp(r.book.author ?? "", 36)}</div>
                </div>
                <ScoreDisc score={Number(r.score)} size={66} top={i < 3} />
              </div>
            ))}
          </div>
        </Frame>
      ),
      { ...SIZE, fonts },
    );
  }

  if (card.kind === "twins") {
    const { data: them } = await sb.from("profiles").select("id, username, display_name, avatar_icon, avatar_color").eq("username", card.username).maybeSingle<ProfileRow>();
    if (!them) return new Response("Not found", { status: 404 });
    const { data: m } = await sb.rpc("taste_matches", { p_users: [them.id] });
    const match = (m as { match: number | null; overlap: number }[] | null)?.[0];
    if (match?.match == null) return new Response("Not enough books in common yet", { status: 409 });
    const { data: theirs } = await sb.from("ranked_entries").select(`book_id, score, bucket, book:books(${BOOK_FIELDS})`).eq("user_id", them.id).eq("bucket", "loved");
    const { data: mine } = await sb.from("ranked_entries").select("book_id, score, bucket").eq("user_id", uid).eq("bucket", "loved");
    const mineSet = new Map(((mine ?? []) as { book_id: string; score: number }[]).map((r) => [r.book_id, Number(r.score)]));
    const both = ((theirs ?? []) as unknown as { book_id: string; score: number; book: PublicBookCard }[])
      .filter((r) => mineSet.has(r.book_id))
      .sort((a, b) => Number(b.score) + mineSet.get(b.book_id)! - (Number(a.score) + mineSet.get(a.book_id)!))
      .slice(0, 3);
    const covers = await Promise.all(both.map((r) => coverData(r.book)));
    const pct = match.match;
    const label = pct >= 80 ? "book twins" : pct >= 60 ? "taste buddies" : pct >= 40 ? "friendly rivals" : "opposites attract";
    const first = (p: ProfileRow | null) => nameOf(p).split(" ")[0];
    return new ImageResponse(
      (
        <Frame footer="readread.app">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 70, gap: 0 }}>
            <OgAvatar name={nameOf(me)} icon={me?.avatar_icon ?? null} color={me?.avatar_color ?? null} size={190} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 250, height: 250, borderRadius: 125, background: "#2D3FE0", color: "#fff", margin: "0 -30px", border: `10px solid ${GROUND}`, fontFamily: "Bricolage", fontWeight: 800, fontSize: 96, letterSpacing: "-0.04em" }}>
              {pct}%
            </div>
            <OgAvatar name={nameOf(them)} icon={them.avatar_icon} color={them.avatar_color} size={190} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 40 }}>
            <div style={{ display: "flex", fontFamily: "Bricolage", fontWeight: 800, fontSize: 70, letterSpacing: "-0.04em", textAlign: "center" }}>
              {clamp(`${first(me)} & ${first(them)}`, 26)}
            </div>
            <div style={{ display: "flex", fontFamily: "Bricolage", fontWeight: 700, fontSize: 48, color: ACCENT, marginTop: 4 }}>are {label}</div>
            <div style={{ display: "flex", fontSize: 26, color: MUTED, marginTop: 12 }}>from {match.overlap} books we&apos;ve both ranked</div>
          </div>
          {both.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "auto", marginBottom: 40 }}>
              <div style={{ display: "flex", fontFamily: "GeistMono", fontSize: 24, color: MUTED, letterSpacing: "0.08em" }}>WE BOTH LOVED</div>
              <div style={{ display: "flex", gap: 28, marginTop: 20 }}>
                {both.map((r, i) => <OgCover key={r.book_id} book={r.book} src={covers[i]} width={170} />)}
              </div>
            </div>
          )}
        </Frame>
      ),
      { ...SIZE, fonts },
    );
  }

  if (card.kind === "wrap") {
    const { data } = await sb
      .from("ranked_entries")
      .select(`score, overall_rank, finished_on, book:books(${BOOK_FIELDS}, pages, genres)`)
      .eq("user_id", uid)
      .gte("finished_on", `${card.year}-01-01`)
      .lt("finished_on", `${card.year + 1}-01-01`)
      .order("overall_rank");
    const books = (data ?? []) as unknown as WrapBook[];
    if (!books.length) return new Response(`No books finished in ${card.year} yet`, { status: 409 });
    // Only the slides that show covers need them.
    const covers = card.slide <= 2 ? await Promise.all(books.slice(0, card.slide === 1 ? 3 : 5).map((b) => coverData(b.book))) : [];
    const now = new Date();
    return new ImageResponse(
      wrapSlide(card.slide, { name: nameOf(me), year: card.year, soFar: card.year === now.getFullYear() && now.getMonth() < 11, books, covers }) as React.ReactElement,
      { ...SIZE, fonts },
    );
  }

  // Verdict
  const { data: ra } = await sb.from("read_alongs").select(`id, revealed_at, book:books(${BOOK_FIELDS})`).eq("id", card.id).maybeSingle();
  const r = ra as unknown as { id: string; revealed_at: string | null; book: PublicBookCard } | null;
  if (!r?.revealed_at) return new Response("No verdict yet", { status: 409 });
  const { data: prog } = await sb.rpc("read_along_progress", { p_id: card.id });
  const scored = ((prog ?? []) as { user_id: string; score: number | null; state: string }[])
    .filter((p) => p.state === "joined" && p.score != null)
    .sort((a, b) => Number(b.score) - Number(a.score));
  const { data: people } = await sb.from("profiles").select("id, username, display_name, avatar_icon, avatar_color").in("id", scored.map((s) => s.user_id));
  const byId = new Map(((people ?? []) as ProfileRow[]).map((p) => [p.id, p]));
  const cover = await coverData(r.book);
  const avg = scored.reduce((s, p) => s + Number(p.score), 0) / Math.max(1, scored.length);
  return new ImageResponse(
    (
      <Frame footer="readread.app">
        <div style={{ display: "flex", gap: 40, alignItems: "flex-end", marginTop: 56 }}>
          <OgCover book={r.book} src={cover} width={250} />
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", fontFamily: "GeistMono", fontSize: 26, color: ACCENT, letterSpacing: "0.08em" }}>THE VERDICT</div>
            <div style={{ display: "flex", fontFamily: "Bricolage", fontWeight: 800, fontSize: 60, lineHeight: 1, letterSpacing: "-0.04em", marginTop: 10 }}>{clamp(r.book.title, 40)}</div>
            <div style={{ display: "flex", fontSize: 28, color: MUTED, marginTop: 10 }}>{clamp(r.book.author ?? "", 40)}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 44, gap: 16 }}>
          {scored.slice(0, 6).map((p, i) => {
            const who = byId.get(p.user_id) ?? null;
            return (
              <div key={p.user_id} style={{ display: "flex", alignItems: "center", gap: 22 }}>
                <div style={{ display: "flex", width: 40, fontFamily: "GeistMono", fontSize: 28, color: MUTED }}>{i + 1}</div>
                <OgAvatar name={nameOf(who)} icon={who?.avatar_icon ?? null} color={who?.avatar_color ?? null} size={76} />
                <div style={{ display: "flex", flex: 1, fontFamily: "Bricolage", fontWeight: 700, fontSize: 38 }}>{clamp(nameOf(who), 22)}</div>
                <ScoreDisc score={Number(p.score)} size={84} top={i === 0} />
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", marginTop: "auto", marginBottom: 36, fontSize: 30 }}>
          Group average <span style={{ fontFamily: "GeistMono", marginLeft: 12 }}>{avg >= 10 ? "10" : avg.toFixed(1)}</span>
        </div>
      </Frame>
    ),
    { ...SIZE, fonts },
  );
}
