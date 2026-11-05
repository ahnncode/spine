"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAuth, useProfile } from "@/components/Auth";
import { Avatar } from "@/components/Avatar";
import { Name } from "@/components/Badge";
import { FollowButton } from "@/components/FollowButton";
import { BackIcon, SearchIcon, ShareIcon } from "@/components/icons";
import { TabBar } from "@/components/TabBar";
import { fetchFollowing, fetchProfiles, inviteUrl, searchProfiles, similarReaders, type Profile } from "@/lib/data";
import { RowsSkeleton } from "@/components/Skeleton";

export default function PeoplePage() {
  return (
    <RequireAuth>
      <People />
    </RequireAuth>
  );
}

function People() {
  const { profile: me } = useProfile();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[] | null>(null);
  const [following, setFollowing] = useState<Set<string> | null>(null);
  const [similar, setSimilar] = useState<Array<{ profile: Profile; match: number; overlap: number }> | null>(null);
  const [copied, setCopied] = useState(false);

  // Arriving from Discover with "@name": start with that search.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the URL
    if (q) setQuery(q);
  }, []);

  useEffect(() => {
    fetchFollowing().then((ids) => setFollowing(new Set(ids))).catch(() => setFollowing(new Set()));
    similarReaders(15)
      .then(async (rows) => {
        const profiles = await fetchProfiles(rows.map((r) => r.user_id));
        setSimilar(rows.filter((r) => profiles.get(r.user_id)?.username).map((r) => ({ profile: profiles.get(r.user_id)!, match: r.match, overlap: r.overlap })));
      })
      .catch(() => setSimilar([]));
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const t = setTimeout(() => searchProfiles(query).then(setResults).catch(() => setResults([])), 250);
    return () => clearTimeout(t);
  }, [query]);

  async function invite() {
    // The invite link credits you when they join; one string so iOS shows the link once.
    const url = me?.username ? inviteUrl(me.username) : window.location.origin;
    const text = `I’m ranking books on readread. Come see if our taste matches: ${url}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      }
    } catch {
      /* dismissed */
    }
  }

  const shown = query.trim().length >= 2 ? results : null;

  const row = (p: Profile, sub?: string) => (
    <div key={p.id} className="person-row">
      <Avatar profile={p} size={44} link />
      <div className="person-row__body">
        <Link href={`/u/${p.username}`} className="name" style={{ textDecoration: "none" }}><Name profile={p} /></Link>
        <span className="muted" style={{ fontSize: 13 }}>@{p.username}{sub ? ` · ${sub}` : ""}</span>
      </div>
      {p.id !== me?.id && following && <FollowButton userId={p.id} initial={following.has(p.id)} />}
    </div>
  );

  return (
    <div className="app">
      <main className="screen">
        <div className="topbar">
          <Link href="/feed" className="icon-btn" aria-label="Back to feed"><BackIcon size={20} /></Link>
        </div>
        <h1 className="h1" style={{ marginTop: 12 }}>Find people</h1>
        <div className="search-box">
          <SearchIcon size={20} />
          <label htmlFor="pq" className="visually-hidden">Search by name or username</label>
          <input id="pq" className="input" type="search" placeholder="Name or @username" value={query} onChange={(e) => setQuery(e.target.value)} autoCapitalize="none" autoComplete="off" />
          {query && (
            <button type="button" className="search-clear" aria-label="Clear search" onClick={() => { setQuery(""); document.getElementById("pq")?.focus(); }}>
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>

        {shown ? (
          shown.length ? (
            <>
              <div style={{ marginTop: 8 }}>{shown.map((p) => row(p))}</div>
              <InviteSomeone query={query} username={me?.username ?? null} compact />
            </>
          ) : (
            <InviteSomeone query={query} username={me?.username ?? null} />
          )
        ) : (
          <>
            <button className="card card--ink" style={{ width: "100%", textAlign: "left", marginTop: 16, display: "flex", alignItems: "center", gap: 14 }} onClick={invite}>
              <ShareIcon size={22} />
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontWeight: 600 }}>{copied ? "Link copied" : "Invite friends"}</span>
                <span style={{ display: "block", fontSize: 13, color: "#c9c8c2", marginTop: 2 }}>Share your profile so they can follow you</span>
              </span>
            </button>
            <h2 className="h2" style={{ marginTop: 24 }}>Readers like you</h2>
            {!similar ? <RowsSkeleton avatar count={2} label="Finding readers like you" /> : similar.length ? (
              <div>{similar.map((s) => row(s.profile, `${s.match}% match`))}</div>
            ) : (
              <p className="muted" style={{ fontSize: 14 }}>Once you and other readers have ranked a few of the same books, your closest matches show up here.</p>
            )}
          </>
        )}
      </main>
      <TabBar />
    </div>
  );
}

/** What they typed, read as a contact: an email, a phone number, or a name. */
function asContact(query: string): { kind: "email" | "phone" | "name"; value: string } {
  const q = query.trim().replace(/^@/, "");
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q)) return { kind: "email", value: q };
  const digits = q.replace(/[^\d+]/g, "");
  if (/^\+?\d{7,15}$/.test(digits) && !/[a-z]/i.test(q)) return { kind: "phone", value: digits };
  return { kind: "name", value: q };
}

/**
 * Couldn't find them? Invite them right here: a text or email when they typed
 * a number or address, otherwise the share sheet, with your invite link.
 */
function InviteSomeone({ query, username, compact = false }: { query: string; username: string | null; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const contact = asContact(query);
  const url = username ? inviteUrl(username) : "https://readread.app";
  const first = contact.kind === "name" ? contact.value.split(/\s+/)[0] : "";
  // Friendly, with the name if they typed one (lowercase "hey" reads like a text).
  const greeting = first && first.length <= 20 && /^[\p{L}'-]+$/u.test(first) ? `hey ${first}! ` : "";
  const message = `${greeting}I’m ranking my books on readread. Join me and we can compare taste: ${url}`;

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ text: message });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
    copy();
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy your invite", message);
    }
  }

  const direct =
    contact.kind === "email"
      ? { href: `mailto:${contact.value}?subject=${encodeURIComponent("Join me on readread")}&body=${encodeURIComponent(message)}`, label: "Email them an invite" }
      : contact.kind === "phone"
        ? { href: `sms:${contact.value}?&body=${encodeURIComponent(message)}`, label: "Text them an invite" }
        : null;

  if (compact) {
    return (
      <button className="btn btn--ghost" style={{ marginTop: 12, paddingLeft: 0, fontSize: 14 }} onClick={share}>
        {copied ? "Invite copied" : "Don’t see them? Send an invite →"}
      </button>
    );
  }

  const who = contact.kind === "name" && contact.value ? `“${contact.value}”` : "them";
  return (
    <div className="card" style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <p className="h2" style={{ margin: 0 }}>{contact.kind === "name" ? <>No one called {who} yet</> : "They’re not on readread yet"}</p>
        <p className="muted" style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.45 }}>
          Send them your invite link. Once they&rsquo;ve ranked a few books, you&rsquo;ll see how your taste compares, and it counts toward your Connector badge.
        </p>
      </div>
      <div className="m muted" style={{ fontSize: 12, padding: "10px 12px", borderRadius: 10, background: "var(--well)", lineHeight: 1.45, overflowWrap: "anywhere" }}>
        {message}
      </div>
      {direct ? (
        <a href={direct.href} className="btn btn--block" style={{ textDecoration: "none" }}>{direct.label}</a>
      ) : (
        <button className="btn btn--block" onClick={share}>{first ? `Invite ${first}` : "Send an invite"}</button>
      )}
      <button className="btn btn--outline btn--block" onClick={copy}>{copied ? "Copied" : "Copy invite"}</button>
    </div>
  );
}
