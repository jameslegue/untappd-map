"use client";

import { useMemo } from "react";
import { TipBox, useTip } from "./charts";
import { dayDiff, fmtDay, local } from "@/lib/stats";
import type { Checkin } from "@/lib/types";

// Goal: one never-before-checked-in beer per day of the year (Untappd's "unique")
export function NewBeerGoal({ checkins, year }: { checkins: Checkin[]; year: number }) {
  const g = useMemo(() => {
    // First local day each beer was ever checked in
    const first = new Map<string, string>();
    for (const c of [...checkins].sort((a, b) => a.t.localeCompare(b.t))) {
      const k = `${c.brewery}|${c.beer}`;
      if (!first.has(k)) first.set(k, local(c).day);
    }
    const jan1 = `${year}-01-01`;
    const daysInYear = dayDiff(jan1, `${year + 1}-01-01`);
    const perDay = Array<number>(daysInYear).fill(0);
    for (const d of first.values()) if (d.startsWith(String(year))) perDay[dayDiff(jan1, d)]++;
    const cum: number[] = [];
    perDay.reduce((s, n, i) => (cum[i] = s + n), 0);

    const today = new Date().toLocaleDateString("en-CA"); // viewer's local YYYY-MM-DD
    const current = today.startsWith(String(year));
    const lastDay = current ? dayDiff(jan1, today) + 1 : daysInYear; // days elapsed, 1-based
    const have = cum[lastDay - 1] ?? 0;
    const daysLeft = daysInYear - lastDay;
    return {
      jan1, daysInYear, cum, current, lastDay, have,
      delta: have - lastDay,
      needed: daysLeft > 0 ? (daysInYear - have) / daysLeft : null,
      projected: Math.round((have / lastDay) * daysInYear),
    };
  }, [checkins, year]);

  const ahead = g.delta >= 0;
  const pct = Math.round((g.have / g.daysInYear) * 100);

  return (
    <section className="rv-card goal">
      <div className="goal-head">
        <div>
          <h2>One new beer a day</h2>
          <p className="muted small">
            Beers you&apos;d never checked in before{g.current ? `, through day ${g.lastDay} of ${g.daysInYear}` : ""}.
          </p>
        </div>
        <div className="goal-score">
          <b>{g.have.toLocaleString()}</b>
          <span className="muted"> / {(g.current ? g.lastDay : g.daysInYear).toLocaleString()}</span>
        </div>
      </div>

      <div className="goal-facts">
        {g.current ? (
          <>
            <span className={ahead ? "up" : "down"}>
              {ahead ? "▲" : "▼"} {Math.abs(g.delta)} {ahead ? "ahead of" : "behind"} pace
            </span>
            {g.needed != null && (
              <span>
                {g.needed <= 0 ? (
                  "Goal already hit 🎉"
                ) : (
                  <>
                    Need <b>{g.needed.toFixed(2)}</b>/day to reach {g.daysInYear}
                  </>
                )}
              </span>
            )}
            <span>
              On track for <b>{g.projected}</b>
            </span>
          </>
        ) : (
          <span className={g.have >= g.daysInYear ? "up" : ""}>
            {g.have >= g.daysInYear ? "▲ Goal hit" : `Finished at ${pct}% of the goal`} · {g.have} of {g.daysInYear}
          </span>
        )}
      </div>

      <GoalChart {...g} />
    </section>
  );
}

function GoalChart({
  jan1, daysInYear, cum, lastDay, current,
}: { jan1: string; daysInYear: number; cum: number[]; lastDay: number; current: boolean }) {
  const { tip, show, hide } = useTip();
  const W = 1000, H = 230, L = 36, R = 44, T = 10, B = 24;
  const yMax = Math.max(daysInYear, ...cum.slice(0, lastDay));
  const x = (day: number) => L + (day / daysInYear) * (W - L - R); // day = 1-based day count
  const y = (v: number) => T + (1 - v / yMax) * (H - T - B);
  const actual = cum.slice(0, lastDay).map((v, i) => `${i ? "L" : "M"}${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const last = cum[lastDay - 1] ?? 0;
  const months = Array.from({ length: 12 }, (_, m) => {
    const d = `${jan1.slice(0, 4)}-${String(m + 1).padStart(2, "0")}-01`;
    return { m, day: dayDiff(jan1, d), label: fmtDay(d, { month: "short" }) };
  });
  const step = yMax > 600 ? 200 : 100;
  const ticks = Array.from({ length: Math.floor(yMax / step) + 1 }, (_, i) => i * step);

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const day = Math.min(lastDay, Math.max(1, Math.round(((px - L) / (W - L - R)) * daysInYear)));
    const have = cum[day - 1] ?? 0;
    const date = new Date(Date.parse(`${jan1}T12:00:00Z`) + (day - 1) * 86_400_000).toISOString().slice(0, 10);
    const diff = have - day;
    show(
      e,
      <>
        <b>{fmtDay(date, { month: "short", day: "numeric" })}</b> · day {day}
        <br />
        {have} new beers · goal {day}
        <br />
        <span className="muted">{diff === 0 ? "right on pace" : `${Math.abs(diff)} ${diff > 0 ? "ahead" : "behind"}`}</span>
      </>,
    );
  }

  return (
    <div className="tiphost chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="New beers this year against a one-per-day goal">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={0.5} />
            <text x={L - 6} y={y(v) + 3} textAnchor="end" className="axis">{v}</text>
          </g>
        ))}
        {months.map(({ m, day, label }) => (
          <text key={m} x={x(day)} y={H - 6} className="axis">{label}</text>
        ))}
        {/* goal: one a day */}
        <line x1={x(0)} y1={y(0)} x2={x(daysInYear)} y2={y(daysInYear)} stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="5 5" />
        <text x={x(daysInYear) + 4} y={y(daysInYear) + 4} className="axis">Goal</text>
        <path d={actual} fill="none" stroke="var(--amber)" strokeWidth={2} strokeLinejoin="round" />
        {current && (
          <line x1={x(lastDay)} x2={x(lastDay)} y1={T} y2={H - B} stroke="var(--line)" strokeDasharray="2 3" />
        )}
        <circle cx={x(lastDay)} cy={y(last)} r={5} fill="var(--amber)" stroke="#161a20" strokeWidth={2} />
        <text x={x(lastDay) + 8} y={y(last) + 4} className="axis goal-you">You</text>
        <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="transparent" onMouseMove={onMove} onMouseLeave={hide} />
      </svg>
      <TipBox tip={tip} />
    </div>
  );
}
