"use client";

import { useEffect, useState } from "react";
import { PokeIcon } from "@/components/icons";
import { poke, pokedToday } from "@/lib/data";

/** Nudge a friend about their reading, once a day. */
export function PokeButton({ userId, name }: { userId: string; name: string }) {
  const [state, setState] = useState<"idle" | "busy" | "sent" | "done">("idle");

  useEffect(() => {
    let live = true;
    pokedToday(userId).then((already) => live && already && setState("done")).catch(() => {});
    return () => {
      live = false;
    };
  }, [userId]);

  async function send() {
    setState("busy");
    try {
      const r = await poke(userId);
      setState(r === "ok" ? "sent" : r === "already" ? "done" : "idle");
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
      title={state === "idle" ? "Check in on their reading — once a day" : undefined}
    >
      <PokeIcon size={16} />
      <span>{label}</span>
    </button>
  );
}
