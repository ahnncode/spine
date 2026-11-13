"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/Auth";
import { BackIcon } from "@/components/icons";
import { RowsSkeleton } from "@/components/Skeleton";
import { adminGrowth, adminGrowthSources, adminGrowthTotals, type GrowthSource, type GrowthTotals, type GrowthWeek } from "@/lib/data";

export default function Page() {
  return (
    <RequireAuth>
      <GrowthPage />
    </RequireAuth>
  );
}

const WEEKS = 12;

function weekLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

const n = (x: number) => x.toLocaleString("en-US");

function pct(back: number, cohort: number): string {
  return cohort === 0 ? "–" : `${Math.round((back / cohort) * 100)}%`;
}

/** Change from one week to the next, as "+12%" or "−5%". Null when there's nothing to compare. */
function change(now: number, before: number): string | null {
  if (before === 0) return null;
  const p = Math.round(((now - before) / before) * 100);
  return `${p >= 0 ? "+" : "−"}${Math.abs(p)}%`;
}

function asSheet(weeks: GrowthWeek[]): string {
  const head = ["Week of", "Signups", "Invited", "Probably strangers", "Active rankers", "Active readers", "Matchups", "Imports", "Imported books", "D7 cohort", "D7 back", "D30 cohort", "D30 back"];
  const rows = [...weeks].reverse().map((w) => [
    w.week_start, w.signups, w.signups_invited, w.signups_outside, w.active_rankers, w.active_readers, w.matchups,
    w.importers, w.imported_books, w.d7_cohort, w.d7_back, w.d30_cohort, w.d30_back,
  ]);
  return [head, ...rows].map((r) => r.join("\t")).join("\n");
}

/**
 * The founder's Monday numbers: who joined, who's ranking, who came back.
 * Admins and test accounts (like the demo account) are left out.
 */
