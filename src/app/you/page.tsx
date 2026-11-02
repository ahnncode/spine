"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { RequireAuth, useAuth } from "@/components/Auth";
import { Cover } from "@/components/Cover";
import { ArrowIcon } from "@/components/icons";
import { TabBar } from "@/components/TabBar";
import { useShelf } from "@/components/useShelf";
import { rankEntries } from "@/lib/data";
import { supabase } from "@/lib/supabase";

export default function YouPage() {
  return (
    <RequireAuth>
      <You />
    </RequireAuth>
  );
}

function You() {
  const { session } = useAuth();
  const router = useRouter();
  const { entries } = useShelf();
  const ranked = useMemo(() => rankEntries(entries || []), [entries]);
  const year = new Date().getFullYear();
  const thisYear = ranked.filter((e) => e.finished_on?.startsWith(String(year))).length;
  const want = (entries || []).filter((e) => e.status === "want").length;
  const name = session?.user.email?.split("@")[0] ?? "You";

  async function signOut() {
    await supabase().auth.signOut();
    router.replace("/");
  }

  return (
    <div className="app">
      <main className="screen">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="d score score--top" style={{ width: 60, height: 60, fontSize: 24, fontWeight: 800, fontFamily: "var(--font-display)" }}>
            {name.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 className="h1" style={{ fontSize: 28, letterSpacing: "-0.04em", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</h1>
            <div className="muted" style={{ fontSize: 13 }}>{ranked.length} ranked · {want} want to read</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 20 }}>
          <div className="card card--ink">
            <div className="d" style={{ fontSize: 52, fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 1 }}>{thisYear}</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8 }}>read in {year}</div>
          </div>
          <div className="card" style={{ background: "var(--cobalt)", borderColor: "var(--cobalt)", color: "#fff" }}>
            <div className="d" style={{ fontSize: 52, fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 1 }}>{ranked.length}</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8 }}>books ranked</div>
          </div>
        </div>

        {ranked.length > 0 && (
          <section className="card" style={{ marginTop: 10 }}>
            <h2 className="h2">Your top three</h2>
            <div style={{ display: "flex", gap: 14, marginTop: 14 }}>
              {ranked.slice(0, 3).map((e) => (
                <Link key={e.id} href={`/rank/${e.book_id}`} style={{ textDecoration: "none", flex: 1, minWidth: 0 }} aria-label={`#${e.rank} ${e.book.title}`}>
                  <Cover book={e.book} width={88} />
                  <div className="m" style={{ fontSize: 12, fontWeight: 700, marginTop: 8 }}>#{e.rank}</div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="stack" style={{ marginTop: 10 }}>
          <Link href="/import" className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", textDecoration: "none", padding: "16px 18px" }}>
            <span style={{ fontWeight: 600 }}>Import from Goodreads</span>
            <ArrowIcon size={18} />
          </Link>
          <Link href="/sharpen" className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", textDecoration: "none", padding: "16px 18px" }}>
            <span style={{ fontWeight: 600 }}>Sharpen your ranking</span>
            <ArrowIcon size={18} />
          </Link>
        </div>

        <button className="btn btn--ghost btn--block" style={{ marginTop: 18 }} onClick={signOut}>
          Sign out
        </button>
      </main>
      <TabBar />
    </div>
  );
}
