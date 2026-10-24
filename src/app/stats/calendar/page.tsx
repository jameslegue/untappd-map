"use client";

import { useMemo } from "react";
import { useData } from "@/components/DataProvider";
import { Loading } from "@/components/bits";
import { Legend, RAMP, rampStep, TipBox, useTip } from "@/components/charts";
import { dailyCounts, fmtDay, local } from "@/lib/stats";
import type { Checkin } from "@/lib/types";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_BREAKS = [1, 2, 3, 5, 8]; // check-ins per day for ramp steps 1..5
const CELL = 11, GAP = 2, STEP = CELL + GAP;

function hourLabel(h: number) {
  return h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`;
}

export default function CalendarPage() {
  const { checkins, loading } = useData();
  const days = useMemo(() => dailyCounts(checkins), [checkins]);
  const years = useMemo(
    () => [...new Set([...days.keys()].map((d) => Number(d.slice(0, 4))))].sort((a, b) => b - a),
    [days],
  );
  const grid = useMemo(() => {
    const g = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
    for (const c of checkins) {
      const l = local(c);
      g[l.dow][l.hour]++;
    }
    return g;
  }, [checkins]);

  if (loading && !checkins.length) return <Loading />;

  const max = Math.max(...grid.flat());
  const hourBreaks = [1, 0.1, 0.25, 0.45, 0.7].map((f, i) => (i === 0 ? 1 : Math.ceil(max * f)));
  const busiestDow = grid.map((r) => r.reduce((a, b) => a + b, 0));
  const topDow = busiestDow.indexOf(Math.max(...busiestDow));
  const hourTotals = Array.from({ length: 24 }, (_, h) => grid.reduce((s, r) => s + r[h], 0));
  const topHour = hourTotals.indexOf(Math.max(...hourTotals));

  return (
    <div className="calendar">
      <section className="rv-card">
        <h2>When you drink</h2>
        <p className="muted small">
          Local time where you checked in. Busiest: <b>{DOW[topDow]}s</b> around <b>{hourLabel(topHour)}</b>.
        </p>
        <HourGrid grid={grid} breaks={hourBreaks} />
        <Legend breaks={hourBreaks} unit="check-ins" />
      </section>

      <section className="rv-card">
        <h2>Every day since 2011</h2>
        <Legend breaks={DAY_BREAKS} unit="check-ins / day" />
        {years.map((y) => (
          <YearGrid key={y} year={y} days={days} />
        ))}
      </section>
    </div>
  );
}

function YearGrid({ year, days }: { year: number; days: Map<string, Checkin[]> }) {
  const { tip, show, hide } = useTip();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const lead = jan1.getUTCDay();
  const n = (Date.UTC(year + 1, 0, 1) - jan1.getTime()) / 86_400_000;
  const weeks = Math.ceil((n + lead) / 7);
  const W = 28 + weeks * STEP, H = 16 + 7 * STEP;
  let total = 0, active = 0;
  const cells = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(jan1.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    const cs = days.get(d) ?? [];
    total += cs.length;
    if (cs.length) active++;
    const col = Math.floor((i + lead) / 7), row = (i + lead) % 7;
    cells.push(
      <rect
        key={d}
        x={28 + col * STEP}
        y={16 + row * STEP}
        width={CELL}
        height={CELL}
        rx={2}
        fill={RAMP[rampStep(cs.length, DAY_BREAKS)]}
        onMouseMove={(e) =>
          show(
            e,
            <>
              <b>{fmtDay(d, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</b>
              <br />
              {cs.length ? `${cs.length} check-in${cs.length === 1 ? "" : "s"}` : "No check-ins"}
              {cs.slice(0, 3).map((c) => (
                <div key={c.id} className="muted">{c.beer}</div>
              ))}
              {cs.length > 3 && <div className="muted">+{cs.length - 3} more</div>}
            </>,
          )
        }
        onMouseLeave={hide}
      />,
    );
  }
  const months = Array.from({ length: 12 }, (_, m) => {
    const off = (Date.UTC(year, m, 1) - jan1.getTime()) / 86_400_000;
    return { m, x: 28 + Math.floor((off + lead) / 7) * STEP };
  });

  return (
    <div className="year-grid">
      <div className="year-head">
        <b>{year}</b>
        <span className="muted small">
          {total.toLocaleString()} check-ins · {active} days
        </span>
      </div>
      <div className="tiphost chart">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Check-ins per day in ${year}`}>
          {months.map(({ m, x }) => (
            <text key={m} x={x} y={10} className="axis">
              {new Date(Date.UTC(year, m, 1)).toLocaleString("en-US", { month: "short", timeZone: "UTC" })}
            </text>
          ))}
          {[1, 3, 5].map((r) => (
            <text key={r} x={0} y={16 + r * STEP + 9} className="axis">
              {DOW[r]}
            </text>
          ))}
          {cells}
        </svg>
        <TipBox tip={tip} />
      </div>
    </div>
  );
}

function HourGrid({ grid, breaks }: { grid: number[][]; breaks: number[] }) {
  const { tip, show, hide } = useTip();
  const C = 22, G = 2, L = 34, T = 16;
  const W = L + 24 * (C + G), H = T + 7 * (C + G);
  return (
    <div className="tiphost chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Check-ins by day of week and hour">
        {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
          <text key={h} x={L + h * (C + G)} y={10} className="axis">
            {hourLabel(h)}
          </text>
        ))}
        {grid.map((row, d) => (
          <g key={d}>
            <text x={0} y={T + d * (C + G) + 15} className="axis">
              {DOW[d]}
            </text>
            {row.map((n, h) => (
              <rect
                key={h}
                x={L + h * (C + G)}
                y={T + d * (C + G)}
                width={C}
                height={C}
                rx={3}
                fill={RAMP[rampStep(n, breaks)]}
                onMouseMove={(e) => show(e, <><b>{DOW[d]} {hourLabel(h)}</b><br />{n} check-in{n === 1 ? "" : "s"}</>)}
                onMouseLeave={hide}
              />
            ))}
          </g>
        ))}
      </svg>
      <TipBox tip={tip} />
    </div>
  );
}
