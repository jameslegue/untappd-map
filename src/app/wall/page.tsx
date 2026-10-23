"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useData } from "@/components/DataProvider";
import { Loading, Locked, Photo, Stars } from "@/components/bits";
import { flag } from "@/lib/normalize";
import { fmtDate, where } from "@/lib/group";
import type { Checkin } from "@/lib/types";

type Group = { key: string; title: string; sub: string; code: string; photos: Checkin[]; loc: string };
type By = "city" | "venue";

const tilt = (n: number) => ((n * 37) % 13) - 6;

export default function WallPage() {
  const { mode, checkins, loading } = useData();
  if (loading && !checkins.length) return <Loading />;
  if (mode !== "private") return <Locked what="The polaroid wall" />;
  return <Wall checkins={checkins} />;
}

function Wall({ checkins }: { checkins: Checkin[] }) {
  const [by, setBy] = useState<By>("city");
  const [open, setOpen] = useState<Group | null>(null);

  const groups = useMemo(() => {
    const m = new Map<string, Group>();
    for (const c of checkins) {
      if (!c.photo || !c.loc) continue;
      const key = by === "city" ? `${c.country}|${c.state}|${c.city || c.venue}` : c.loc;
      let g = m.get(key);
      if (!g) {
        g = {
          key,
          title: by === "city" ? c.city || c.venue || c.state : c.venue || c.city,
          sub: by === "city" ? [c.state, c.country].filter(Boolean).join(", ") : where(c),
          code: c.countryCode,
          photos: [],
          loc: c.loc,
        };
        m.set(key, g);
      }
      g.photos.push(c);
    }
    for (const g of m.values()) g.photos.sort((a, b) => b.t.localeCompare(a.t));
    return [...m.values()].sort((a, b) => b.photos.length - a.photos.length);
  }, [checkins, by]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="scroll cork">
      <div className="wall">
        <header className="wall-head">
          <h1>Polaroid wall</h1>
          <div className="seg">
            {(["city", "venue"] as By[]).map((b) => (
              <button key={b} className={b === by ? "on" : ""} onClick={() => setBy(b)}>
                By {b}
              </button>
            ))}
          </div>
        </header>
        <div className="boards">
          {groups.map((g) => (
            <section key={g.key} className="board" onClick={() => setOpen(g)}>
              <div className="tape">
                <b>{flag(g.code)} {g.title}</b>
                <span>{g.photos.length}</span>
              </div>
              <div className="pile">
                {g.photos.slice(0, 4).map((c, i) => (
                  <figure key={c.id} className="pola" style={{ "--r": `${tilt(c.id + i)}deg` } as React.CSSProperties}>
                    <Photo url={c.photo!} size={200} alt={c.beer} />
                    <figcaption>{c.beer}</figcaption>
                  </figure>
                ))}
              </div>
              <div className="board-sub">{g.sub}</div>
            </section>
          ))}
        </div>
      </div>

      {open && (
        <div className="modal" onClick={() => setOpen(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <div>
                <h2>{flag(open.code)} {open.title}</h2>
                <p className="muted">
                  {open.sub} · {open.photos.length} photos ·{" "}
                  <Link href={`/?loc=${open.loc}`} className="link">Show on map →</Link>
                </p>
              </div>
              <button className="x" onClick={() => setOpen(null)} aria-label="Close">×</button>
            </div>
            <div className="modal-grid">
              {open.photos.map((c) => (
                <figure key={c.id} className="pola big" style={{ "--r": `${tilt(c.id) / 3}deg` } as React.CSSProperties}>
                  <a href={c.photo!} target="_blank" rel="noreferrer">
                    <Photo url={c.photo!} size={640} alt={c.beer} />
                  </a>
                  <figcaption>
                    <b>{c.beer}</b>
                    <span>{c.brewery}</span>
                    <span>
                      <Stars value={c.rating} /> · {fmtDate(c.t)}
                    </span>
                    {by === "city" && c.venue && (
                      <Link href={`/?loc=${c.loc}`} className="link">{c.venue}</Link>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
