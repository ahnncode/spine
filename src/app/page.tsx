"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/Auth";
import { Cover } from "@/components/Cover";
import { ScoreChip } from "@/components/ScoreChip";

const SAMPLE = [
  { title: "Middlemarch", author: "George Eliot", score: 9.6 },
  { title: "Lonesome Dove", author: "Larry McMurtry", score: 9.3 },
  { title: "Piranesi", author: "Susanna Clarke", score: 8.8 },
];

export default function Landing() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && session) router.replace("/shelf");
  }, [loading, session, router]);

  return (
    <div className="app">
      <main className="screen screen--flow">
        <div className="topbar">
          <span className="wordmark">spine</span>
          <Link href="/login" className="btn btn--quiet" style={{ minHeight: 44, fontSize: 15 }}>
            Sign in
          </Link>
        </div>

        <h1 className="h1" style={{ fontSize: 58, lineHeight: 0.92, marginTop: 40 }}>
          Rank books,
          <br />
          not stars.
        </h1>
        <p className="lede" style={{ fontSize: 17 }}>
          Every book you finish goes head-to-head with ones you&rsquo;ve read. A few taps later you have an honest,
          ranked shelf — and a score that actually means something.
        </p>

        <ol className="mini-list" style={{ listStyle: "none", margin: "28px 0 0" }} aria-label="Example ranked shelf">
          {SAMPLE.map((b, i) => (
            <li key={b.title} className={`mini-row ${i === 2 ? "mini-row--new" : ""}`}>
              <span className="m" style={{ width: 22, fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>
                {i + 1}
              </span>
              <Cover book={{ title: b.title, author: b.author }} width={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="d" style={{ fontWeight: 700, fontSize: 16 }}>{b.title}</div>
                <div className="muted" style={{ fontSize: 13 }}>{b.author}</div>
              </div>
              <ScoreChip score={b.score} bucket="loved" size={40} />
            </li>
          ))}
        </ol>

        <div className="spacer" style={{ minHeight: 32 }} />
        <Link href="/login" className="btn btn--block">
          Start your shelf
        </Link>
        <p className="muted" style={{ textAlign: "center", fontSize: 14, margin: "14px 0 0" }}>
          Coming from Goodreads? Bring your whole library in one upload.
        </p>
      </main>
    </div>
  );
}
