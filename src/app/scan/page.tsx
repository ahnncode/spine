"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { RequireAuth } from "@/components/Auth";
import { Cover } from "@/components/Cover";
import { BookOpenIcon, BookmarkIcon, CloseIcon } from "@/components/icons";
import type { BookInput } from "@/lib/books";
import { addToWant, ensureBook, startReading } from "@/lib/data";
import { findByIsbn } from "@/lib/openlibrary";

export default function ScanPage() {
  return (
    <RequireAuth>
      <Scanner />
    </RequireAuth>
  );
}

/** Book barcodes are EAN-13 starting 978/979, which is the ISBN-13. */
function asIsbn(text: string): string | null {
  const digits = text.replace(/\D/g, "");
  if (digits.length === 13 && /^97[89]/.test(digits)) return digits;
  if (digits.length === 10 || (text.length === 10 && /^\d{9}[\dX]$/i.test(text))) return text.toUpperCase();
  return null;
}

function Scanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [found, setFound] = useState<BookInput | null>(null);
  const [miss, setMiss] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const lastRef = useRef<string>("");
  const pausedRef = useRef(false);

  async function handle(isbn: string) {
    if (pausedRef.current || isbn === lastRef.current) return;
    lastRef.current = isbn;
    pausedRef.current = true;
    setLookingUp(true);
    setMiss(null);
    try {
      const book = await findByIsbn(isbn);
      if (book) setFound(book);
      else {
        setMiss(isbn);
        pausedRef.current = false;
      }
    } catch {
      setMiss(isbn);
      pausedRef.current = false;
    } finally {
      setLookingUp(false);
    }
  }

  useEffect(() => {
    let controls: { stop: () => void } | null = null;
    let cancelled = false;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const { BarcodeFormat, DecodeHintType } = await import("@zxing/library");
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]);
        const reader = new BrowserMultiFormatReader(hints);
        if (cancelled || !videoRef.current) return;
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoRef.current,
          (result) => {
            const isbn = result ? asIsbn(result.getText()) : null;
            if (isbn) handle(isbn);
          },
        );
        if (cancelled) controls.stop();
      } catch (e) {
        setCamError(
          e instanceof Error && /Permission|NotAllowed/i.test(e.name + e.message)
            ? "Camera access was blocked. Allow it in your browser settings, or type the ISBN below."
            : "We couldn’t open a camera here. Type the ISBN from the back of the book instead.",
        );
      }
    })();
    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, []);

  function submitManual(e: FormEvent) {
    e.preventDefault();
    const isbn = asIsbn(manual);
    if (!isbn) return setMiss(manual);
    lastRef.current = "";
    pausedRef.current = false;
    handle(isbn);
  }

  async function act(what: "rank" | "reading" | "want") {
    if (!found) return;
    setBusy(true);
    try {
      const id = await ensureBook(found);
      if (what === "rank") return router.push(`/rank/${id}`);
      if (what === "reading") {
        await startReading(id);
        return router.push(`/book/${id}?checkin=1`);
      }
      await addToWant(id);
      router.push("/shelf");
    } catch {
      setBusy(false);
    }
  }

  function again() {
    setFound(null);
    lastRef.current = "";
    pausedRef.current = false;
  }

  return (
    <div className="app">
      <main className="screen screen--flow" style={{ paddingTop: 16 }}>
        <div className="topbar">
          <Link href="/add" className="icon-btn" aria-label="Close scanner"><CloseIcon size={18} /></Link>
          <h1 className="eyebrow" style={{ margin: 0 }}>Scan a barcode</h1>
          <span style={{ width: 44 }} />
        </div>

        <div style={{ position: "relative", marginTop: 16, borderRadius: 22, overflow: "hidden", background: "var(--black)", aspectRatio: "3 / 4" }}>
          <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: camError ? "none" : "block" }} />
          {!camError && (
            <div aria-hidden="true" style={{ position: "absolute", left: "12%", right: "12%", top: "38%", height: "24%", border: "3px solid var(--accent)", borderRadius: 16, boxShadow: "0 0 0 2000px rgba(0,0,0,0.35)" }} />
          )}
          {camError && <p style={{ color: "var(--on-panel)", padding: 24, margin: 0, lineHeight: 1.45 }}>{camError}</p>}
          <p aria-live="polite" style={{ position: "absolute", bottom: 14, left: 0, right: 0, textAlign: "center", color: "var(--on-panel)", fontSize: 14, margin: 0 }}>
            {lookingUp ? "Looking it up…" : miss ? `Couldn’t find ${miss}. Try again or type it` : camError ? "" : "Point at the barcode on the back"}
          </p>
        </div>

        <form onSubmit={submitManual} style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <label htmlFor="isbn" className="visually-hidden">ISBN</label>
          <input id="isbn" className="input" style={{ flex: 1 }} inputMode="numeric" placeholder="Or type the ISBN" value={manual} onChange={(e) => setManual(e.target.value)} />
          <button className="btn" style={{ minHeight: 52 }}>Find</button>
        </form>
      </main>

      {found && (
        <div className="sheet-backdrop" onClick={() => !busy && again()}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={found.title} onClick={(e) => e.stopPropagation()}>
            <div className="sheet__grab" />
            <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
              <Cover book={found} width={96} />
              <div style={{ minWidth: 0 }}>
                <h2 className="d" style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.05 }}>{found.title}</h2>
                <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>{[found.author, found.year].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
            <div className="stack" style={{ marginTop: 20 }}>
              <button className="btn btn--block" disabled={busy} onClick={() => act("rank")}>I’ve read it</button>
              <button className="btn btn--outline btn--block" disabled={busy} onClick={() => act("reading")}><BookOpenIcon size={18} /> Reading it now</button>
              <button className="btn btn--quiet btn--block" disabled={busy} onClick={() => act("want")}><BookmarkIcon size={16} /> Want to read</button>
              <button className="btn btn--ghost btn--block" disabled={busy} onClick={again}>Scan another</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
