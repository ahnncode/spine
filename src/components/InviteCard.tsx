"use client";

import { useState } from "react";
import { Medallion } from "@/components/Badge";
import { ShareIcon } from "@/components/icons";
import { inviteUrl } from "@/lib/data";

/** Share your invite link; three friends who join and rank earns Connector. */
export function InviteCard({ username, friends, earned }: { username: string; friends: number; earned: boolean }) {
  const [copied, setCopied] = useState(false);
  const url = inviteUrl(username);

  async function share() {
    const text = "I’m ranking my books on Spine — come compare taste with me.";
    try {
      if (navigator.share) {
        // One string, not text + url: iOS treats those as two items, so
        // "Copy" and Messages show the link twice.
        await navigator.share({ text: `${text} ${url}` });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy your invite link", url);
    }
  }

  const n = Math.min(friends, 3);
  return (
    <section className="card invite-card" style={{ marginTop: 10, display: "flex", gap: 14, alignItems: "center" }}>
      <Medallion badge="connector" earned={earned} progress={n / 3} size={60} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700 }}>{earned ? "You’re a Connector" : "Invite 3 friends"}</div>
        <div style={{ fontSize: 13, marginTop: 2, lineHeight: 1.35 }}>
          {earned ? "Keep sharing — every friend makes your feed better." : "When 3 friends join with your link and rank 3 books each, you earn Connector."}
        </div>
        {!earned && (
          <div className="dots" style={{ marginTop: 8 }} aria-label={`${n} of 3 friends`}>
            {[0, 1, 2].map((i) => <span key={i} data-on={i < n} />)}
          </div>
        )}
      </div>
      <button className="btn" style={{ minHeight: 40, fontSize: 14, padding: "0 14px", flexShrink: 0 }} onClick={share} aria-label="Share your invite link">
        <ShareIcon size={16} /> {copied ? "Copied" : "Invite"}
      </button>
    </section>
  );
}
