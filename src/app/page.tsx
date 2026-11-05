"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { takeDestination, useAuth } from "@/components/Auth";
import { Cover } from "@/components/Cover";
import { ScoreChip } from "@/components/ScoreChip";

const SAMPLE = [
  { title: "Middlemarch", author: "George Eliot", score: 9.6 },
  { title: "Lonesome Dove", author: "Larry McMurtry", score: 9.3 },
  { title: "Piranesi", author: "Susanna Clarke", score: 8.8 },
];

const FEATURES = [
  { h: "A Goodreads alternative built on rankings", p: "Stars drift. readread asks one easy question instead: which did you like more? Every book you finish lands in the right spot on your shelf, with a score from 0 to 10 that stays honest." },
  { h: "See what your friends are reading", p: "Follow friends, see their rankings and check-ins, and find out your taste match, plus the books you fight about most." },
  { h: "Read together, spoiler-free", p: "Start a read-along for any book: everyone's progress in one place, a discussion that hides anything past where you are, and a score reveal when you've all finished." },
  { h: "Bring your Goodreads or StoryGraph library", p: "Upload your export and your ratings become a starting ranking in seconds. Then sharpen it with quick head-to-heads." },
  { h: "Streaks, badges and your year in books", p: "Check in as you read to keep a weekly streak, collect a genre passport and 32 badges (plus a few secret ones), and get a yearly recap of everything you read." },
];

const FAQ = [
  { q: "Is readread free?", a: "Yes. readread is free to use, with no ads." },
  { q: "How is ranking different from star ratings?", a: "Instead of picking a number, you compare a new book with ones you've already read. readread places it on your ranked shelf and turns its position into a score from 0 to 10, so your scores stay consistent over time." },
  { q: "Can I import my Goodreads or StoryGraph books?", a: "Yes. Export your library from Goodreads or StoryGraph as a CSV file and upload it on readread. Ratings, reviews, dates read and want-to-read shelves come with it." },
  { q: "Is there an app?", a: "readread works in your phone's browser and can be added to your home screen like an app. Native iPhone and Android apps are planned." },
  { q: "Can I keep my shelf private?", a: "Yes. You can make your shelf private at any time, and public web profiles are off unless you turn them on." },
];

function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default function Landing() {
  const { session, loading } = useAuth();
  const router = useRouter();

  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) router.replace(takeDestination());
  }, [loading, session, router]);

  // Supabase sends people back here with #error=… when a sign-in link fails.
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (!params.get("error")) return;
    const code = params.get("error_code");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLinkError(
      code === "otp_expired"
        ? "That sign-in link has expired or was already used. Request a fresh one."
        : params.get("error_description") || "That sign-in link didn’t work. Request a fresh one.",
    );
    history.replaceState(null, "", window.location.pathname);
  }, []);

  return (
    <div className="app">
      <main className="screen screen--flow">
        <div className="topbar">
          <Logo size={30} />
          <Link href="/login" className="btn btn--quiet" style={{ minHeight: 44, fontSize: 15 }}>
            Sign in
          </Link>
        </div>

        {linkError && (
          <p className="notice" role="alert" style={{ marginTop: 20 }}>
            {linkError}{" "}
            <Link href="/login" style={{ fontWeight: 600 }}>Get a new link</Link>
          </p>
        )}

        <h1 className="h1" style={{ fontSize: 58, lineHeight: 0.92, marginTop: 40 }}>
          Rank books,
          <br />
          not stars.
        </h1>
        <p className="lede" style={{ fontSize: 17 }}>
          Every book you finish goes head-to-head with ones you&rsquo;ve read. A few taps later you have an honest,
          ranked shelf, with a score that actually means something.
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
          Coming from Goodreads or StoryGraph? Bring your whole library in one upload.
        </p>

        <section className="landing-more" aria-label="About readread">
          {FEATURES.map((f) => (
            <div key={f.h} className="landing-feature">
              <h2 className="h2">{f.h}</h2>
              <p>{f.p}</p>
            </div>
          ))}
          <h2 className="h2" style={{ marginTop: 32 }}>Questions</h2>
          {FAQ.map((q) => (
            <details key={q.q} className="landing-faq">
              <summary>{q.q}</summary>
              <p>{q.a}</p>
            </details>
          ))}
        </section>
        <script
          type="application/ld+json"
          // Structured data so search engines understand what readread is.
          dangerouslySetInnerHTML={{ __html: jsonLd({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebApplication",
                name: "readread",
                url: "https://readread.app",
                sameAs: ["https://www.instagram.com/readread.app/"],
                applicationCategory: "LifestyleApplication",
                operatingSystem: "Web, iOS, Android",
                description: "A social book tracker where you rank the books you read with quick head-to-head comparisons instead of star ratings.",
                offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
              },
              {
                "@type": "FAQPage",
                mainEntity: FAQ.map((q) => ({ "@type": "Question", name: q.q, acceptedAnswer: { "@type": "Answer", text: q.a } })),
              },
            ],
          }) }}
        />

        <p className="muted" style={{ textAlign: "center", fontSize: 13, margin: "20px 0 0" }}>
          <a href="https://www.instagram.com/readread.app/" target="_blank" rel="noopener noreferrer">Instagram</a> · <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
        </p>
      </main>
    </div>
  );
}
