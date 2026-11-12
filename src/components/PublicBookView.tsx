import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Cover } from "@/components/Cover";
import { PublicShell } from "@/components/PublicShell";
import { ScoreChip } from "@/components/ScoreChip";
import { GENRE_BY_KEY } from "@/lib/genres";
import type { PublicBook } from "@/lib/public";
import { formatScore, type Bucket } from "@/lib/ranking";

function bucketFor(score: number): Bucket {
  return score >= 6.7 ? "loved" : score >= 3.4 ? "fine" : "disliked";
}


function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** A book's page for people without an account. */
export function PublicBookView({ book }: { book: PublicBook | null }) {
  if (!book) {
    return (
      <PublicShell back="/" pitch="Rank every book you read with quick head-to-heads, and see what your friends are reading.">
        <div className="empty"><p className="h2">We couldn&rsquo;t find that book</p></div>
      </PublicShell>
    );
  }
  const back = `/book/${book.id}`;
  const lovedPct = book.readers ? Math.round((book.loved / book.readers) * 100) : 0;
  return (
    <PublicShell back={back} pitch={`Add ${book.title} to your shelf, rank it against the books you've read, and compare taste with friends.`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd({
          "@context": "https://schema.org",
          "@type": "Book",
          name: book.title,
          url: `https://readread.app/book/${book.id}`,
          ...(book.author ? { author: { "@type": "Person", name: book.author } } : {}),
          ...(book.isbn13 ? { isbn: book.isbn13 } : {}),
          ...(book.description ? { description: book.description } : {}),
          ...(book.pages ? { numberOfPages: book.pages } : {}),
          ...(book.year ? { datePublished: String(book.year) } : {}),
          ...(book.avg_score != null && book.readers > 0
            ? { aggregateRating: { "@type": "AggregateRating", ratingValue: book.avg_score, bestRating: 10, worstRating: 0, ratingCount: book.readers } }
            : {}),
        }) }}
      />
      <div style={{ display: "flex", gap: 18, alignItems: "flex-end", marginTop: 12 }}>
        <Cover book={book} width={120} priority />
        <div style={{ minWidth: 0 }}>
          <h1 className="h1" style={{ fontSize: 28 }}>{book.title}</h1>
          <p className="muted" style={{ margin: "6px 0 0", fontSize: 15 }}>
            {[book.author, book.year, book.pages ? `${book.pages} pages` : null].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      {book.genres.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 16 }}>
          {book.genres.map((g) => GENRE_BY_KEY[g] && (
            <span key={g} className="pill" style={{ background: GENRE_BY_KEY[g].bg, color: GENRE_BY_KEY[g].fg }}>{GENRE_BY_KEY[g].label}</span>
          ))}
        </div>
      )}

      {book.description && (
        <section style={{ marginTop: 16 }} aria-label="About this book">
          <p className="book-summary">{book.description}</p>
        </section>
      )}

      <section className="card" style={{ marginTop: 20, display: "flex", gap: 16, alignItems: "center" }}>
        {book.avg_score != null ? (
          <>
            <ScoreChip score={book.avg_score} bucket={bucketFor(book.avg_score)} size={64} />
            <div>
              <div style={{ fontWeight: 700 }}>readread score {formatScore(book.avg_score)}</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                From {book.readers} reader{book.readers === 1 ? "" : "s"} · {lovedPct}% loved it
              </div>
            </div>
          </>
        ) : (
          <div>
            <div style={{ fontWeight: 700 }}>No rankings yet</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>Be the first to rank it on readread.</div>
          </div>
        )}
      </section>

      {book.public_readers.length > 0 && (
        <section style={{ marginTop: 20 }}>
          <h2 className="h2">Readers on readread</h2>
          <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0 }}>
            {book.public_readers.map((r) => (
              <li key={r.username}>
                <Link href={`/u/${r.username}`} className="book-row">
                  <Avatar profile={{ id: r.username, username: r.username, display_name: r.display_name, avatar_icon: r.avatar_icon, avatar_color: r.avatar_color }} size={36} />
                  <span className="book-row__body">
                    <span className="book-row__title" style={{ display: "block", fontSize: 15 }}>{r.display_name || r.username}</span>
                    <span className="book-row__sub" style={{ display: "block" }}>@{r.username}</span>
                  </span>
                  <ScoreChip score={Number(r.score)} bucket={bucketFor(Number(r.score))} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PublicShell>
  );
}
