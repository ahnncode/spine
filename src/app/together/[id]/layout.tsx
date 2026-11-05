import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getReadAlongCard } from "@/lib/public";

type Props = { params: Promise<{ id: string }>; children: ReactNode };

// Read-alongs are private: link previews show the book, but search engines stay out.
export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const { id } = await params;
  const card = await getReadAlongCard(id);
  const title = card ? `Reading ${card.title} together · readread` : "A read-along on readread";
  const description = card
    ? `${card.readers} reader${card.readers === 1 ? "" : "s"} reading ${card.title}${card.author ? ` by ${card.author}` : ""} together on readread.`
    : "Read a book with friends on readread.";
  return { title, description, robots: { index: false, follow: false }, openGraph: { title, description }, twitter: { card: "summary_large_image", title, description } };
}

export default function Layout({ children }: Props) {
  return children;
}
