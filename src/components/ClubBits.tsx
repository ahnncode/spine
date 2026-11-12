"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useProfile } from "@/components/Auth";
import { BackIcon } from "@/components/icons";
import type { Book } from "@/lib/books";
import {
  CLUB_COLORS, booksFor, fetchClubCards, fetchClubMembers, fetchReads,
  type ClubCard, type ClubColor, type ClubMember, type ClubRead, type ClubRole,
} from "@/lib/clubs";
import { fetchProfiles, type Profile } from "@/lib/data";

/** The club's letter tile, in its colour. */
export function ClubTile({ name, color, size = 48 }: { name: string; color: ClubColor; size?: number }) {
  const c = CLUB_COLORS[color] ?? CLUB_COLORS.ember;
  return (
    <span aria-hidden="true" className="club-tile" style={{ width: size, height: size, borderRadius: size * 0.28, background: c.bg, color: c.fg, fontSize: size * 0.46 }}>
      {name.trim().charAt(0).toUpperCase() || "B"}
    </span>
  );
}

export interface ClubData {
  card: ClubCard;
  members: ClubMember[];
  people: Map<string, Profile>;
  role: ClubRole | null;
  reads: ClubRead[];
  current: ClubRead | null;
  books: Map<string, Book>;
}

/** Everything a club screen needs: the club, its members, your role, its reads and their books. */
export function useClub(clubId: string) {
  const { profile } = useProfile();
  const [data, setData] = useState<ClubData | null | undefined>(undefined);

  const load = useCallback(async () => {
    const [cards, members, reads] = await Promise.all([fetchClubCards({ ids: [clubId] }), fetchClubMembers(clubId), fetchReads(clubId)]);
    const card = cards[0];
    if (!card) {
      setData(null);
      return;
    }
    const [people, books] = await Promise.all([fetchProfiles(members.map((m) => m.user_id)), booksFor(reads.map((r) => r.book_id))]);
    setData({
      card, members, people, reads, books,
      current: reads.find((r) => !r.finished_at) ?? null,
      role: members.find((m) => m.user_id === profile?.id)?.role ?? null,
    });
  }, [clubId, profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from the network
    load().catch(() => setData(null));
  }, [load, profile?.id]);

  return { data, reload: load, me: profile };
}

/** Screen frame for club pages: back button, a small line above, the title. */
export function ClubScreen({ eyebrow, title, back, children, action }: { eyebrow?: ReactNode; title: ReactNode; back: string; children: ReactNode; action?: ReactNode }) {
  const router = useRouter();
  return (
    <div className="app">
      <main className="screen screen--flow" style={{ paddingTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="icon-btn" aria-label="Back" onClick={() => (window.history.length > 1 ? router.back() : router.push(back))}><BackIcon size={20} /></button>
          <div style={{ minWidth: 0, flex: 1 }}>
            {eyebrow && <span className="muted" style={{ display: "block", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{eyebrow}</span>}
            <h1 className="g" style={{ margin: 0, fontSize: 24, lineHeight: 1.15, fontWeight: 400 }}>{title}</h1>
          </div>
          {action}
        </div>
        {children}
      </main>
    </div>
  );
}

export function NotAMember({ clubId }: { clubId: string }) {
  return (
    <div className="empty" style={{ marginTop: 24 }}>
      <p className="h2">Members only</p>
      <p style={{ margin: 0, fontSize: 14 }}>Join the club to see this.</p>
      <Link href={`/clubs/${clubId}`} className="btn" style={{ marginTop: 12 }}>See the club</Link>
    </div>
  );
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function shortDate(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(y === new Date().getFullYear() ? {} : { year: "numeric" }) });
}
