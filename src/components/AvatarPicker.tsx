"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarIconArt } from "@/components/Avatar";
import { AVATAR_ART } from "@/components/AvatarArt";
import { LockIcon } from "@/components/icons";
import { AVATAR_COLORS, AVATAR_ICONS, iconUnlocked } from "@/lib/avatars";
import { BADGE } from "@/lib/badges";
import { fetchMyTypeCodes, updateMyProfile, type Profile } from "@/lib/data";
import { TYPES } from "@/lib/readerTypeCopy";
import { typeIconCode, typeIconKey } from "./TypeAvatarArt";

/** Choose a profile picture: initials or an icon, on one of ten colors. */
export function AvatarPicker({
  profile, earned, onClose, onSaved,
}: {
  profile: Profile;
  /** Badge keys you've earned (unlocks icons). */
  earned: Set<string>;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [icon, setIcon] = useState<string | null>(profile.avatar_icon ?? null);
  const [color, setColor] = useState<string>(profile.avatar_color ?? (profile.avatar_icon ? "ink" : "cobalt"));
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Reader-type icons: one for every type you've had.
  const [typeCodes, setTypeCodes] = useState<string[]>([]);
  useEffect(() => {
    fetchMyTypeCodes().then((c) => setTypeCodes(c.reverse())).catch(() => {});
  }, []);
  const typed = typeIconCode(icon) != null;

  const free = AVATAR_ICONS.filter((i) => !i.unlock);
  const locked = AVATAR_ICONS.filter((i) => i.unlock);
  const unlockedCount = locked.filter((i) => iconUnlocked(i.key, earned)).length;

  function choose(key: string | null) {
    setError(null);
    if (key && !typeIconCode(key) && !iconUnlocked(key, earned)) {
      const def = AVATAR_ICONS.find((i) => i.key === key)!;
      const badge = BADGE[def.unlock!];
      setHint(`${def.label} unlocks with the ${badge.name} badge. ${badge.how}.`);
      return;
    }
    setHint(null);
    setIcon(key);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await updateMyProfile({ avatar_icon: icon, avatar_color: color });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save your picture");
      setBusy(false);
    }
  }

  const preview = { ...profile, avatar_icon: icon, avatar_color: color };

  return (
    <div className="sheet-backdrop" onClick={() => !busy && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Profile picture" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Avatar profile={preview} size={84} />
          <div>
            <h2 className="g" style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em" }}>Profile picture</h2>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>Pick an icon and a color. Earn badges to unlock more.</p>
          </div>
        </div>

        <div style={{ maxHeight: "58vh", overflowY: "auto", margin: "14px -4px 0", padding: "0 4px" }}>
          <p className="eyebrow" style={{ margin: "4px 0 8px" }}>Color{typed ? <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}> · reader type icons keep their own</span> : null}</p>
          <div className="swatch-grid" role="radiogroup" aria-label="Color">
            {AVATAR_COLORS.map((c) => (
              <button key={c.key} role="radio" aria-checked={color === c.key} aria-label={c.label} className="swatch"
                style={{ background: c.bg }} onClick={() => setColor(c.key)} />
            ))}
          </div>

          {typeCodes.length > 0 && (
            <>
              <p className="eyebrow" style={{ margin: "18px 0 8px" }}>Your reader type</p>
              <div className="pic-grid" role="radiogroup" aria-label="Reader type icons">
                {typeCodes.map((c) => (
                  <button key={c} role="radio" aria-checked={icon === typeIconKey(c)} className="pic" onClick={() => choose(typeIconKey(c))} aria-label={TYPES[c].name}>
                    <AvatarIconArt icon={typeIconKey(c)} color={color} size={52} />
                    <span className="pic__label">{TYPES[c].name.replace(/^The /, "")}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <p className="eyebrow" style={{ margin: "18px 0 8px" }}>Icon</p>
          <div className="pic-grid" role="radiogroup" aria-label="Icon">
            <button role="radio" aria-checked={icon === null} className="pic" onClick={() => choose(null)} aria-label="Initials">
              <Avatar profile={{ ...profile, avatar_icon: null, avatar_color: color }} size={52} />
            </button>
            {free.map((i) => (
              <button key={i.key} role="radio" aria-checked={icon === i.key} className="pic" onClick={() => choose(i.key)} aria-label={i.label}>
                <AvatarIconArt icon={i.key} color={color} size={52} />
              </button>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "18px 0 8px" }}>
            <p className="eyebrow" style={{ margin: 0 }}>Unlock with badges</p>
            <span className="m muted" style={{ fontSize: 12 }}>{unlockedCount} of {locked.length}</span>
          </div>
          <div className="pic-grid" role="radiogroup" aria-label="Unlockable icons">
            {locked.map((i) => {
              const open = iconUnlocked(i.key, earned);
              return (
                <button key={i.key} role="radio" aria-checked={icon === i.key} className="pic" data-locked={!open}
                  onClick={() => choose(i.key)} aria-label={open ? i.label : `${i.label}, locked`}>
                  {open ? (
                    <AvatarIconArt icon={i.key} color={color} size={52} />
                  ) : (
                    <svg width={52} height={52} viewBox="0 0 48 48" aria-hidden="true">
                      <circle cx="24" cy="24" r="23" fill="var(--well)" />
                      <g opacity="0.35">{AVATAR_ART[i.key]("var(--muted)", "var(--well)")}</g>
                    </svg>
                  )}
                  {!open && <span className="pic__lock"><LockIcon size={11} /></span>}
                  <span className="pic__label">{open ? i.label : BADGE[i.unlock!].name}</span>
                </button>
              );
            })}
          </div>
          {hint && <p className="notice" role="status" style={{ marginTop: 12 }}>{hint}</p>}
        </div>

        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn--block" style={{ marginTop: 16 }} disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}
