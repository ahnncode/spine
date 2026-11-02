"use client";

import { useState } from "react";
import { follow, unfollow } from "@/lib/data";

export function FollowButton({ userId, initial, onChange }: { userId: string; initial: boolean; onChange?: (following: boolean) => void }) {
  const [following, setFollowing] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const next = !following;
    setFollowing(next);
    try {
      await (next ? follow(userId) : unfollow(userId));
      onChange?.(next);
    } catch {
      setFollowing(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="follow-btn" aria-pressed={following} disabled={busy} onClick={toggle}>
      {following ? "Following" : "Follow"}
    </button>
  );
}
