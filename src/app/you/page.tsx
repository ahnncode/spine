"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth, useProfile } from "@/components/Auth";
import { Avatar } from "@/components/Avatar";
import { EarlyPill, Name } from "@/components/Badge";
import { AvatarPicker } from "@/components/AvatarPicker";
import { BadgeCase } from "@/components/BadgeCase";
import { InviteCard } from "@/components/InviteCard";
import { Cover } from "@/components/Cover";
import { ArrowIcon, LockIcon } from "@/components/icons";
import { ScoreChip } from "@/components/ScoreChip";
import { TabBar } from "@/components/TabBar";
import { useEnrichment } from "@/components/useEnrichment";
import { useShelf } from "@/components/useShelf";
import { useStreak } from "@/components/useStreak";
import { isEarlyAdopter, type BadgeStatus } from "@/lib/badges";
import { deleteMyAccount, followCounts, rankEntries, myInvites, refreshBadges, setBookGenre, updateMyProfile } from "@/lib/data";
import { GENRES } from "@/lib/genres";
import { passport, readInYear, TASTE_UNLOCK } from "@/lib/stats";
import { supabase } from "@/lib/supabase";

export default function YouPage() {
  return (
    <RequireAuth>
      <You />
    </RequireAuth>
  );
}

function You() {
  const router = useRouter();
  const { profile, reloadProfile } = useProfile();
  const { entries, reload } = useShelf();
  const { active: lookingUp } = useEnrichment(entries, reload);
  const [counts, setCounts] = useState<{ followers: number; following: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (profile) followCounts(profile.id).then(setCounts).catch(() => {});
  }, [profile]);

  const ranked = useMemo(() => rankEntries(entries || []), [entries]);
  const year = new Date().getFullYear();
  const thisYear = readInYear(ranked, year).length;
  const goal = profile?.yearly_goal ?? null;
  const { streak } = useStreak(entries);
  const stamps = useMemo(() => passport(ranked), [ranked]);
  const earnedStamps = stamps.filter((s) => s.count > 0).length;
  const [stamp, setStamp] = useState<string | null>(null);
  const openStamp = stamps.find((s) => s.key === stamp);
  const stampBooks = stamp ? ranked.filter((e) => e.book.genres?.includes(stamp)) : [];
  const pendingGenres = lookingUp ? ranked.filter((e) => !e.book.enriched).length : 0;
  // Anything still without a genre once lookups finish can be sorted by hand.
  const noGenre = ranked.filter((e) => !e.book.genres?.length && (e.book.enriched || !lookingUp));
  const [sorting, setSorting] = useState(false);
  const [picked, setPicked] = useState<Record<string, string>>({});
  async function pickGenre(bookId: string, genre: string) {
    setPicked((p) => ({ ...p, [bookId]: genre }));
    try {
      await setBookGenre(bookId, genre);
    } catch {
      setPicked((p) => { const n = { ...p }; delete n[bookId]; return n; });
    }
  }
  const [badges, setBadges] = useState<BadgeStatus[] | null>(null);
  // Re-check badges whenever the shelf or profile changes (a new goal can earn one).
  const shelfSize = entries?.length ?? -1;
  useEffect(() => {
    if (!profile) return;
    refreshBadges().then(setBadges).catch(() => setBadges((b) => b ?? []));
  }, [profile, shelfSize]);
  const connector = badges?.find((b) => b.key === "connector");
  const [invites, setInvites] = useState<{ joined: number; qualified: number } | null>(null);
  useEffect(() => {
    if (profile) myInvites().then(setInvites).catch(() => {});
  }, [profile]);

  async function signOut() {
    await supabase().auth.signOut();
    router.replace("/");
  }

  const pct = goal ? Math.min(1, thisYear / goal) : 0;
  const C = 2 * Math.PI * 34;

  return (
    <div className="app">
      <main className="screen">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button className="avatar-edit" onClick={() => setPicking(true)} aria-label="Change profile picture">
            <Avatar profile={profile} size={60} />
            <span className="avatar-edit__dot" aria-hidden="true">+</span>
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="h1" style={{ fontSize: 28, letterSpacing: "-0.04em", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ minWidth: 0 }}><Name profile={profile} markSize={20} /></span>
              {profile?.is_private && <LockIcon size={16} aria-label="Private" />}
            </h1>
            <div className="muted" style={{ fontSize: 13 }}>
              @{profile?.username} · {counts ? `${counts.followers} followers · ${counts.following} following` : " "}
            </div>
            {isEarlyAdopter(profile?.created_at) && <div style={{ marginTop: 6 }}><EarlyPill /></div>}
          </div>
          <button className="btn btn--quiet" style={{ minHeight: 40, fontSize: 14, padding: "0 14px" }} onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>

        {profile?.bio ? (
          <button className="status-line" style={{ display: "block", width: "100%", textAlign: "left", color: "inherit", font: "inherit", fontSize: 15, cursor: "pointer" }}
            onClick={() => setEditing(true)} aria-label={`Your status: ${profile.bio}. Edit`}>
            {profile.bio}
          </button>
        ) : (
          <button className="status-line status-line--empty" onClick={() => setEditing(true)}>
            + Add a status — what are you into right now?
          </button>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 20 }}>
          <button className="card card--ink" style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 10 }} onClick={() => setEditing(true)} aria-label={goal ? `${thisYear} of ${goal} books this year. Edit goal` : "Set a yearly goal"}>
            <svg width="76" height="76" viewBox="0 0 80 80" aria-hidden="true">
              <circle cx="40" cy="40" r="34" fill="none" stroke="#2a2a2a" strokeWidth="8" />
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--accent)" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${C * pct} ${C}`} transform="rotate(-90 40 40)" />
              <text x="40" y="47" textAnchor="middle" fill="#fff" fontFamily="var(--font-display)" fontSize="22" fontWeight="800">{thisYear}</text>
            </svg>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{year} {goal ? "goal" : "so far"}</div>
              <div style={{ fontSize: 12, color: "#c9c8c2" }}>
                {goal ? (thisYear >= goal ? "Goal reached" : `${goal - thisYear} to go of ${goal}`) : "Tap to set a goal"}
              </div>
            </div>
          </button>
          <div className="card" style={{ background: "var(--cobalt)", borderColor: "var(--cobalt)", color: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span className="stat-big">{streak.weeks}</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>week{streak.weeks === 1 ? "" : "s"}</span>
            </div>
            <div className="streak-grid" aria-hidden="true">
              {streak.recent.map((on, i) => <span key={i} data-on={on} data-now={i === 11} />)}
            </div>
            <div style={{ fontSize: 12, color: "#dde1ff" }}>
              {streak.activeThisWeek ? "Streak safe this week" : streak.weeks ? "Check in on a book this week to keep it" : "Check in on what you’re reading to start one"}
            </div>
          </div>
        </div>

        {ranked.length < TASTE_UNLOCK && (
          <Link href="/add" className="card" style={{ display: "block", marginTop: 10, textDecoration: "none" }}>
            <div style={{ fontWeight: 600 }}>Taste match unlocks at {TASTE_UNLOCK} ranked</div>
            <div className="bar" style={{ marginTop: 10 }}><span style={{ width: `${(ranked.length / TASTE_UNLOCK) * 100}%`, background: "var(--cobalt)" }} /></div>
            <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>{TASTE_UNLOCK - ranked.length} to go — then see who reads like you and get picks for your taste</div>
          </Link>
        )}

        <section className="card" style={{ marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 className="h2">Genre passport</h2>
            <span className="m muted" style={{ fontSize: 12 }}>{earnedStamps} of {stamps.length} stamps</span>
          </div>
          <div className="stamp-grid">
            {stamps.map((s) =>
              s.count > 0 ? (
                <button key={s.key} className="stamp" style={{ background: s.bg, color: s.fg }} onClick={() => setStamp(s.key)}
                  aria-label={`${s.label}: ${s.count} book${s.count === 1 ? "" : "s"}`}>
                  <span className="m" style={{ fontWeight: 700 }}>{s.count}</span>
                  <span>{s.label}</span>
                </button>
              ) : (
                <button key={s.key} className="stamp stamp--locked" onClick={() => setStamp(s.key)} aria-label={`${s.label}: not earned yet`}>
                  <LockIcon size={14} />
                  <span>{s.label}</span>
                </button>
              ),
            )}
          </div>
          {pendingGenres > 0 && (
            <p className="muted" style={{ fontSize: 13, margin: "10px 0 0" }}>Looking up genres for {pendingGenres} book{pendingGenres === 1 ? "" : "s"}… stamps fill in as you browse.</p>
          )}
          {noGenre.length > 0 && (
            <button className="link-btn" style={{ marginTop: 10, fontSize: 13 }} onClick={() => setSorting(true)}>
              {noGenre.length} book{noGenre.length === 1 ? "" : "s"} without a genre — sort {noGenre.length === 1 ? "it" : "them"}
            </button>
          )}
        </section>

        <BadgeCase statuses={badges} />

        {profile?.username && (
          <InviteCard username={profile.username} joined={invites?.joined ?? 0} qualified={invites?.qualified ?? connector?.progress ?? 0} earned={Boolean(connector?.earned)} />
        )}

        {ranked.length > 0 && (
          <section className="card" style={{ marginTop: 10 }}>
            <h2 className="h2">Your top three</h2>
            <div style={{ display: "flex", gap: 14, marginTop: 14 }}>
              {ranked.slice(0, 3).map((e) => (
                <Link key={e.id} href={`/book/${e.book_id}`} style={{ textDecoration: "none", flex: 1, minWidth: 0 }} aria-label={`#${e.rank} ${e.book.title}`}>
                  <Cover book={e.book} width={88} />
                  <div className="m" style={{ fontSize: 12, fontWeight: 700, marginTop: 8 }}>#{e.rank}</div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="stack" style={{ marginTop: 10 }}>
          {[
            ...(profile?.username ? [{ href: `/u/${profile.username}/shelf`, label: "Your whole library" }] : []),
            { href: `/wrap/${year}`, label: `Your ${year} in books` },
            { href: "/people", label: "Find friends" },
            { href: "/import", label: "Import from Goodreads" },
            { href: "/sharpen", label: "Sharpen your ranking" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", textDecoration: "none", padding: "16px 18px" }}>
              <span style={{ fontWeight: 600 }}>{l.label}</span>
              <ArrowIcon size={18} />
            </Link>
          ))}
        </div>

        <button className="btn btn--ghost btn--block" style={{ marginTop: 18 }} onClick={signOut}>
          Sign out
        </button>
        <p className="muted" style={{ textAlign: "center", fontSize: 13, margin: "8px 0 0" }}>
          <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
        </p>
      </main>

      {openStamp && (
        <div className="sheet-backdrop" onClick={() => setStamp(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={`${openStamp.label} books`} onClick={(e) => e.stopPropagation()}>
            <div className="sheet__grab" />
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="stamp" style={{ background: openStamp.count ? openStamp.bg : "var(--well)", color: openStamp.count ? openStamp.fg : "var(--muted)", width: 64, minHeight: 64, flexShrink: 0 }}>
                <span className="m" style={{ fontWeight: 700, fontSize: 18 }}>{openStamp.count}</span>
              </span>
              <div style={{ minWidth: 0 }}>
                <h2 className="d" style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em" }}>{openStamp.label}</h2>
                <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>
                  {openStamp.count ? `${openStamp.count} ranked · best first` : "No stamp yet"}
                </p>
              </div>
            </div>
            {stampBooks.length === 0 ? (
              <div style={{ marginTop: 18 }}>
                <p style={{ margin: 0, fontSize: 15, color: "var(--ink-2)" }}>Rank a {openStamp.label.toLowerCase()} book to earn this stamp.</p>
                <Link href="/add" className="btn btn--block" style={{ marginTop: 16 }}>Rank a book</Link>
              </div>
            ) : (
              <ol style={{ listStyle: "none", margin: "12px 0 0", padding: 0, maxHeight: "60vh", overflowY: "auto" }}>
                {stampBooks.map((e, i) => (
                  <li key={e.id}>
                    <Link href={`/book/${e.book_id}`} className="book-row">
                      <span className={`book-row__rank ${i < 3 ? "book-row__rank--top" : ""}`}>{i + 1}</span>
                      <Cover book={e.book} width={40} />
                      <span className="book-row__body">
                        <span className="book-row__title" style={{ display: "block" }}>{e.book.title}</span>
                        <span className="book-row__sub" style={{ display: "block" }}>{e.book.author} · #{e.rank} overall</span>
                      </span>
                      <ScoreChip score={e.score} bucket={e.bucket} />
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}

      {sorting && (
        <div className="sheet-backdrop" onClick={() => { setSorting(false); if (Object.keys(picked).length) reload(); }}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Pick genres" onClick={(e) => e.stopPropagation()}>
            <div className="sheet__grab" />
            <h2 className="d" style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em" }}>Pick a genre</h2>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>We couldn&rsquo;t find these in the catalogue. Your pick counts toward your passport.</p>
            <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0, maxHeight: "60vh", overflowY: "auto" }}>
              {noGenre.map((e) => (
                <li key={e.id} className="book-row" style={{ gap: 12 }}>
                  <Cover book={e.book} width={36} />
                  <span className="book-row__body">
                    <span className="book-row__title" style={{ display: "block", fontSize: 15 }}>{e.book.title}</span>
                    <span className="book-row__sub" style={{ display: "block" }}>{e.book.author}</span>
                  </span>
                  <label className="sort-select">
                    <span className="visually-hidden">Genre for {e.book.title}</span>
                    <select value={picked[e.book_id] ?? ""} disabled={Boolean(picked[e.book_id])} onChange={(ev) => pickGenre(e.book_id, ev.target.value)}>
                      <option value="" disabled>Genre</option>
                      {GENRES.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
                    </select>
                  </label>
                </li>
              ))}
            </ul>
            <button className="btn btn--block" style={{ marginTop: 16 }} onClick={() => { setSorting(false); if (Object.keys(picked).length) reload(); }}>Done</button>
          </div>
        </div>
      )}

      {picking && profile && (
        <AvatarPicker
          profile={profile}
          earned={new Set((badges ?? []).filter((b) => b.earned).map((b) => b.key))}
          onClose={() => setPicking(false)}
          onSaved={async () => { await reloadProfile(); setPicking(false); }}
        />
      )}

      {editing && profile && (
        <EditProfile
          initial={{ name: profile.display_name ?? "", bio: profile.bio ?? "", goal: profile.yearly_goal, isPrivate: profile.is_private }}
          username={profile.username ?? ""}
          onDeleted={() => router.replace("/")}
          onClose={() => setEditing(false)}
          onSaved={async () => { await reloadProfile(); setEditing(false); }}
        />
      )}
      <TabBar />
    </div>
  );
}

function EditProfile({
  initial, username, onClose, onSaved, onDeleted,
}: {
  initial: { name: string; bio: string; goal: number | null; isPrivate: boolean };
  username: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDeleted: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState("");
  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio);
  const [goal, setGoal] = useState(initial.goal ? String(initial.goal) : "");
  const [isPrivate, setPrivate] = useState(initial.isPrivate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await deleteMyAccount();
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t delete your account");
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const g = parseInt(goal, 10);
      await updateMyProfile({
        display_name: name.trim() || null,
        bio: bio.replace(/\s*\n\s*\n+/g, "\n").trim().slice(0, 160) || null,
        yearly_goal: Number.isFinite(g) && g > 0 ? Math.min(g, 1000) : null,
        is_private: isPrivate,
      });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save");
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={() => !busy && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Edit profile" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <h2 className="d" style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em" }}>Edit profile</h2>
        <div className="field" style={{ marginTop: 16 }}>
          <label htmlFor="pname">Name</label>
          <input id="pname" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </div>
        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor="pbio" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Status</span>
            <span className="m muted" style={{ fontWeight: 400 }}>{bio.length}/160</span>
          </label>
          <textarea id="pbio" className="input" rows={2} value={bio} maxLength={160} onChange={(e) => setBio(e.target.value)}
            placeholder="Deep in a Russian novel phase. Send short books." style={{ resize: "none", paddingTop: 12, lineHeight: 1.4, height: "auto" }} />
          <span className="muted" style={{ fontSize: 12 }}>Everyone can see this, even if your shelf is private.</span>
        </div>
        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor="pgoal">Books to read in {new Date().getFullYear()}</label>
          <input id="pgoal" className="input" inputMode="numeric" value={goal} onChange={(e) => setGoal(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="e.g. 30" />
        </div>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 12, marginTop: 16, cursor: "pointer" }}>
          <input type="checkbox" checked={isPrivate} onChange={(e) => setPrivate(e.target.checked)} style={{ width: 22, height: 22, marginTop: 2, accentColor: "var(--ink)" }} />
          <span>
            <span style={{ fontWeight: 600, display: "block" }}>Private shelf</span>
            <span className="muted" style={{ fontSize: 13 }}>Only you see your shelf and rankings. You won&rsquo;t appear in friends&rsquo; feeds, and your scores aren&rsquo;t used for anyone&rsquo;s community or predicted scores.</span>
          </span>
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn--block" style={{ marginTop: 20 }} disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
        {!confirmDelete ? (
          <button className="btn btn--ghost btn--block" style={{ marginTop: 8, color: "#b42318" }} disabled={busy} onClick={() => setConfirmDelete(true)}>
            Delete account
          </button>
        ) : (
          <div style={{ marginTop: 16, padding: 14, borderRadius: 16, background: "#fdecea" }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, color: "#7a1a12" }}>
              This permanently deletes your account, shelf, rankings and follows. It can&rsquo;t be undone. Type <strong>{username}</strong> to confirm.
            </p>
            <label htmlFor="confirm-del" className="visually-hidden">Type your username to confirm</label>
            <input id="confirm-del" className="input" style={{ width: "100%", marginTop: 10 }} value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="none" autoComplete="off" />
            <button className="btn btn--block" style={{ marginTop: 10, background: "#b42318" }} disabled={busy || typed !== username} onClick={remove}>
              Delete forever
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
