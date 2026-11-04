"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAuth, useProfile } from "@/components/Auth";
import { Avatar } from "@/components/Avatar";
import { Name } from "@/components/Badge";
import { FollowButton } from "@/components/FollowButton";
import { BackIcon, SearchIcon, ShareIcon } from "@/components/icons";
import { TabBar } from "@/components/TabBar";
import { fetchFollowing, fetchProfiles, searchProfiles, similarReaders, type Profile } from "@/lib/data";

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
    const url = `${window.location.origin}/u/${me?.username}`;
    const text = "I’m ranking books on readread — come see how our taste compares.";
    try {
      if (navigator.share) await navigator.share({ title: "readread", text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
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
        </div>

        {shown ? (
          shown.length ? <div style={{ marginTop: 8 }}>{shown.map((p) => row(p))}</div> : (
            <div className="empty"><p className="h2">No one by that name yet</p><p style={{ margin: 0, fontSize: 14 }}>Invite them below.</p></div>
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
            <h2 className="h2" style={{ marginTop: 22 }}>Readers like you</h2>
            {!similar ? <div aria-busy="true" style={{ minHeight: 80 }} /> : similar.length ? (
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
