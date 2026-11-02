"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { SetupNotice, useAuth } from "@/components/Auth";
import { BackIcon } from "@/components/icons";
import { Turnstile, TURNSTILE_SITE_KEY } from "@/components/Turnstile";
import { supabase, supabaseConfigured } from "@/lib/supabase";

export default function Login() {
  const { session } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaRound, setCaptchaRound] = useState(0);
  const needsCaptcha = Boolean(TURNSTILE_SITE_KEY);

  useEffect(() => {
    if (session) router.replace("/feed");
  }, [session, router]);

  if (!supabaseConfigured) return <SetupNotice />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (needsCaptcha && !captcha) {
      setError("Just a moment — confirming you’re not a bot.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/feed`, captchaToken: captcha ?? undefined },
    });
    setBusy(false);
    // Bot-check tokens are single-use: get a fresh one for any retry.
    setCaptchaRound((n) => n + 1);
    if (error) {
      setError(
        /rate limit/i.test(error.message)
          ? "Too many sign-in emails just now. Wait a few minutes and try again."
          : /captcha/i.test(error.message)
            ? "The bot check didn’t go through. Try again."
            : error.message,
      );
    } else setSent(true);
  }

  return (
    <div className="app">
      <main className="screen screen--flow">
        <div className="topbar">
          <Link href="/" className="icon-btn" aria-label="Back">
            <BackIcon size={20} />
          </Link>
        </div>

        {sent ? (
          <>
            <h1 className="h1 h1--xl" style={{ marginTop: 32 }}>Check your email.</h1>
            <p className="lede">
              We sent a sign-in link to <strong>{email}</strong>. Open it on this device and you&rsquo;re in.
            </p>
            <button className="btn btn--ghost" style={{ marginTop: 20, alignSelf: "flex-start", paddingLeft: 0 }} onClick={() => setSent(false)}>
              Use a different email
            </button>
          </>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <h1 className="h1 h1--xl" style={{ marginTop: 32 }}>Start your shelf.</h1>
            <p className="lede">No password. We&rsquo;ll email you a link to sign in or create your account.</p>
            <div className="field" style={{ marginTop: 28 }}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <Turnstile onToken={setCaptcha} resetKey={captchaRound} />
            {error && <p className="error" role="alert">{error}</p>}
            <div className="spacer" style={{ minHeight: 24 }} />
            <button className="btn btn--block" disabled={busy || !email.trim() || (needsCaptcha && !captcha)}>
              {busy ? "Sending…" : "Email me a link"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
