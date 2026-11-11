/**
 * Book clubs: members, one current read with a weekly plan, a room per week
 * (open once you've read that far), and the club's verdict. The database
 * enforces who can see and do what; see book_clubs.sql.
 */
import type { Book } from "./books";
import { ensureBook, fetchBooks, myId } from "./data";
import { searchBooks } from "./openlibrary";
import { supabase } from "./supabase";

export type ClubRole = "host" | "cohost" | "member";
export type ClubColor = "ember" | "cobalt" | "forest" | "plum" | "ink" | "gold" | "teal";

/**
 * bg/fg: the club tile. text/textDark: the club's colour as text or a thin
 * mark, picked to pass 4.5:1 on the light and dark surfaces.
 */
export const CLUB_COLORS: Record<ClubColor, { bg: string; fg: string; text: string; textDark: string }> = {
  ember: { bg: "#9A3412", fg: "#FFF1E6", text: "#9A3412", textDark: "#FDBA8C" },
  cobalt: { bg: "#1D2BA8", fg: "#E7E9FD", text: "#1D2BA8", textDark: "#A5B4FC" },
  forest: { bg: "#2D5A3D", fg: "#EAF4EC", text: "#2D5A3D", textDark: "#86EFAC" },
  plum: { bg: "#6B2A4E", fg: "#F7E7EE", text: "#6B2A4E", textDark: "#F0ABFC" },
  ink: { bg: "#1F1F1F", fg: "#F4F3EF", text: "#1F1F1F", textDark: "#E7E5E4" },
  gold: { bg: "#B07A12", fg: "#1A1300", text: "#7A5300", textDark: "#FCD34D" },
  teal: { bg: "#0F5257", fg: "#E8F3F1", text: "#0F5257", textDark: "#5EEAD4" },
};

/** CSS variables for a club's colours; `.club-accent` and the week bars read them. */
export function clubVars(color: ClubColor): Record<string, string> {
  const c = CLUB_COLORS[color] ?? CLUB_COLORS.ember;
  return { "--club": c.text, "--club-text": c.text, "--club-text-dark": c.textDark };
}

export const COMMENT_MAX = 1000;
/** Week 0 is the whole-book room. */
export const WHOLE_BOOK = 0;

export interface ClubCard {
  id: string;
  name: string;
  description: string | null;
  color: ClubColor;
  list_id: string | null;
  has_password: boolean;
  created_at: string;
  members: number;
  current_read: string | null;
  current_book: string | null;
  ends_on: string | null;
}

/** A read's plan is in chapters, or in percent when nobody knows the chapter count. */
export type PlanUnit = "chapter" | "percent";

export interface PlanWeek {
  /** Where to have read to by the end of this week: a chapter, or a percent. */
  through: number;
  /** YYYY-MM-DD. */
  due: string;
  questions?: string[];
}

export interface ClubRead {
  id: string;
  club_id: string;
  book_id: string;
  list_position: number | null;
  starts_on: string;
  ends_on: string;
  plan: PlanWeek[];
  /** Older rows predate the column; treat missing as chapter. */
  unit?: PlanUnit;
  finished_at: string | null;
  created_at: string;
}

export interface ClubMember {
  club_id: string;
  user_id: string;
  role: ClubRole;
  joined_at: string;
}

