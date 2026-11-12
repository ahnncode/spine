import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { EarlyPill, Medallion } from "@/components/Badge";
import { Blurb } from "@/components/Blurb";
import { Cover } from "@/components/Cover";
import { PublicShell } from "@/components/PublicShell";
import { ScoreChip } from "@/components/ScoreChip";
import { BADGE, byRarity, isEarlyAdopter } from "@/lib/badges";
import type { PublicProfile } from "@/lib/public";
import type { Bucket } from "@/lib/ranking";

function bucketFor(score: number): Bucket {
  return score >= 6.7 ? "loved" : score >= 3.4 ? "fine" : "disliked";
}


function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** A reader's profile for people without an account (only if they've made it public). */
export function PublicProfileView({ username, profile }: { username: string; profile: PublicProfile | null }) {
  const back = `/u/${username}`;
  if (!profile) {
    return (
      <PublicShell back={back} pitch="Rank every book you read with quick head-to-heads, follow friends, and find readers with your taste.">
        <div className="empty">
          <p className="h2">@{username} is on readread</p>
          <p style={{ margin: 0, fontSize: 14 }}>Join to see their shelf and how your taste compares.</p>
        </div>
      </PublicShell>
    );
  }
  const name = profile.display_name || profile.username;
  const first = name.split(" ")[0];
  const badges = byRarity(profile.badges.map((key) => ({ key }))).slice(0, 8);
  return (
    <PublicShell back={back} pitch={`Follow ${first}, see your taste match, and build your own ranked shelf.`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd({
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          url: `https://readread.app/u/${profile.username}`,
          mainEntity: { "@type": "Person", name, alternateName: `@${profile.username}`, ...(profile.bio ? { description: profile.bio } : {}) },
        }) }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12 }}>
        <Avatar profile={{ id: profile.username, ...profile }} size={68} />
        <div style={{ minWidth: 0 }}>
          <h1 className="h1" style={{ fontSize: 28 }}>{name}</h1>
          <div className="muted" style={{ fontSize: 13 }}>@{profile.username} · {profile.ranked} ranked · {profile.followers} followers</div>
          {isEarlyAdopter(profile.joined) && <div style={{ marginTop: 8 }}><EarlyPill /></div>}
        </div>
      </div>
      {profile.bio && <Blurb text={profile.bio} name={name} />}

      {profile.reading.length > 0 && (
        <>
          <h2 className="h2" style={{ marginTop: 24 }}>Reading now</h2>
          <div className="cover-strip">
            {profile.reading.map((b) => (
              <Link key={b.book_id} href={`/book/${b.book_id}`} className="cover-strip__item">
                <Cover book={b} width={76} />
                <span className="cover-strip__title">{b.title}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {badges.length > 0 && (
        <>
          <h2 className="h2" style={{ marginTop: 20 }}>Badges</h2>
          <div className="badge-strip">
            {badges.map((b) => (
              <div key={b.key} className="badge-cell" style={{ width: 64, flexShrink: 0 }}>
                <Medallion badge={b.key} earned size={52} />
                <span className="badge-cell__name">{BADGE[b.key].name}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="h2" style={{ marginTop: 20 }}>{first}&rsquo;s top {Math.min(10, profile.top.length) || ""}</h2>
      {profile.top.length === 0 ? (
        <p className="muted" style={{ fontSize: 14 }}>Nothing ranked yet.</p>
      ) : (
        <ol style={{ listStyle: "none", margin: "4px 0 0", padding: 0 }}>
          {profile.top.map((b) => (
            <li key={b.book_id}>
              <Link href={`/book/${b.book_id}`} className="book-row">
                <span className={`book-row__rank ${b.rank <= 3 ? "book-row__rank--top" : ""}${b.rank === 1 ? " book-row__rank--first" : ""}`}>{b.rank}</span>
                <Cover book={b} width={44} />
                <span className="book-row__body">
                  <span className="book-row__title" style={{ display: "block" }}>{b.title}</span>
                  <span className="book-row__sub" style={{ display: "block" }}>{b.author}</span>
                </span>
                <ScoreChip score={b.score} bucket={bucketFor(b.score)} />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </PublicShell>
  );
}
