"use client";

import { useEffect, useState } from "react";
import { ShareIcon } from "@/components/icons";
import { supabase } from "@/lib/supabase";

/**
 * A button that makes a share card image (top 10, book twins, verdict) and
 * opens it in a sheet with Share and Save.
 */
export function ShareCardButton({ query, label, filename, className = "btn btn--quiet", style }: {
  query: string;
  label: string;
  filename: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={className} style={style} onClick={() => setOpen(true)}>
        <ShareIcon size={16} /> {label}
      </button>
      {open && <ShareCardSheet query={query} filename={filename} onClose={() => setOpen(false)} />}
    </>
  );
}

function ShareCardSheet({ query, filename, onClose }: { query: string; filename: string; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    let made: string | null = null;
    (async () => {
      const { data } = await supabase().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in first");
      const res = await fetch(`/api/card?${query}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.text()) || "Couldn’t make the card");
      const blob = await res.blob();
      if (!live) return;
      made = URL.createObjectURL(blob);
      setUrl(made);
      setFile(new File([blob], `${filename}.png`, { type: "image/png" }));
    })().catch((e) => live && setError(e instanceof Error ? e.message : "Couldn’t make the card"));
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [query, filename]);

  const canShareFile = typeof navigator !== "undefined" && file && navigator.canShare?.({ files: [file] });

  async function share() {
    if (!file) return;
    try {
      await navigator.share({ files: [file] });
    } catch {}
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Share card" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <div className="share-card-frame">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Your share card" className="share-card-img" />
          ) : error ? (
            <p className="muted" style={{ padding: 24, textAlign: "center", fontSize: 14 }}>{error}</p>
          ) : (
            <div className="share-card-loading" aria-busy="true"><span className="skeleton" style={{ width: "100%", height: "100%", borderRadius: 16 }} /></div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          {canShareFile && <button className="btn" style={{ flex: 1 }} onClick={share}>Share</button>}
          {url && (
            <a className={canShareFile ? "btn btn--quiet" : "btn"} style={{ flex: 1 }} href={url} download={`${filename}.png`}>Save image</a>
          )}
        </div>
        {!url && !error && <p className="muted" style={{ textAlign: "center", fontSize: 13, margin: "10px 0 0" }}>Making your card…</p>}
      </div>
    </div>
  );
}