function GrowthPage() {
  const [weeks, setWeeks] = useState<GrowthWeek[] | null>(null);
  const [totals, setTotals] = useState<GrowthTotals | null>(null);
  const [sources, setSources] = useState<GrowthSource[]>([]);
  const [denied, setDenied] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    adminGrowthSources(90).then(setSources).catch(() => {});
    Promise.all([adminGrowth(WEEKS), adminGrowthTotals()])
      .then(([w, t]) => {
        setWeeks(w);
        setTotals(t);
      })
      .catch(() => setDenied(true));
  }, []);

  async function copy() {
    if (!weeks) return;
    try {
      await navigator.clipboard.writeText(asSheet(weeks));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  }

  // Compare the last two full weeks; the current week is still filling in.
  const full = (weeks ?? []).filter((w) => !w.partial);
  const [last, prev] = full;
  const now = weeks?.[0];

  return (
    <div className="app">
      <main className="screen screen--flow" style={{ paddingTop: 12 }}>
        <Link href="/you" className="icon-btn" aria-label="Back"><BackIcon size={20} /></Link>
        <h1 className="h1" style={{ marginTop: 12 }}>Growth</h1>

        {denied ? (
          <p className="lede">This page is only for admins.</p>
        ) : !weeks || !totals || !now ? (
          <RowsSkeleton count={4} />
        ) : (
          <>
            <p className="lede">Real readers only. You, other admins and test accounts are left out. Weeks start on Monday (UTC); the top row is this week so far.</p>

            <div className="stat-grid" style={{ marginTop: 20 }}>
              <div className="stat">
                <div className="stat__n">{last ? last.active_rankers : now.active_rankers}</div>
                <div className="stat__l">
                  Active rankers last week
                  {last && prev && change(last.active_rankers, prev.active_rankers) && <> · {change(last.active_rankers, prev.active_rankers)}</>}
                </div>
              </div>
              <div className="stat">
                <div className="stat__n">{now.signups}</div>
                <div className="stat__l">Signups so far this week</div>
              </div>
              <div className="stat">
                <div className="stat__n">{totals.readers}</div>
                <div className="stat__l">Readers in total</div>
              </div>
            </div>

            <div className="growth-table__wrap">
              <table className="growth-table">
                <thead>
                  <tr>
                    <th scope="col">Week</th>
                    <th scope="col">Signups</th>
                    <th scope="col">Strangers</th>
                    <th scope="col">Rankers</th>
                    <th scope="col">D7</th>
                    <th scope="col">D30</th>
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((w) => (
                    <tr key={w.week_start} className={w.partial ? "growth-table__partial" : undefined}>
                      <th scope="row">{weekLabel(w.week_start)}</th>
                      <td>{w.signups}</td>
                      <td>{w.signups_outside}</td>
                      <td>{w.active_rankers}</td>
                      <td title={w.d7_cohort ? `${w.d7_back} of ${w.d7_cohort}` : "Too recent to tell"}>{pct(w.d7_back, w.d7_cohort)}</td>
                      <td title={w.d30_cohort ? `${w.d30_back} of ${w.d30_cohort}` : "Too recent to tell"}>{pct(w.d30_back, w.d30_cohort)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button type="button" className="btn btn--ghost btn--block" style={{ marginTop: 12 }} onClick={copy}>
              {copied ? "Copied. Paste it into your sheet." : "Copy every column for a spreadsheet"}
            </button>

            {sources.length > 0 && (
              <>
                <h2 className="h2" style={{ marginTop: 32 }}>Where they came from</h2>
                <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>Last 90 days. Ads and posts show up here when their link has a utm_source tag.</p>
                <div className="growth-table__wrap" style={{ marginTop: 12 }}>
                  <table className="growth-table">
                    <thead>
                      <tr>
                        <th scope="col">Source</th>
                        <th scope="col">Signups</th>
                        <th scope="col">Ranked</th>
                        <th scope="col">D7</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sources.map((r) => (
                        <tr key={`${r.source}:${r.campaign ?? ""}`}>
                          <th scope="row">{r.source}{r.campaign && <span className="muted"> · {r.campaign}</span>}</th>
                          <td>{r.signups}</td>
                          <td>{r.rankers}</td>
                          <td title={r.d7_cohort ? `${r.d7_back} of ${r.d7_cohort}` : "Too recent to tell"}>{pct(r.d7_back, r.d7_cohort)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <h2 className="h2" style={{ marginTop: 32 }}>All time</h2>
            <dl className="growth-totals">
              <div><dt>Readers</dt><dd>{totals.readers}</dd></div>
              <div><dt>Probably strangers</dt><dd>{totals.readers_outside}</dd></div>
              <div><dt>Joined through an invite</dt><dd>{totals.invited}</dd></div>
              <div><dt>Imported a library</dt><dd>{totals.importers}</dd></div>
              <div>
                <dt>Imported books placed by the reader</dt>
                <dd>{n(totals.imported_placed)} of {n(totals.imported_books)}</dd>
              </div>
              <div><dt>Books ranked</dt><dd>{n(totals.ranked_books)}</dd></div>
              <div><dt>Matchups</dt><dd>{n(totals.matchups)}</dd></div>
            </dl>

            <h2 className="h2" style={{ marginTop: 32 }}>What the numbers mean</h2>
            <ul className="growth-notes">
              <li><strong>Strangers:</strong> signed up without an invite link and didn&rsquo;t follow you in their first 3 days. It&rsquo;s a rough guess at people who don&rsquo;t know you.</li>
              <li><strong>Rankers:</strong> did at least one matchup, placement or quick-rate that week. Importing a library doesn&rsquo;t count.</li>
              <li><strong>In the spreadsheet copy:</strong> also active readers (did anything), matchups, and imports (readers who brought in a Goodreads or StoryGraph library that week).</li>
              <li><strong>D7:</strong> of that week&rsquo;s signups, the share who did anything 7 to 13 days after joining. <strong>D30</strong> is the same for 30 to 36 days after. A dash means they&rsquo;re too new to tell.</li>
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
