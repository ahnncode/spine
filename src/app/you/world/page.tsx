"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/Auth";
import { Cover } from "@/components/Cover";
import { BackIcon } from "@/components/icons";
import { RowsSkeleton } from "@/components/Skeleton";
import { useCountryLookup } from "@/components/useCountryLookup";
import { WorldMap } from "@/components/WorldMap";
import { fetchShelf, type Entry } from "@/lib/data";
import { CONTINENTS, countryName, worldPassport } from "@/lib/world";

export default function Page() {
  return (
    <RequireAuth>
      <World />
    </RequireAuth>
  );
}

/**
 * Your world passport: a quiet map of where the authors you've read are from,
 * then those countries by continent. Tap a country to see its books.
 */
function World() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [onlyTranslated, setOnlyTranslated] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    fetchShelf().then(setEntries).catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);
  useCountryLookup(entries, load);

  const all = useMemo(() => worldPassport(entries ?? []), [entries]);
  const shown = useMemo(() => {
    if (!onlyTranslated) return all.countries;
    return all.countries
      .map((c) => ({ ...c, books: c.books.filter((e) => e.book.translated) }))
      .filter((c) => c.books.length > 0);
  }, [all, onlyTranslated]);

  // A book on your want-to-read list from somewhere new, if there is one.
  const next = useMemo(() => {
    const have = new Set(all.countries.map((c) => c.code));
    return (entries ?? []).find((e) => e.status === "want" && e.book.author_country && !have.has(e.book.author_country));
  }, [entries, all]);
  const missing = CONTINENTS.filter((k) => !all.countries.some((c) => c.continent === k.key));
  const read = (entries ?? []).filter((e) => e.status === "ranked" || e.status === "unsorted").length;

  return (
    <div className="app">
      <main className="screen screen--flow" style={{ paddingTop: 12 }}>
        <Link href="/you" className="icon-btn" aria-label="Back"><BackIcon size={20} /></Link>
        <h1 className="h1" style={{ marginTop: 12 }}>Your world passport</h1>

        {failed ? (
          <p className="lede">Couldn&rsquo;t load your shelf. Try again in a moment.</p>
        ) : !entries ? (
          <RowsSkeleton count={4} />
        ) : (
          <>
            <div style={{ marginTop: 16 }}>
              <WorldMap
                highlight={shown.map((c) => c.numeric).filter((n): n is string => !!n)}
                label={shown.length ? `World map. You've read authors from ${shown.map((c) => c.name).join(", ")}.` : "World map. No countries yet."}
              />
              <p className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>
                {all.countries.length === 0
                  ? "By where each author is from."
                  : `${all.countries.length} ${all.countries.length === 1 ? "country" : "countries"} · ${all.continents} of 6 continents · by where the author is from`}
              </p>
            </div>

            {all.translated > 0 && (
              <div role="group" aria-label="Which books" style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="tag-chip" aria-pressed={!onlyTranslated} onClick={() => setOnlyTranslated(false)}>All {all.placed} books</button>
                <button type="button" className="tag-chip" aria-pressed={onlyTranslated} onClick={() => setOnlyTranslated(true)}>In translation · {all.translated}</button>
              </div>
            )}

            {all.countries.length === 0 ? (
              <p className="lede" style={{ marginTop: 16 }}>
                {read === 0
                  ? "Rank a few books you’ve read and your stamps start here."
                  : "Looking up where your authors are from. Stamps fill in as you browse."}
              </p>
            ) : (
              <ul className="world-list" aria-label="Countries by continent">
                {CONTINENTS.map((k) => {
                  const here = shown.filter((c) => c.continent === k.key);
                  if (!here.length) return null;
                  return (
                    <li key={k.key} className="world-list__continent">
                      <h2 className="world-list__name">{k.name}</h2>
                      <ul className="world-list__countries">
                        {here.map((c) => (
                          <li key={c.code}>
                            <button
                              type="button"
                              className="world-country"
                              aria-expanded={open === c.code}
                              onClick={() => setOpen(open === c.code ? null : c.code)}
                            >
                              <span className="world-country__name">{c.name}</span>
                              <span className="m muted">{c.books.length}</span>
                            </button>
                            {open === c.code && (
                              <ul className="world-books">
                                {c.books.map((e) => (
                                  <li key={e.id}>
                                    <Link href={`/book/${e.book_id}`} className="world-books__row">
                                      <Cover book={e.book} width={32} />
                                      <span style={{ flex: 1, minWidth: 0 }}>
                                        <span className="book-row__title" style={{ fontSize: 15, display: "block" }}>{e.book.title}</span>
                                        <span className="muted" style={{ fontSize: 13 }}>
                                          {e.book.author}{e.book.translated ? " · in translation" : ""}
                                        </span>
                                      </span>
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            )}

            {all.countries.length > 0 && (next || missing.length > 0) && (
              next ? (
                <Link href={`/book/${next.book_id}`} className="world-next">
                  <span className="world-next__k">Your next stamp?</span>
                  <span>
                    <span className="book-row__title" style={{ fontSize: 15 }}>{next.book.title}</span> is on your list, by an author from {countryName(next.book.author_country!)}.
                  </span>
                </Link>
              ) : (
                <p className="world-next">
                  <span className="world-next__k">Not yet</span>
                  <span>Nothing from {missing.map((m) => m.name).join(" or ")} so far.</span>
                </p>
              )
            )}

            <p className="muted" style={{ fontSize: 12, marginTop: 24 }}>
              Countries come from Wikidata, by the author&rsquo;s citizenship. Some authors aren&rsquo;t listed yet, so a few books may be missing.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
