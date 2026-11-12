"use client";

import Link from "next/link";
import Papa from "papaparse";
import { useRef, useState, type DragEvent } from "react";
import { RequireAuth } from "@/components/Auth";
import { ArrowIcon, BackIcon, FileIcon } from "@/components/icons";
import { useShelf } from "@/components/useShelf";
import { importGoodreads } from "@/lib/data";
import { looksLikeGoodreads, parseGoodreads, type ImportSummary } from "@/lib/goodreads";
import { looksLikeStoryGraph, parseStoryGraph } from "@/lib/storygraph";

export default function ImportPage() {
  return (
    <RequireAuth>
      <Importer />
    </RequireAuth>
  );
}

type Phase = "pick" | "review" | "importing" | "done";

function Importer() {
  const { entries } = useShelf();
  const [phase, setPhase] = useState<Phase>("pick");
  const [fileName, setFileName] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [progress, setProgress] = useState({ f: 0, label: "" });
  const [result, setResult] = useState<{ added: number; skipped: number; dated: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function readFile(file: File) {
    setError(null);
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const fields = res.meta.fields || [];
        const s = looksLikeGoodreads(fields)
          ? parseGoodreads(res.data)
          : looksLikeStoryGraph(fields)
            ? parseStoryGraph(res.data)
            : null;
        if (!s) {
          setError("That doesn’t look like a Goodreads or StoryGraph export. Use the CSV from Goodreads’ Export Library or StoryGraph’s Export StoryGraph Library.");
          return;
        }
        if (s.total === 0) {
          setError("We couldn’t find any books in that file.");
          return;
        }
        setSummary(s);
        setPhase("review");
      },
      error: () => setError("We couldn’t read that file."),
    });
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) readFile(f);
  }

  async function run() {
    if (!summary || !entries) return;
    setPhase("importing");
    setError(null);
    try {
      const r = await importGoodreads(summary.books, entries, (f, label) => setProgress({ f, label }));
      setResult(r);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
      setPhase("review");
    }
  }

  const step = phase === "pick" ? 1 : phase === "done" ? 3 : 2;

  return (
    <div className="app">
      <main className="screen screen--flow">
        <div className="topbar">
          <Link href="/shelf" className="icon-btn" aria-label="Back to your shelf">
            <BackIcon size={20} />
          </Link>
          <span className="m muted" style={{ fontSize: 12 }}>Step {step} of 3</span>
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 12 }} aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              style={{
                flex: 1, height: 4, borderRadius: 2,
                background: i < step ? "var(--ink)" : i === step ? "var(--accent)" : "var(--line-2)",
              }}
            />
          ))}
        </div>

        {phase === "done" && result && summary ? (
          <>
            <h1 className="h1 h1--xl" style={{ marginTop: 30 }}>Your shelf is in.</h1>
            <p className="lede">
              {result.added} books added{result.skipped ? `, ${result.skipped} were already on your shelf` : ""}{result.dated ? ` (${result.dated} of those got their finish date filled in)` : ""}. Your
              starred books are roughly in order. A few quick matchups will make the ranking yours.
            </p>
            <div className="card card--ink" style={{ marginTop: 24, display: "flex", gap: 14 }}>
              <div className="d score score--top" style={{ width: 44, height: 44, fontSize: 18, fontWeight: 800, fontFamily: "var(--font-book)" }}>
                {summary.loved}
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>books you loved</div>
                <div style={{ fontSize: 14, color: "#c9c8c2", marginTop: 4, lineHeight: 1.4 }}>
                  Stars can&rsquo;t tell them apart. Head-to-heads can.
                </div>
              </div>
            </div>
            <div className="spacer" style={{ minHeight: 24 }} />
            <Link href="/sharpen" className="btn btn--block">
              Start sorting <ArrowIcon size={18} />
            </Link>
            <Link href="/shelf" className="btn btn--ghost btn--block" style={{ marginTop: 8 }}>
              See my shelf
            </Link>
          </>
        ) : (
          <>
            <h1 className="h1 h1--xl" style={{ marginTop: 30 }}>Bring your whole shelf.</h1>
            <p className="lede">
              We&rsquo;ll turn your Goodreads or StoryGraph stars into a starting ranking, then sharpen it with quick head-to-heads.
            </p>

            {phase === "pick" && (
              <>
                <div
                  className="drop"
                  role="button"
                  tabIndex={0}
                  data-over={over}
                  style={{ marginTop: 24 }}
                  onClick={() => inputRef.current?.click()}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                  onDragLeave={() => setOver(false)}
                  onDrop={onDrop}
                >
                  <span className="icon-btn" style={{ background: "var(--cobalt-soft)", color: "var(--cobalt-ink)", borderRadius: 12 }}>
                    <FileIcon />
                  </span>
                  <strong style={{ fontSize: 15 }}>Upload your Goodreads or StoryGraph export</strong>
                  <span className="muted" style={{ fontSize: 13 }}>The .csv file · tap or drop it here</span>
                </div>
                {/* Outside the drop zone: a focusable control can't sit inside another one. */}
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="visually-hidden"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
                />
                <details style={{ marginTop: 16, fontSize: 14, color: "var(--ink-2)" }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600, color: "var(--ink)", minHeight: 44, display: "flex", alignItems: "center" }}>
                    Where&rsquo;s my Goodreads export?
                  </summary>
                  <p style={{ margin: 0, lineHeight: 1.45 }}>
                    On Goodreads, open My Books → Import and export → Export Library. It can take a few minutes to
                    generate; then download the file and upload it here.
                  </p>
                </details>
                <details style={{ marginTop: 4, fontSize: 14, color: "var(--ink-2)" }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600, color: "var(--ink)", minHeight: 44, display: "flex", alignItems: "center" }}>
                    Where&rsquo;s my StoryGraph export?
                  </summary>
                  <p style={{ margin: 0, lineHeight: 1.45 }}>
                    On StoryGraph, open your profile menu → Manage Account → Export StoryGraph Library. Download the
                    .csv file and upload it here. Quarter stars carry over, so your starting ranking is extra precise.
                  </p>
                </details>
              </>
            )}

            {(phase === "review" || phase === "importing") && summary && (
              <div className="card" style={{ marginTop: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="icon-btn" style={{ background: "var(--cobalt-soft)", color: "var(--cobalt-ink)", borderRadius: 12 }}>
                    <FileIcon />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fileName}</div>
                    <div className="m muted" style={{ fontSize: 12, marginTop: 2 }}>
                      {phase === "importing" ? progress.label : "Ready to import"}
                    </div>
                  </div>
                </div>
                {phase === "importing" && (
                  <div className="bar" style={{ marginTop: 16 }} role="progressbar" aria-valuenow={Math.round(progress.f * 100)} aria-valuemin={0} aria-valuemax={100}>
                    <span style={{ width: `${Math.round(progress.f * 100)}%` }} />
                  </div>
                )}
                <div className="stat-grid" style={{ marginTop: 20 }}>
                  <div className="stat"><div className="stat__n">{summary.total}</div><div className="stat__l">books found</div></div>
                  <div className="stat"><div className="stat__n">{summary.rated}</div><div className="stat__l">with ratings</div></div>
                  <div className="stat"><div className="stat__n">{summary.want}</div><div className="stat__l">want to read</div></div>
                </div>
                {summary.unrated > 0 && (
                  <p className="muted" style={{ fontSize: 13, margin: "12px 0 0" }}>
                    {summary.unrated} read but unrated. They&rsquo;ll wait in &ldquo;To rank&rdquo;.
                  </p>
                )}
              </div>
            )}

            {error && <p className="error" role="alert" style={{ marginTop: 16 }}>{error}</p>}

            <div className="spacer" style={{ minHeight: 24 }} />
            {phase !== "pick" && (
              <>
                <button className="btn btn--block" disabled={phase === "importing" || !entries} onClick={run}>
                  {phase === "importing" ? "Importing…" : `Import ${summary?.total ?? ""} books`}
                </button>
                <button className="btn btn--ghost btn--block" style={{ marginTop: 8 }} disabled={phase === "importing"} onClick={() => { setPhase("pick"); setSummary(null); }}>
                  Choose a different file
                </button>
              </>
            )}
            {phase === "pick" && (
              <Link href="/shelf" className="btn btn--ghost btn--block">I&rsquo;ll do this later</Link>
            )}
          </>
        )}
      </main>
    </div>
  );
}
