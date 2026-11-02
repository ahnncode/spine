"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { peekDestination, SetupNotice, takeDestination, useAuth } from "@/components/Auth";
import { BackIcon } from "@/components/icons";
import { Turnstile, TURNSTILE_SITE_KEY, type TurnstileStatus } from "@/components/Turnstile";
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
  const [check, setCheck] = useState<TurnstileStatus>({ state: "loading" });
  const [waiting, setWaiting] = useState(false);
  const needsCaptcha = Boolean(TURNSTILE_SITE_KEY);
  // Lets a submit that beat the bot check wait for it to finish.
  const tokenRef = useRef<string | null>(null);
  const waiters = useRef<Array<(t: string | null) => void>>([]);

  function onToken(t: string | null) {
    tokenRef.current = t;
    setCaptcha(t);
    if (t) waiters.current.splice(0).forEach((w) => w(t));
  }
  function onStatus(st: TurnstileStatus) {
    setCheck(st);
    if (st.state === "error" || st.state === "blocked") waiters.current.splice(0).forEach((w) => w(null));
  }
  function tokenSoon(ms: number): Promise<string | null> {
    if (tokenRef.current) return Promise.resolve(tokenRef.current);
    return new Promise((resolve) => {
      waiters.current.push(resolve);
      setTimeout(() => resolve(tokenRef.current), ms);
    });
  }

  useEffect(() => {
    if (session) router.replace(takeDestination());
  }, [session, router]);

  if (!supabaseConfigured) return <SetupNotice />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    let token = captcha;
    if (needsCaptcha && !token) {
      // Pressed before the check finished: wait for it rather than greying out the button.
      setWaiting(true);
      token = await tokenSoon(15000);
      setWaiting(false);
      if (!token) {
        setBusy(false);
        setError(stuckMessage(check));
        setCaptchaRound((n) => n + 1);
        return;
      }
    }
    const { error } = await supabase().auth.signInWithOtp({
      email: email.trim(),
      // The email link opens in a new tab, so it carries the destination itself.
      options: { emailRedirectTo: `${window.location.origin}${peekDestination()}`, captchaToken: token ?? undefined },
    });
    setBusy(false);
    // Bot-check tokens are single-use: get a fresh one for any retry.
    setCaptchaRound((n) => n + 1);
    if (error) {
      setError(
        /rate limit/i.test(error.message)
          ? "Too many sign-in emails just now. Wait a few minutes and try again."
          : /captcha/i.test(error.message)
            ? captchaMessage(error.message)
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
            <Turnstile onToken={onToken} onStatus={onStatus} resetKey={captchaRound} />
            {needsCaptcha && (check.state === "blocked" || check.state === "error") && !error && (
              <p className="notice" role="status" style={{ marginTop: 12 }}>{stuckMessage(check)}</p>
            )}
            {error && <p className="error" role="alert">{error}</p>}
            <div className="spacer" style={{ minHeight: 24 }} />
            <button className="btn btn--block" disabled={busy || !email.trim()}>
              {waiting ? "Checking you’re not a bot…" : busy ? "Sending…" : "Email me a link"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

/** Turn Supabase's CAPTCHA errors into something useful (and say which one). */
function captchaMessage(raw: string): string {
  const code = raw.match(/\(([a-z-]+)\)/i)?.[1] ?? "";
  if (/secret/i.test(code)) return "Sign-in is misconfigured on our side (bot-check secret key). We’re on it.";
  if (/timeout|duplicate/i.test(code)) return "The bot check expired. Try again.";
  return `The bot check didn’t go through${code ? ` (${code})` : ""}. Try again.`;
}

/** Why the bot check hasn't produced a pass, in words someone can act on. */
function stuckMessage(st: TurnstileStatus): string {
  if (st.state === "blocked") {
    return "Your browser blocked our bot check (often an ad or privacy blocker, or an in-app browser). Try turning the blocker off for readspine.app, or open the site in Safari or Chrome.";
  }
  if (st.state === "error") {
    // Cloudflare's 110xxx/400xxx codes are setup problems on our side; others are usually the browser or network.
    if (/^(110|400)/.test(st.code)) return `Sign-in is having trouble on our side (bot check ${st.code}). Please try again shortly.`;
    return `The bot check couldn’t finish${st.code ? ` (${st.code})` : ""}. Reload the page, or try another browser.`;
  }
  return "The bot check is taking longer than usual. Reload the page and try again.";
}
