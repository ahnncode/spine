"use client";

import { useEffect, useState } from "react";
import { AvatarIconArt } from "@/components/Avatar";
import { useProfile } from "@/components/Auth";
import { fetchMyTypeCodes, updateMyProfile } from "@/lib/data";
import { TYPES } from "@/lib/readerTypeCopy";
import { typeIconKey } from "./TypeAvatarArt";

const seenKey = (code: string) => `readread:type-icon:${code}`;

function seen(code: string): boolean {
  try {
    return localStorage.getItem(seenKey(code)) === "1";
  } catch {
    return true; // storage blocked: don't pop the reveal on every visit
  }
}

function markSeen(code: string) {
  try {
    localStorage.setItem(seenKey(code), "1");
  } catch {
    /* fine */
  }
}

/**
 * Your type's profile-picture icon. The first time you open a type, it pops
 * up as something you've earned; after that it lives on this card, alongside
 * any icons from types you've had before.
 */
export function TypeIconReward({ code }: { code: string }) {
  const { profile, reloadProfile } = useProfile();
  const [reveal, setReveal] = useState(false);
  const [earned, setEarned] = useState<string[]>([code]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = profile?.avatar_icon ?? null;

  useEffect(() => {
    fetchMyTypeCodes()
      .then((codes) => setEarned([...new Set([code, ...codes.filter((c) => c !== code).reverse()])]))
      .catch(() => {});
  }, [code]);

  useEffect(() => {
    if (!profile || seen(code) || current === typeIconKey(code)) return;
    // After the type's own reveal has played.
    const t = setTimeout(() => setReveal(true), 1400);
    return () => clearTimeout(t);
  }, [profile, code, current]);

  function close() {
    markSeen(code);
    setReveal(false);
  }

  async function use(c: string) {
    setBusy(c);
    setError(null);
    try {
      await updateMyProfile({ avatar_icon: typeIconKey(c), avatar_color: profile?.avatar_color ?? null });
      await reloadProfile();
      markSeen(code);
      setReveal(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t update your picture");
    } finally {
      setBusy(null);
    }
  }

  const using = current === typeIconKey(code);

  return (
    <>
      <section className="card type-icon-card" aria-label="Your reader type icon">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <AvatarIconArt icon={typeIconKey(code)} color="ink" size={56} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="eyebrow">Your icon</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{TYPES[code].name}</div>
          </div>
          {using ? (
            <span className="pill">✓ In use</span>
          ) : (
            <button className="small-btn" disabled={busy !== null} onClick={() => use(code)}>{busy === code ? "Saving…" : "Use it"}</button>
          )}
        </div>
        {earned.length > 1 && (
          <>
            <p className="muted" style={{ margin: "14px 0 8px", fontSize: 13 }}>From types you&rsquo;ve been before</p>
            <div className="type-icon-row" role="radiogroup" aria-label="Icons from earlier types">
              {earned.slice(1).map((c) => (
                <button key={c} className="pic" role="radio" aria-checked={current === typeIconKey(c)} disabled={busy !== null} onClick={() => use(c)} aria-label={`Use ${TYPES[c].name} as your profile picture`}>
                  <AvatarIconArt icon={typeIconKey(c)} color="ink" size={44} />
                  <span className="pic__label">{TYPES[c].name.replace(/^The /, "")}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {error && !reveal && <p className="error" role="alert">{error}</p>}
      </section>

      {reveal && (
        <div className="sheet-backdrop" onClick={() => busy === null && close()}>
          <div className="sheet type-icon-reveal" role="dialog" aria-modal="true" aria-label={`New icon: ${TYPES[code].name}`} onClick={(e) => e.stopPropagation()}>
            <div className="sheet__grab" />
            <div className="type-icon-reveal__art">
              <AvatarIconArt icon={typeIconKey(code)} color="ink" size={132} />
            </div>
            <p className="eyebrow" style={{ textAlign: "center", marginTop: 18 }}>New icon earned</p>
            <h2 className="g" style={{ margin: "6px 0 0", textAlign: "center", fontSize: 28, lineHeight: 1.05, fontWeight: 400 }}>{TYPES[code].name}</h2>
            <p className="muted" style={{ margin: "10px auto 0", textAlign: "center", fontSize: 15, lineHeight: 1.45, maxWidth: 300 }}>
              Your reader type comes with its own profile picture. It&rsquo;s yours to keep, even if your type changes.
            </p>
            {error && <p className="error" role="alert">{error}</p>}
            <div className="stack" style={{ marginTop: 22 }}>
              <button className="btn btn--block" disabled={busy !== null} onClick={() => use(code)}>{busy ? "Saving…" : "Use as my profile picture"}</button>
              <button className="link-btn" style={{ minHeight: 44 }} disabled={busy !== null} onClick={close}>Maybe later</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
