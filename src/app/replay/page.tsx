"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { useData } from "@/components/DataProvider";
import { useMap } from "@/components/useMap";
import { Loading } from "@/components/bits";
import { fmtDate, where } from "@/lib/group";

const DAY = 86400;
const SPEEDS = [
  { label: "1×", days: 30 },
  { label: "3×", days: 90 },
  { label: "10×", days: 300 },
];
const GAP_SKIP = 45 * DAY; // fast-forward through quiet stretches

export default function ReplayPage() {
  const { checkins, loading, mode } = useData();
  const { ref, map } = useMap({ center: [-60, 38], zoom: 2.2 });
  const [cur, setCur] = useState(0); // unix seconds
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [follow, setFollow] = useState(true);
  const curRef = useRef(0);

  // All check-ins sorted, with running totals precomputed per index
  const tl = useMemo(() => {
    const all = [...checkins].sort((a, b) => a.t.localeCompare(b.t));
    const ts = all.map((c) => Date.parse(c.t) / 1000);
    const countries: number[] = [];
    const cities: number[] = [];
    const cs = new Set<string>(), ci = new Set<string>();
    let lastPlaced = -1;
    const lastPlacedAt: number[] = [];
    all.forEach((c, i) => {
      if (c.country) cs.add(c.country);
      if (c.city) ci.add(`${c.country}|${c.state}|${c.city}`);
      if (c.lat != null) lastPlaced = i;
      countries.push(cs.size);
      cities.push(ci.size);
      lastPlacedAt.push(lastPlaced);
    });
    return { all, ts, countries, cities, lastPlacedAt };
  }, [checkins]);

  const start = tl.ts[0] ?? 0;
  const end = tl.ts.at(-1) ?? 0;

  // index of last check-in at or before t
  const idxAt = (t: number) => {
    let lo = 0, hi = tl.ts.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (tl.ts[mid] <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return ans;
  };

  useEffect(() => {
    if (start) {
      curRef.current = start - DAY;
      setCur(start - DAY);
    }
  }, [start]);

  // Layers
  useEffect(() => {
    if (!map || !tl.all.length) return;
    const data: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: tl.all
        .map((c, i) => ({ c, t: tl.ts[i] }))
        .filter(({ c }) => c.lat != null && c.lng != null)
        .map(({ c, t }) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [c.lng!, c.lat!] },
          properties: { t },
        })),
    };
    const src = map.getSource("replay") as maplibregl.GeoJSONSource | undefined;
    if (src) return void src.setData(data);
    map.addSource("replay", { type: "geojson", data });
    map.addLayer({
      id: "glow",
      type: "circle",
      source: "replay",
      filter: ["<=", ["get", "t"], 0],
      paint: { "circle-color": "#f5a524", "circle-blur": 1, "circle-radius": 22, "circle-opacity": 0.5 },
    });
    map.addLayer({
      id: "trail",
      type: "circle",
      source: "replay",
      filter: ["<=", ["get", "t"], 0],
      paint: { "circle-color": "#f5a524", "circle-radius": 4, "circle-opacity": 0.9 },
    });
  }, [map, tl]);

  // Paint the current moment
  useEffect(() => {
    if (!map?.getLayer("trail")) return;
    const year = 365 * DAY;
    map.setFilter("trail", ["<=", ["get", "t"], cur]);
    map.setFilter("glow", ["all", ["<=", ["get", "t"], cur], [">", ["get", "t"], cur - 20 * DAY]]);
    map.setPaintProperty("trail", "circle-color", [
      "interpolate", ["linear"], ["get", "t"],
      cur - 3 * year, "#6b4b16",
      cur - 60 * DAY, "#f5a524",
      cur, "#fff1cf",
    ]);
    map.setPaintProperty("trail", "circle-radius", [
      "interpolate", ["linear"], ["get", "t"],
      cur - 60 * DAY, 3.5,
      cur, 8,
    ]);
  }, [map, cur]);

  // Follow the latest placed check-in
  const i = idxAt(cur);
  const lp = i >= 0 ? tl.lastPlacedAt[i] : -1;
  const latest = lp >= 0 ? tl.all[lp] : null;
  useEffect(() => {
    if (!map || !follow || !latest || !playing) return;
    const pt: [number, number] = [latest.lng!, latest.lat!];
    const b = map.getBounds();
    const pad = (b.getEast() - b.getWest()) * 0.15;
    const inside =
      pt[0] > b.getWest() + pad && pt[0] < b.getEast() - pad && pt[1] > b.getSouth() + pad / 2 && pt[1] < b.getNorth() - pad / 2;
    if (!inside) map.easeTo({ center: pt, zoom: Math.max(map.getZoom(), 3.5), duration: 900 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest?.loc, follow, playing]);

  // Clock
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      let t = curRef.current + dt * SPEEDS[speed].days * DAY;
      const nextIdx = idxAt(t) + 1;
      if (nextIdx < tl.ts.length && tl.ts[nextIdx] - t > GAP_SKIP) t = tl.ts[nextIdx] - 5 * DAY;
      if (t >= end) {
        t = end;
        setPlaying(false);
      }
      curRef.current = t;
      setCur(t);
      if (t < end) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, end]);

  function scrub(t: number) {
    curRef.current = t;
    setCur(t);
  }

  function togglePlay() {
    if (!playing && curRef.current >= end) scrub(start - DAY);
    setPlaying((p) => !p);
  }

  return (
    <div className="mapwrap">
      <div ref={ref} className="map" />
      {loading && !checkins.length && <div className="overlay-loading"><Loading /></div>}
      <div className="overlay replay-clock">
        <div className="rp-date">{cur > 0 ? fmtDate(new Date(cur * 1000).toISOString(), { month: "short", year: "numeric" }) : "—"}</div>
        <div className="rp-counts">
          <span><b>{(i + 1).toLocaleString()}</b> check-ins</span>
          <span><b>{i >= 0 ? tl.cities[i] : 0}</b> cities</span>
          <span><b>{i >= 0 ? tl.countries[i] : 0}</b> countries</span>
        </div>
        {i >= 0 && (
          <div className="rp-now">
            <b>{tl.all[i].beer}</b> <span className="muted">· {tl.all[i].brewery}</span>
            {latest && <div className="muted">{mode === "private" && latest.venue && !latest.venue.startsWith(latest.city) ? `${latest.venue}, ` : ""}{where(latest)}</div>}
          </div>
        )}
      </div>
      <div className="overlay replay-ctl">
        <button className="btn" onClick={togglePlay}>{playing ? "Pause" : "Play"}</button>
        <input
          type="range"
          min={start - DAY}
          max={end}
          step={DAY}
          value={cur || start}
          onChange={(e) => scrub(Number(e.target.value))}
          aria-label="Timeline"
        />
        <div className="seg">
          {SPEEDS.map((s, k) => (
            <button key={s.label} className={k === speed ? "on" : ""} onClick={() => setSpeed(k)}>{s.label}</button>
          ))}
        </div>
        <label className="follow">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Follow
        </label>
      </div>
    </div>
  );
}
