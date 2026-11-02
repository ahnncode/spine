"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { RequireAuth, useAuth, useProfile } from "@/components/Auth";
import { updateMyProfile } from "@/lib/data";

export default function WelcomePage() {
  return (
    <RequireAuth>
      <Welcome />
    </RequireAuth>
  );
}

function suggest(email: string | undefined): string {
  return (email?.split("@")[0] ?? "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
}

function Welcome() {
  const { session } = useAuth();
  const { profile, reloadProfile } = useProfile();
  const router = useRouter();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [username, setUsername] = useState(profile?.username ?? suggest(session?.user.email));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = /^[a-z0-9_]{3,20}$/.test(username);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await updateMyProfile({ username, display_name: name.trim() || username });
      await reloadProfile();
      router.replace("/shelf");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t save that");
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <form className="screen screen--flow" onSubmit={submit}>
        <span className="wordmark">spine</span>
        <h1 className="h1 h1--xl" style={{ marginTop: 32 }}>Welcome in.</h1>
        <p className="lede">Pick how friends find you. You can change this later.</p>

        <div className="field" style={{ marginTop: 28 }}>
          <label htmlFor="name">Your name</label>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Paul" autoComplete="name" maxLength={40} />
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label htmlFor="username">Username</label>
          <div className="search-box" style={{ marginTop: 0 }}>
            <span aria-hidden="true" className="m muted" style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }}>@</span>
            <input
              id="username"
              className="input"
              style={{ width: "100%", paddingLeft: 34 }}
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))}
              autoCapitalize="none"
              autoCorrect="off"
              required
              aria-describedby="username-hint"
            />
          </div>
          <span id="username-hint" className="muted" style={{ fontSize: 13 }}>3–20 letters, numbers or underscores</span>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="spacer" style={{ minHeight: 24 }} />
        <button className="btn btn--block" disabled={busy || !valid}>
          {busy ? "Saving…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
