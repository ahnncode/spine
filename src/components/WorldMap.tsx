"use client";

import { useEffect, useState } from "react";

type MapData = { w: number; h: number; rest: string; countries: Record<string, { d: string; c: [number, number]; s: 0 | 1 }> };

let cache: Promise<MapData> | null = null;
function loadMap(): Promise<MapData> {
  cache ??= fetch("/world-map.json").then((r) => {
    if (!r.ok) throw new Error("map");
    return r.json() as Promise<MapData>;
  });
  cache.catch(() => {
    cache = null;
  });
  return cache;
}

/**
 * The world, grey, with the countries you've read from filled in. Tiny ones
 * (South Korea, the UK) get a thin ring so they're still easy to spot.
 * Outlines: Natural Earth (public domain) via world-atlas.
 */
export function WorldMap({ highlight, label }: { highlight: string[]; label: string }) {
  const [map, setMap] = useState<MapData | null>(null);
  useEffect(() => {
    let live = true;
    loadMap().then((m) => live && setMap(m)).catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!map) return <div className="world-map world-map--loading" aria-hidden="true" />;
  const lit = new Set(highlight);
  const ids = Object.keys(map.countries);
  return (
    <svg className="world-map" viewBox={`0 0 ${map.w} ${map.h}`} role="img" aria-label={label}>
      <path className="world-map__land" d={map.rest + ids.filter((id) => !lit.has(id)).map((id) => map.countries[id].d).join("")} />
      {ids.filter((id) => lit.has(id)).map((id) => {
        const c = map.countries[id];
        return (
          <g key={id}>
            <path className="world-map__read" d={c.d} />
            {c.s === 1 && <circle className="world-map__ring" cx={c.c[0]} cy={c.c[1]} r={11} />}
          </g>
        );
      })}
    </svg>
  );
}