export interface ReadingList {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

export interface ListItem {
  list_id: string;
  position: number;
  year: number | null;
  title: string;
  author: string;
  note: string | null;
}

export interface ClubComment {
  id: string;
  read_id: string;
  week: number;
  user_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
}

export interface PaceRow {
  user_id: string;
  reached: number | null;
  read_before: boolean;
}

// ---------------------------------------------------------------- clubs

export async function fetchClubCards(opts: { ids?: string[]; query?: string; limit?: number } = {}): Promise<ClubCard[]> {
  if (opts.ids && !opts.ids.length) return [];
  const { data, error } = await supabase().rpc("club_cards", {
    p_ids: opts.ids ?? null,
    p_query: opts.query?.trim() || null,
    p_limit: opts.limit ?? 30,
  });
  if (error) throw error;
  return ((data as ClubCard[]) || []).map((c) => ({ ...c, members: Number(c.members) }));
}

/** Clubs you're in, with your role. */
export async function fetchMyClubs(): Promise<Array<{ club_id: string; role: ClubRole }>> {
  const uid = await myId();
  const { data, error } = await supabase().from("club_members").select("club_id, role").eq("user_id", uid);
  if (error) throw error;
  return (data as Array<{ club_id: string; role: ClubRole }>) || [];
}

export async function fetchClubMembers(clubId: string): Promise<ClubMember[]> {
  const { data, error } = await supabase().from("club_members").select("club_id, user_id, role, joined_at").eq("club_id", clubId).order("joined_at");
  if (error) throw error;
  return (data as ClubMember[]) || [];
}

export async function createClub(input: { name: string; description?: string; color?: ClubColor; list?: string | null; password?: string | null }): Promise<string> {
  const { data, error } = await supabase().rpc("create_club", {
    p_name: input.name,
    p_description: input.description ?? null,
    p_color: input.color ?? "ember",
    p_list: input.list ?? null,
    p_password: input.password || null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function updateClub(clubId: string, input: { name: string; description?: string | null; color: ClubColor; list?: string | null; password?: string | null; clearPassword?: boolean }): Promise<void> {
  const { error } = await supabase().rpc("update_club", {
    p_club: clubId,
    p_name: input.name,
    p_description: input.description ?? null,
    p_color: input.color,
    p_list: input.list === undefined ? null : input.list ?? "",
    p_password: input.password || null,
    p_clear_password: Boolean(input.clearPassword),
  });
  if (error) throw new Error(error.message);
}

export type JoinResult = "joined" | "wrong_password" | "locked";

export async function joinClub(clubId: string, password?: string): Promise<JoinResult> {
  const { data, error } = await supabase().rpc("join_club", { p_club: clubId, p_password: password ?? null });
  if (error) throw new Error(error.message);
  return data as JoinResult;
}

export type InviteJoinResult = "joined" | "bad_invite" | "locked";

export async function joinClubByInvite(clubId: string, code: string): Promise<InviteJoinResult> {
  const { data, error } = await supabase().rpc("join_club_by_invite", { p_club: clubId, p_code: code });
  if (error) throw new Error(error.message);
  return data as InviteJoinResult;
}

/** The club's private invite code (members only). */
export async function fetchInviteCode(clubId: string): Promise<string | null> {
  const { data, error } = await supabase().rpc("club_invite_code", { p_club: clubId });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function resetInviteCode(clubId: string): Promise<string> {
  const { data, error } = await supabase().rpc("reset_club_invite", { p_club: clubId });
  if (error) throw new Error(error.message);
  return data as string;
}

export function inviteUrl(clubId: string, code: string): string {
  const origin = typeof window === "undefined" ? "https://readread.app" : window.location.origin;
  return `${origin}/clubs/${clubId}?invite=${encodeURIComponent(code)}`;
}

/** Club ids, with how many of each club's members you follow. One query. */
export async function friendsInClubs(clubIds: string[], following: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!clubIds.length || !following.length) return out;
  const { data, error } = await supabase().from("club_members").select("club_id, user_id").in("club_id", clubIds.slice(0, 100)).in("user_id", following.slice(0, 300));
  if (error) throw error;
  for (const r of (data as Array<{ club_id: string; user_id: string }>) || []) out.set(r.club_id, [...(out.get(r.club_id) ?? []), r.user_id]);
  return out;
}

/** Problems with a weekly plan, or null if it's fine. */
export function planProblem(plan: PlanWeek[], total: number, unit: PlanUnit = "chapter"): string | null {
  for (let i = 0; i < plan.length; i++) {
    if (!(plan[i].through >= 1)) return unit === "percent" ? `Week ${i + 1} needs a percent` : `Week ${i + 1} needs a chapter`;
    if (i > 0 && plan[i].through <= plan[i - 1].through) return `Week ${i + 1} has to end after week ${i}`;
  }
  if (plan.length && plan[plan.length - 1].through !== total) {
    return unit === "percent" ? "The last week should end at 100%" : `The last week should end at chapter ${total}`;
  }
  return null;
}

/** "chapter 7" or "40%". */
export function atLabel(unit: PlanUnit | undefined, n: number): string {
  return unit === "percent" ? `${n}%` : `chapter ${n}`;
}

/** "3 chapters behind" or "12% behind". */
export function behindLabel(unit: PlanUnit | undefined, n: number): string {
  return unit === "percent" ? `${n}% behind` : `${n} chapter${n === 1 ? "" : "s"} behind`;
}

/** The chapter count other readers have entered for a book, or null. */
export async function bookChapterGuess(bookId: string): Promise<number | null> {
  const { data, error } = await supabase().rpc("book_chapter_guess", { p_book: bookId });
  if (error) return null;
  const n = Number(data);
  return n >= 1 && n <= 999 ? n : null;
}

const NOT_A_CHAPTER = /contents|acknowledg|about the author|copyright|dedication|index|bibliograph|title page|also by|praise|epigraph|author'?s note|notes|glossary|reading group|cover/i;
const CHAPTER_LIKE = /^(chapter|ch\.?)\s+\w+|^\d{1,3}\.?$|^[ivxlc]{1,7}\.?$/i;

/**
 * Count chapters from an Open Library edition's table of contents, if any
 * edition has one. Best effort: modern novels often have none.
 */
export async function openLibraryChapters(workKey: string | null | undefined, signal?: AbortSignal): Promise<number | null> {
  if (!workKey) return null;
  const key = workKey.startsWith("/works/") ? workKey : `/works/${workKey.replace(/^\/+/, "")}`;
  try {
    const res = await fetch(`https://openlibrary.org${key}/editions.json?limit=50`, { signal });
    if (!res.ok) return null;
    const { entries } = (await res.json()) as { entries?: Array<{ table_of_contents?: Array<{ level?: number; title?: string; label?: string }> }> };
    const counts: number[] = [];
    for (const e of entries ?? []) {
      const toc = (e.table_of_contents ?? []).filter((t) => (t.level ?? 0) === 0 && (t.title || t.label));
      if (toc.length < 3) continue;
      const names = toc.map((t) => `${t.label ?? ""} ${t.title ?? ""}`.trim());
      const chapterLike = toc.filter((t) => CHAPTER_LIKE.test((t.title ?? "").trim()) || CHAPTER_LIKE.test((t.label ?? "").trim())).length;
      const n = chapterLike >= 3 ? chapterLike : names.filter((x) => !NOT_A_CHAPTER.test(x)).length;
      if (n >= 3 && n <= 150) counts.push(n);
    }
    if (!counts.length) return null;
    // The most common count across editions.
    const tally = new Map<number, number>();
    for (const n of counts) tally.set(n, (tally.get(n) ?? 0) + 1);
    return [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
  } catch {
    return null;
  }
}

export async function leaveClub(clubId: string): Promise<void> {
  const { error } = await supabase().rpc("leave_club", { p_club: clubId });
  if (error) throw new Error(error.message);
}

export async function setClubRole(clubId: string, userId: string, role: "cohost" | "member"): Promise<void> {
  const { error } = await supabase().rpc("set_club_role", { p_club: clubId, p_user: userId, p_role: role });
  if (error) throw new Error(error.message);
}

export async function removeClubMember(clubId: string, userId: string): Promise<void> {
  const { error } = await supabase().rpc("remove_club_member", { p_club: clubId, p_user: userId });
  if (error) throw new Error(error.message);
}

export async function deleteClub(clubId: string): Promise<void> {
  const { error } = await supabase().from("clubs").delete().eq("id", clubId);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------- lists

export async function fetchLists(): Promise<ReadingList[]> {
  const { data, error } = await supabase().from("reading_lists").select("id, slug, name, description").order("name");
  if (error) throw error;
  return (data as ReadingList[]) || [];
}

export async function fetchListItems(listId: string): Promise<ListItem[]> {
  const { data, error } = await supabase().from("reading_list_items").select("list_id, position, year, title, author, note").eq("list_id", listId).order("position", { ascending: false });
  if (error) throw error;
  return (data as ListItem[]) || [];
}

/** Find (or add) the catalogue book for a list item, with a cover when Open Library has one. */
export async function bookForListItem(item: ListItem): Promise<string> {
  try {
    const found = await searchBooks(`${item.title} ${item.author}`);
    const surname = item.author.split(" ").pop()!.toLowerCase();
    const match = found.find((b) => b.title.toLowerCase().startsWith(item.title.toLowerCase().slice(0, 12)) && (b.author ?? "").toLowerCase().includes(surname));
    if (match) return await ensureBook({ ...match, year: match.year ?? item.year });
  } catch {
    /* search is best-effort */
  }
  return ensureBook({ title: item.title, author: item.author, year: item.year });
}

// ---------------------------------------------------------------- reads

export async function fetchReads(clubId: string): Promise<ClubRead[]> {
  const { data, error } = await supabase().from("club_reads").select("*").eq("club_id", clubId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data as ClubRead[]) || [];
}

export async function fetchRead(readId: string): Promise<ClubRead | null> {
  const { data, error } = await supabase().from("club_reads").select("*").eq("id", readId).maybeSingle();
  if (error) throw error;
  return (data as ClubRead | null) ?? null;
}

export async function startRead(clubId: string, bookId: string, starts: string, ends: string, plan: PlanWeek[], listPosition?: number | null, unit: PlanUnit = "chapter"): Promise<string> {
  const { data, error } = await supabase().rpc("start_club_read", {
    p_club: clubId, p_book: bookId, p_starts: starts, p_ends: ends, p_plan: plan, p_list_position: listPosition ?? null, p_unit: unit,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function updateRead(readId: string, ends: string, plan: PlanWeek[], unit?: PlanUnit): Promise<void> {
  const { error } = await supabase().rpc("update_club_read", { p_read: readId, p_ends: ends, p_plan: plan, p_unit: unit ?? null });
  if (error) throw new Error(error.message);
}

export async function finishRead(readId: string): Promise<void> {
  const { error } = await supabase().rpc("finish_club_read", { p_read: readId });
  if (error) throw new Error(error.message);
}

export async function setReadBefore(readId: string, before: boolean): Promise<void> {
  const { error } = await supabase().rpc("set_read_before", { p_read: readId, p_before: before });
  if (error) throw new Error(error.message);
}

export async function fetchPace(readId: string): Promise<PaceRow[]> {
  const { data, error } = await supabase().rpc("club_pace", { p_read: readId });
  if (error) throw error;
  return (data as PaceRow[]) || [];
}

// ---------------------------------------------------------------- week rooms

export async function fetchRoomCounts(readId: string): Promise<Map<number, number>> {
  const { data, error } = await supabase().rpc("club_room_counts", { p_read: readId });
  if (error) throw error;
  return new Map(((data as Array<{ week: number; comments: number }>) || []).map((r) => [r.week, Number(r.comments)]));
}

export async function fetchWeekComments(readId: string, week: number): Promise<ClubComment[]> {
  const { data, error } = await supabase()
    .from("club_comments")
    .select("id, read_id, week, user_id, parent_id, body, created_at")
    .eq("read_id", readId)
    .eq("week", week)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data as ClubComment[]) || [];
}

export async function postWeekComment(readId: string, week: number, body: string, parentId?: string | null): Promise<void> {
  const text = body.trim().slice(0, COMMENT_MAX);
  if (!text) throw new Error("Write something first");
  const { error } = await supabase().from("club_comments").insert({ read_id: readId, week, body: text, parent_id: parentId ?? null });
  if (error) throw new Error(error.code === "42501" ? "This week opens once you’ve read this far" : error.message);
}

export async function deleteWeekComment(id: string): Promise<void> {
  const { error } = await supabase().from("club_comments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------- plans

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parse(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Split a book's chapters evenly over the weeks between two dates: week N's
 * `through` is the last chapter to have read by its `due` date, and the last
 * week always ends on the finish date at the last chapter.
 */
export function buildPlan(chapters: number, starts: string, ends: string): PlanWeek[] {
  const start = parse(starts);
  const end = parse(ends);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 864e5));
  const weeks = Math.max(1, Math.min(chapters || 1, Math.round(days / 7) || 1));
  const plan: PlanWeek[] = [];
  for (let w = 1; w <= weeks; w++) {
    const due = w === weeks ? end : new Date(start.getTime() + Math.round((days * w) / weeks) * 864e5);
    plan.push({ through: w === weeks ? chapters : Math.max(1, Math.round((chapters * w) / weeks)), due: iso(due) });
  }
  return plan;
}

/** The week of the plan a date falls in (1-based), or the last week once past it. */
export function currentWeek(plan: PlanWeek[], today: string): number {
  if (!plan.length) return 1;
  const i = plan.findIndex((w) => today <= w.due);
  return i === -1 ? plan.length : i + 1;
}

/** "Chapters 4–6" (or "25–50%") for week N of a plan. */
export function weekRange(plan: PlanWeek[], week: number, unit: PlanUnit = "chapter"): string {
  if (week === WHOLE_BOOK) return "The whole book";
  if (unit === "percent") {
    const from = week === 1 ? 0 : (plan[week - 2]?.through ?? 0);
    const to = plan[week - 1]?.through ?? 100;
    return from === 0 ? `Up to ${to}%` : `${from}–${to}%`;
  }
  const from = week === 1 ? 1 : (plan[week - 2]?.through ?? 0) + 1;
  const to = plan[week - 1]?.through ?? from;
  return from >= to ? `Chapter ${to}` : `Chapters ${from}–${to}`;
}

/** Whether a reader at `reached` (or who read it before) can open a week's room. */
export function weekOpen(plan: PlanWeek[], week: number, reached: number | null, readBefore: boolean): boolean {
  if (readBefore || (reached ?? 0) >= 999) return true;
  if (week === WHOLE_BOOK) return false;
  const through = plan[week - 1]?.through;
  return through != null && (reached ?? 0) >= through;
}

/** Where the plan says the club should be today, as a chapter. */
export function expectedChapter(plan: PlanWeek[], starts: string, today: string): number {
  if (!plan.length || today < starts) return 0;
  let prevDue = starts;
  let prevThrough = 0;
  for (const w of plan) {
    if (today <= w.due) {
      const span = Math.max(1, (parse(w.due).getTime() - parse(prevDue).getTime()) / 864e5);
      const into = (parse(today).getTime() - parse(prevDue).getTime()) / 864e5;
      return Math.round(prevThrough + ((w.through - prevThrough) * into) / span);
    }
    prevDue = w.due;
    prevThrough = w.through;
  }
  return plan[plan.length - 1].through;
}

export async function booksFor(ids: string[]): Promise<Map<string, Book>> {
  const books = await fetchBooks([...new Set(ids.filter(Boolean))]);
  return new Map(books.map((b) => [b.id, b]));
}

// ---------------------------------------------------------------- notifications

export interface ClubLink {
  href: string;
  club: string;
  /** "Week 2" or "the whole book" for comments; the book's title for reads. */
  where: string;
}

/** Where a club notification should go: keyed by the read or comment id it points at. */
export async function fetchClubLinks(readIds: string[], commentIds: string[], clubIds: string[] = []): Promise<Map<string, ClubLink>> {
  const out = new Map<string, ClubLink>();
  if (!readIds.length && !commentIds.length && !clubIds.length) return out;
  const comments = commentIds.length
    ? (((await supabase().from("club_comments").select("id, read_id, week").in("id", commentIds.slice(0, 200))).data as Array<{ id: string; read_id: string; week: number }>) || [])
    : [];
  const allReads = [...new Set([...readIds, ...comments.map((c) => c.read_id)])];
  const { data } = await supabase().from("club_reads").select("id, club_id, book_id").in("id", allReads.slice(0, 200));
  const reads = new Map(((data as Array<{ id: string; club_id: string; book_id: string }>) || []).map((r) => [r.id, r]));
  const [cards, books] = await Promise.all([
    fetchClubCards({ ids: [...new Set([...[...reads.values()].map((r) => r.club_id), ...clubIds])] }).catch(() => [] as ClubCard[]),
    booksFor([...reads.values()].map((r) => r.book_id)).catch(() => new Map<string, Book>()),
  ]);
  const names = new Map(cards.map((c) => [c.id, c.name]));
  for (const id of readIds) {
    const r = reads.get(id);
    if (r) out.set(id, { href: `/clubs/${r.club_id}`, club: names.get(r.club_id) ?? "your club", where: books.get(r.book_id)?.title ?? "a new book" });
  }
  for (const id of clubIds) out.set(id, { href: `/clubs/${id}`, club: names.get(id) ?? "your club", where: "" });
  for (const c of comments) {
    const r = reads.get(c.read_id);
    if (r) out.set(c.id, { href: `/clubs/${r.club_id}/week/${c.week}`, club: names.get(r.club_id) ?? "your club", where: c.week === WHOLE_BOOK ? "the whole-book room" : `the week ${c.week} room` });
  }
  return out;
}
