"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import maplibregl from "maplibre-gl";
import { useData } from "@/components/DataProvider";
import { useMap, fitTo } from "@/components/useMap";
import { Loading, Locked, Photo, Stars } from "@/components/bits";
import { photoSources } from "@/lib/normalize";
import { fmtDate } from "@/lib/group";
import type { Checkin } from "@/lib/types";

const SIZES = [
  { label: "S", px: 44 },
  { label: "M", px: 64 },
  { label: "L", px: 96 },
];

export default function MosaicPage() {
  const { mode, checkins, loading } = useData();
  if (loading && !checkins.length) return <Loading />;
  if (mode !== "private") return <Locked what="The photo mosaic" />;
  return <Mosaic checkins={checkins} />;
}

function Mosaic({ checkins }: { checkins: Checkin[] }) {
  const { ref, map } = useMap();
  const [size, setSize] = useState(1);
  const [cell, setCell] = useState<Checkin[] | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);

  const photos = useMemo(() => checkins.filter((c) => c.photo && c.lat != null && c.lng != null), [checkins]);

  useEffect(() => {
    if (!map || !photos.length) return;
    fitTo(map, photos as { lat: number; lng: number }[], 5);
  }, [map, photos]);

  // Re-bin photos into a screen-space grid whenever the view settles
  useEffect(() => {
    if (!map) return;
    const px = SIZES[size].px;
    const draw = () => {
      for (const m of markers.current) m.remove();
      markers.current = [];
      const { width, height } = map.getCanvas().getBoundingClientRect();
      const cells = new Map<string, Checkin[]>();
      for (const c of photos) {
        const p = map.project([c.lng!, c.lat!]);
        if (p.x < -px || p.y < -px || p.x > width + px || p.y > height + px) continue;
        const k = `${Math.floor(p.x / px)}:${Math.floor(p.y / px)}`;
        const arr = cells.get(k);
        if (arr) arr.push(c);
        else cells.set(k, [c]);
      }
      for (const [k, members] of cells) {
        members.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.t.localeCompare(a.t));
        const [cx, cy] = k.split(":").map(Number);
        const el = document.createElement("button");
        el.className = "tile";
        el.style.width = el.style.height = `${px - 4}px`;
        const srcs = photoSources(members[0].photo!, px > 64 ? 640 : 200);
        const img = document.createElement("img");
        img.alt = "";
        img.src = srcs[0];
        img.onerror = () => {
          const next = srcs.indexOf(img.getAttribute("src")!) + 1;
          if (next > 0 && next < srcs.length) img.src = srcs[next];
        };
        el.appendChild(img);
        el.title = `${members[0].beer} · ${members[0].venue ?? ""}`;
        if (members.length > 1) {
          const badge = document.createElement("span");
          badge.textContent = String(members.length);
          el.appendChild(badge);
        }
        el.onclick = (e) => {
          e.stopPropagation();
          setCell(members);
        };
        const lnglat = map.unproject([cx * px + px / 2, cy * px + px / 2]);
        markers.current.push(new maplibregl.Marker({ element: el }).setLngLat(lnglat).addTo(map));
      }
    };
    draw();
    map.on("moveend", draw);
    return () => {
      map.off("moveend", draw);
      for (const m of markers.current) m.remove();
      markers.current = [];
    };
  }, [map, photos, size]);

  return (
    <div className="mapwrap">
      <div ref={ref} className="map mosaic" />
      <div className="overlay statbar">
        <div className="stat">
          <b>{photos.length.toLocaleString()}</b>
          <span>photos</span>
        </div>
        <div className="seg" style={{ alignSelf: "center" }}>
          {SIZES.map((s, k) => (
            <button key={s.label} className={k === size ? "on" : ""} onClick={() => setSize(k)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {cell && (
        <aside className="overlay panel">
          <div className="panel-head">
            <div>
              <h2>{cell.length} photo{cell.length === 1 ? "" : "s"}</h2>
              <p className="muted">{[...new Set(cell.map((c) => c.venue))].slice(0, 3).join(" · ")}</p>
            </div>
            <button className="x" onClick={() => setCell(null)} aria-label="Close">×</button>
          </div>
          <div className="panel-list">
            {cell.slice(0, 60).map((c) => (
              <Link key={c.id} href={`/?loc=${c.loc}`} className="mini">
                <Photo url={c.photo!} size={200} alt="" />
                <div>
                  <b>{c.beer}</b>
                  <div className="muted">{c.venue}</div>
                  <div className="muted">
                    <Stars value={c.rating} /> · {fmtDate(c.t)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}
