import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import type { Profile, ReadAlong } from "@/lib/data";

/** Small stacked avatars of the friends you're reading a book with. */
export function ReadAlongStack({ ra, people, me, size = 22 }: { ra: ReadAlong; people: Map<string, Profile>; me?: string; size?: number }) {
  const others = ra.members.filter((m) => m.state === "joined" && m.user_id !== me);
  if (!others.length) return null;
  return (
    <Link href={`/together/${ra.id}`} className="ra-stack" aria-label={`Reading with ${others.length} friend${others.length === 1 ? "" : "s"}`}>
      <span className="avatar-stack">
        {others.slice(0, 3).map((m) => <Avatar key={m.user_id} profile={people.get(m.user_id)} size={size} />)}
      </span>
      <span>together</span>
    </Link>
  );
}
