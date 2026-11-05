"use client";

import { useEffect, useState } from "react";
import { ShareIcon } from "@/components/icons";
import { supabase } from "@/lib/supabase";

const SLIDES = [1, 2, 3, 4];

/** Your year as four Instagram-ready slides: preview, then share or save them all. */
export function WrapShareButton({ year }: { year: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn--block" style={{ marginTop: 20 }} onClick={() => setOpen(true)}>
        <ShareIcon size={16} /> Share your year as slides
      </button>
      {open && <WrapShareSheet year={year} onClose={() => setOpen(false)} />}
    </>
  );
}

function WrapShareSheet({ year, onClose }: { year: number; onClose: () => void }) {
  const [slides, setSlides] = useState<{ url: string; file: File }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const made: string[] = [];
    (async () => {
      const { data } = await supabase().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in first");
      const out = await Promise.all(
        SLIDES.map(async (n) => {
          const res = await fetch(`/api/card?kind=wrap&slide=${n}&year=${year}`, { headers: { Authorization: `Bearer ${token}` } });
          if (!res.ok) throw new Error((await res.text()) || "Couldn’t make your slides");
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          made.push(url);
          return { url, file: new File([blob], `${year}-in-books-${n}.png`, { type: "image/png" }) };
        }),
      );
      if (live) setSlides(out);
    })().catch((e) => live && setError(e instanceof Error ? e.message : "Couldn’t make your slides"));
    return () => {
      live = false;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [year]);

  const files = slides?.map((s) => s.file) ?? [];
  const canShare = typeof navigator !== "undefined" && files.length > 0 && navigator.canShare?.({ files });

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Share your year" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <h2 className="h2">Your {year} in books</h2>
        <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>Four slides, sized for an Instagram post. Swipe to preview.</p>
        <div className="wrap-slides">
          {slides
            ? slides.map((s, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={s.url} src={s.url} alt={`Slide ${i + 1}`} className="wrap-slide" />
              ))
            : error
              ? <p className="muted" style={{ padding: 24, fontSize: 14 }}>{error}</p>
              : SLIDES.map((n) => <span key={n} className="wrap-slide skeleton" aria-busy="true" />)}
        </div>
        {slides && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
            {canShare && (
              <button className="btn btn--block" onClick={() => navigator.share({ files }).catch(() => {})}>Share all 4</button>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
              {slides.map((s, i) => (
                <a key={s.url} className="btn btn--quiet" style={{ minHeight: 40, fontSize: 13 }} href={s.url} download={s.file.name}>Save {i + 1}</a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
