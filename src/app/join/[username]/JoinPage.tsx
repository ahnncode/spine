"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/Auth";
import { Avatar, displayName } from "@/components/Avatar";
import { Medallion } from "@/components/Badge";
import { Logo } from "@/components/Logo";
import { inviteInfo, rememberReferrer } from "@/lib/data";

/** Where an invite link lands: who invited you, and a way in. */
export function JoinPage() {
  const { username } = useParams<{ username: string }>();
  const { session, loading } = useAuth();
  const [inviter, setInviter] = useState<{ display_name: string | null; username: string } | null | undefined>(undefined);

  useEffect(() => {
    inviteInfo(username)
      .then((p) => {
        setInviter(p);
        if (p) rememberReferrer(p.username);
      })
      .catch(() => setInviter(null));
  }, [username]);

  const name = inviter ? displayName(inviter) : null;
  const first = name?.split(/\s+/)[0];
  const signedIn = !loading && Boolean(session);

  return (
    <div className="app">
      <main className="screen screen--flow">
        <div className="topbar">
          <Logo size={30} />
        </div>

        {inviter === undefined ? (
          <div aria-busy="true" style={{ minHeight: 320 }} />
        ) : (
          <>
            <div style={{ marginTop: 44 }}>
              {inviter && <Avatar profile={{ id: inviter.username, username: inviter.username, display_name: inviter.display_name, is_private: false, yearly_goal: null }} size={72} />}
            </div>
            <h1 className="h1" style={{ fontSize: 46, lineHeight: 0.95, marginTop: 18 }}>
              {first ? <>{first} wants to compare shelves.</> : <>Rank books, not stars.</>}
            </h1>
            <p className="lede" style={{ fontSize: 17 }}>
              Spine turns every book you finish into a quick head-to-head, so you end up with an honest ranked shelf
              {first ? <> — and a taste match with {first}.</> : "."}
            </p>

            <ul style={{ listStyle: "none", padding: 0, margin: "26px 0 0", display: "grid", gap: 14 }}>
              {[
                { badge: "first_chapter", text: "Rank your first book in about a minute" },
                { badge: "reading_twin", text: "See your taste match with friends" },
                { badge: "moving_in", text: "Coming from Goodreads? Bring your library" },
              ].map((r) => (
                <li key={r.badge} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <Medallion badge={r.badge} earned size={44} />
                  <span style={{ fontSize: 15, fontWeight: 500 }}>{r.text}</span>
                </li>
              ))}
            </ul>

            <div className="spacer" style={{ minHeight: 32 }} />
            {signedIn ? (
              <>
                <p className="muted" style={{ fontSize: 14, textAlign: "center", margin: "0 0 12px" }}>You&rsquo;re already on Spine.</p>
                <Link href={inviter ? `/u/${inviter.username}` : "/feed"} className="btn btn--block">
                  {first ? `See ${first}’s shelf` : "Open Spine"}
                </Link>
              </>
            ) : (
              <Link href="/login" className="btn btn--block">
                {first ? `Join ${first} on Spine` : "Start your shelf"}
              </Link>
            )}
            {!inviter && (
              <p className="muted" style={{ textAlign: "center", fontSize: 13, margin: "12px 0 0" }}>This invite link doesn&rsquo;t match a reader, but you&rsquo;re still welcome.</p>
            )}
            <p className="muted" style={{ textAlign: "center", fontSize: 13, margin: "20px 0 0" }}>
              <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
            </p>
          </>
        )}
      </main>
    </div>
  );
}
