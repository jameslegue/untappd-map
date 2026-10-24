"use client";

import { useMemo } from "react";
import { useData } from "@/components/DataProvider";
import { Loading } from "@/components/bits";
import { TipBox, useTip } from "@/components/charts";

type Take = { key: string; beer: string; brewery: string; mine: number; crowd: number; diff: number; n: number };

// Diverging: cool = you rated it lower than the crowd, warm = higher, gray = agree
const COLD = "#4ea1e8", WARM = "#f5a524", MID = "#6b7480";
const AGREE = 0.25;

export default function HotTakesPage() {
  const { checkins, loading } = useData();
  const takes = useMemo(() => {
    const m = new Map<string, { beer: string; brewery: string; sum: number; n: number; crowd: number }>();
    for (const c of checkins) {
      if (c.rating == null || !c.globalRating) continue;
      const k = `${c.brewery}|${c.beer}`;
      const e = m.get(k) ?? { beer: c.beer, brewery: c.brewery, sum: 0, n: 0, crowd: c.globalRating };
      e.sum += c.rating;
      e.n++;
      e.crowd = c.globalRating;
      m.set(k, e);
    }
    return [...m.entries()].map(([key, e]): Take => {
      const mine = e.sum / e.n;
      return { key, beer: e.beer, brewery: e.brewery, mine, crowd: e.crowd, diff: mine - e.crowd, n: e.n };
    });
  }, [checkins]);

  if (loading && !checkins.length) return <Loading />;
  if (!takes.length) {
    return (
      <div className="rv-card">
        <h2>No crowd ratings yet</h2>
        <p className="muted">
          Hot takes compare your ratings with Untappd&apos;s global average, which comes from the export. Re-upload your
          Untappd JSON on the Admin page to fill it in.
        </p>
      </div>
    );
  }

  const avgDiff = takes.reduce((s, t) => s + t.diff, 0) / takes.length;
  const contrarian = takes.reduce((s, t) => s + Math.abs(t.diff), 0) / takes.length;
  const agree = takes.filter((t) => Math.abs(t.diff) <= AGREE).length / takes.length;
  const loved = [...takes].sort((a, b) => b.diff - a.diff).slice(0, 15);
  const hated = [...takes].sort((a, b) => a.diff - b.diff).slice(0, 15);

  return (
    <div className="hot">
      <div className="tiles">
        <div className="tile-stat">
          <b>{takes.length.toLocaleString()}</b>
          <span>beers rated</span>
        </div>
        <div className="tile-stat">
          <b>{(avgDiff >= 0 ? "+" : "") + avgDiff.toFixed(2)}</b>
          <span>vs the crowd</span>
          <em>{Math.abs(avgDiff) < 0.05 ? "right in line" : avgDiff > 0 ? "a generous rater" : "a tough critic"}</em>
        </div>
        <div className="tile-stat">
          <b>{contrarian.toFixed(2)}</b>
          <span>contrarian score</span>
          <em>avg gap either way</em>
        </div>
        <div className="tile-stat">
          <b>{Math.round(agree * 100)}%</b>
          <span>within ±{AGREE}</span>
        </div>
      </div>

      <section className="rv-card">
        <h2>You vs the crowd</h2>
        <p className="muted small">
          Each dot is a beer. Above the line you liked it more than Untappd overall; below, less.
        </p>
        <Scatter takes={takes} />
        <div className="legend small">
          <span><i style={{ background: WARM }} /> You rated higher</span>
          <span><i style={{ background: MID }} /> Within ±{AGREE}</span>
          <span><i style={{ background: COLD }} /> You rated lower</span>
        </div>
      </section>

      <div className="rv-grid two">
        <TakeList title="You loved it, they didn't" takes={loved} />
        <TakeList title="Everyone loves it, you don't" takes={hated} />
      </div>
    </div>
  );
}

function colorFor(diff: number) {
  return Math.abs(diff) <= AGREE ? MID : diff > 0 ? WARM : COLD;
}

function Scatter({ takes }: { takes: Take[] }) {
  const { tip, show, hide } = useTip();
  const W = 640, H = 380, L = 34, B = 44, T = 8, R = 8;
  const xs = takes.map((t) => t.crowd);
  const x0 = Math.floor(Math.min(...xs) * 2) / 2, x1 = Math.ceil(Math.max(...xs) * 2) / 2;
  const y0 = 0, y1 = 5;
  const sx = (v: number) => L + ((v - x0) / (x1 - x0)) * (W - L - R);
  const sy = (v: number) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const xticks: number[] = [];
  for (let v = x0; v <= x1 + 1e-9; v += 0.5) xticks.push(v);
  // Draw agreeing dots first so the outliers sit on top
  const ordered = [...takes].sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff));

  return (
    <div className="tiphost chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Your rating against the global rating for each beer">
        {[1, 2, 3, 4, 5].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} stroke="var(--line)" strokeWidth={0.5} />
            <text x={L - 6} y={sy(v) + 3} textAnchor="end" className="axis">{v}</text>
          </g>
        ))}
        {xticks.map((v) => (
          <text key={v} x={sx(v)} y={H - B + 16} textAnchor="middle" className="axis">{v.toFixed(1)}</text>
        ))}
        <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" className="axis">Untappd global rating →</text>
        <text x={L + 6} y={T + 10} className="axis">your rating ↑</text>
        {/* agreement line */}
        <line x1={sx(x0)} y1={sy(x0)} x2={sx(x1)} y2={sy(x1)} stroke="var(--muted)" strokeDasharray="4 4" strokeWidth={1} />
        {ordered.map((t) => (
          <circle
            key={t.key}
            cx={sx(t.crowd)}
            cy={sy(t.mine)}
            r={4}
            fill={colorFor(t.diff)}
            fillOpacity={0.8}
            stroke="#161a20"
            strokeWidth={1}
            onMouseMove={(e) =>
              show(
                e,
                <>
                  <b>{t.beer}</b>
                  <br />
                  <span className="muted">{t.brewery}</span>
                  <br />
                  You {t.mine.toFixed(2)} · Crowd {t.crowd.toFixed(2)}
                </>,
              )
            }
            onMouseLeave={hide}
          />
        ))}
      </svg>
      <TipBox tip={tip} />
    </div>
  );
}

function TakeList({ title, takes }: { title: string; takes: Take[] }) {
  return (
    <section className="rv-card">
      <h2>{title}</h2>
      <ol className="rank takes">
        {takes.map((t) => (
          <li key={t.key}>
            <div>
              <b>{t.beer}</b>
              <div className="muted small">{t.brewery}</div>
            </div>
            <div className="take-nums">
              <span className="take-diff">
                <i className="dot" style={{ background: colorFor(t.diff) }} />
                {(t.diff > 0 ? "+" : "") + t.diff.toFixed(2)}
              </span>
              <span className="muted small">
                {t.mine.toFixed(2)} vs {t.crowd.toFixed(2)}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
