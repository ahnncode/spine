import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthGate } from "@/components/AuthGate";
import { PublicBookView } from "@/components/PublicBookView";
import { getPublicBook } from "@/lib/public";
import { formatScore } from "@/lib/ranking";
import { BookPage } from "./BookPage";

type Props = { params: Promise<{ id: string }> };

/** The first sentence or two, cut at a word. */
function snippet(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const end = cut.lastIndexOf(". ");
  return end > max * 0.5 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const book = await getPublicBook(id);
  if (!book) return { title: "Book · readread" };
  const by = book.author ? ` by ${book.author}` : "";
  const score = book.avg_score != null ? ` readread score ${formatScore(book.avg_score)} from ${book.readers} reader${book.readers === 1 ? "" : "s"}.` : "";
  // Lead with what the book is about when we have it; search results show this.
  const about = book.description ? snippet(book.description, 150) : null;
  const description = about
    ? `${about}${score}`
    : `${book.title}${by} on readread.${score} Rank it against the books you've read and compare taste with friends.`;
  return {
    title: `${book.title}${by} · readread`,
    description,
    alternates: { canonical: `/book/${book.id}` },
    openGraph: { title: `${book.title}${by}`, description, type: "book", url: `/book/${book.id}` },
    twitter: { card: "summary_large_image", title: `${book.title}${by}`, description },
  };
}

async function Content({ params }: Props) {
  const { id } = await params;
  const book = await getPublicBook(id);
  return (
    <AuthGate publicView={<PublicBookView book={book} />}>
      <BookPage />
    </AuthGate>
  );
}

export default function Page({ params }: Props) {
  return (
    <Suspense>
      <Content params={params} />
    </Suspense>
  );
}
