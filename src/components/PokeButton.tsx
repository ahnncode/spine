"use client";

import { useEffect, useState } from "react";
import { PokeIcon } from "@/components/icons";
import { poke, pokedToday } from "@/lib/data";

/** Nudge a friend about their reading, once a day. */
export function PokeButton({ userId, name }: { userId: string; name: string }) {
  const [state, setState] = useState<"idle" | "sent" | "done">("idle");

  useEffect(() => {
    let live = true;
    pokedToday(userId).then((already) => live && already && setState("done")).catch(() => {});
    return () => {
      live = false;
    };
  }, [userId]);

  // Optimistic: "Poked!" right away; only rolls back if it didn't go through.
  async function send() {
    setState("sent");
    try {
      const r = await poke(userId);
      if (r === "already") setState("done");
      else if (r !== "ok") setState("idle");
    } catch {
      setState("idle");
    }
  }

  const label = state === "sent" ? "Poked!" : state === "done" ? "Poked today" : "Poke";
  return (
    <button
      className="poke-btn"
      data-state={state}
      onClick={send}
      disabled={state !== "idle"}
      aria-label={state === "idle" ? `Poke ${name} about their reading` : label}
      title={state === "idle" ? "Nudge them about their book. Once a day." : undefined}
    >
      <PokeIcon size={16} />
      <span>{label}</span>
    </button>
  );
}
