"use client";

import Link from "next/link";
import type { Checkin } from "@/lib/types";
import { fmtDate } from "@/lib/group";
import { useState } from "react";
import { photoSources } from "@/lib/normalize";

export function Stars({ value }: { value: number | null }) {
  if (value == null) return <span className="muted">unrated</span>;
  return (
    <span className="stars" title={`${value} / 5`}>
      <span className="on" style={{ width: `${(value / 5) * 100}%` }}>★★★★★</span>
      <span className="off">★★★★★</span>
      <span className="num">{value.toFixed(2).replace(/0$/, "")}</span>
    </span>
  );
}

// <img> that walks photoSources() on error
export function Photo({ url, size, alt, className }: { url: string; size: 200 | 640; alt: string; className?: string }) {
  const srcs = photoSources(url, size);
  const [i, setI] = useState(0);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={srcs[i]}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => i < srcs.length - 1 && setI(i + 1)}
    />
  );
}

export function CheckinCard({ c }: { c: Checkin }) {
  return (
    <article className="card">
      {c.photo && (
        <a href={c.photo} target="_blank" rel="noreferrer">
          <Photo url={c.photo} size={640} alt={c.beer} className="card-photo" />
        </a>
      )}
      <div className="card-body">
        <div className="card-beer">{c.beer}</div>
        <div className="card-brewery">{c.brewery}</div>
        <div className="card-meta">
          <Stars value={c.rating} />
          <span>{c.style}</span>
          {c.abv ? <span>{c.abv}%</span> : null}
          {c.serving && <span>{c.serving}</span>}
        </div>
        {c.comment && <p className="card-comment">“{c.comment}”</p>}
        <div className="card-foot">
          <span>{fmtDate(c.t)}</span>
          {c.url && (
            <a href={c.url} target="_blank" rel="noreferrer">
              Untappd ↗
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export function Locked({ what }: { what: string }) {
  return (
    <div className="locked">
      <div className="locked-icon">🔒</div>
      <h2>{what} is private</h2>
      <p className="muted">This view is built from check-in photos, so it needs the password.</p>
      <Link href="/unlock" className="btn">Unlock</Link>
    </div>
  );
}

export function Loading() {
  return <div className="loading">Pouring…</div>;
}
