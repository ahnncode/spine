import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthGate } from "@/components/AuthGate";
import { PublicBookView } from "@/components/PublicBookView";
import { getPublicBook } from "@/lib/public";
import { formatScore } from "@/lib/ranking";
import { BookPage } from "./BookPage";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const book = await getPublicBook(id);
  if (!book) return { title: "Book — ReadRead" };
  const by = book.author ? ` by ${book.author}` : "";
  const score = book.avg_score != null ? ` ReadRead score ${formatScore(book.avg_score)} from ${book.readers} reader${book.readers === 1 ? "" : "s"}.` : "";
  const description = `${book.title}${by} on ReadRead.${score} Rank it against the books you've read and compare taste with friends.`;
  return {
    title: `${book.title}${by} — ReadRead`,
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
