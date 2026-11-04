import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthGate } from "@/components/AuthGate";
import { PublicProfileView } from "@/components/PublicProfileView";
import { getPublicProfile } from "@/lib/public";
import { ProfilePage } from "./ProfilePage";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const p = await getPublicProfile(username);
  if (!p) {
    // Not public: say only what the link itself already says.
    return { title: `@${username} on readread`, description: "Join readread to see their ranked shelf and compare your taste.", robots: { index: false } };
  }
  const name = p.display_name || p.username;
  const top = p.top.slice(0, 3).map((b) => b.title).join(", ");
  const description = p.bio || (top ? `${name}'s top books: ${top}. ${p.ranked} ranked on readread.` : `${name} is ranking books on readread.`);
  return {
    title: `${name} (@${p.username}) — readread`,
    description,
    alternates: { canonical: `/u/${p.username}` },
    openGraph: { title: `${name} on readread`, description, type: "profile", url: `/u/${p.username}` },
    twitter: { card: "summary_large_image", title: `${name} on readread`, description },
  };
}

async function Content({ params }: Props) {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  return (
    <AuthGate publicView={<PublicProfileView username={username.toLowerCase()} profile={profile} />}>
      <ProfilePage />
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
