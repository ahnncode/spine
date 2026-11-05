/** "just now", "5 min ago", "3 hr ago", "2 days ago", then "Mar 4". Words, not "2d". */
export function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} hr ago`;
  const days = Math.round(s / 86400);
  if (days < 7) return days === 1 ? "yesterday" : `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** For a calendar day: "today", "yesterday", "2 days ago"; "" past a month. */
export function dayAgo(day: string | null | undefined): string {
  if (!day) return "";
  const days = Math.round((Date.now() - new Date(`${day}T12:00:00`).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return "";
}
