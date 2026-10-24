"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useData } from "@/components/DataProvider";
import { Loading, Stars } from "@/components/bits";
import { dailyCounts, fmtDay, fmtRange, local, streaks, styleFamily } from "@/lib/stats";
import { where } from "@/lib/group";
import type { Checkin } from "@/lib/types";

const MILESTONES = [1, 100, 250, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 6000, 7000, 7500, 8000, 9000, 10000];

export default function StreaksPage() {
  const { mode, checkins, loading } = useData();
  const priv = mode === "private";

  const s = useMemo(() => {
    const sorted = [...checkins].sort((a, b) => a.t.localeCompare(b.t));
    const days = dailyCounts(sorted);
    const runs = streaks([...days.keys()]);
    const biggest = [...days.entries()].sort((a, b) => b[1].length - a[1].length)[0];

    const reached = MILESTONES.filter((m) => m <= sorted.length).map((m) => ({ m, c: sorted[m - 1] }));
    const next = MILESTONES.find((m) => m > sorted.length);
    // Pace over the last 365 days projects the next milestone
    const yearAgo = Date.now() - 365 * 86_400_000;
    const pace = sorted.filter((c) => Date.parse(c.t) >= yearAgo).length / 365;
    const eta = next && pace > 0 ? new Date(Date.now() + ((next - sorted.length) / pace) * 86_400_000) : null;

    // First time for each style family, oldest first
    const firstStyle = new Map<string, Checkin>();
    for (const c of sorted) {
      const f = styleFamily(c.style);
      if (c.style && !firstStyle.has(f)) firstStyle.set(f, c);
    }
    const firstOf = (p: (c: Checkin) => boolean) => sorted.find(p);
    const firsts = [
      { label: "First ever check-in", c: sorted[0] },
      { label: "First check-in outside Canada", c: firstOf((c) => !!c.country && c.country !== "Canada") },
      { label: "First perfect 5", c: firstOf((c) => c.rating === 5) },
      { label: "First at home", c: firstOf((c) => !!c.home) },
      ...(priv ? [{ label: "First photo", c: firstOf((c) => !!c.photo) }] : []),
    ]
      .filter((f): f is { label: string; c: Checkin } => !!f.c)
      .sort((a, b) => a.c.t.localeCompare(b.c.t));

    return { sorted, days, runs, biggest, reached, next, eta, pace, firstStyle: [...firstStyle.entries()], firsts };
  }, [checkins, priv]);

  if (loading && !checkins.length) return <Loading />;
  if (!s.sorted.length) return null;

  return (
    <div className="streaks">
      <div className="tiles">
        <div className="tile-stat">
          <b>{s.runs.best.days}</b>
          <span>day streak (best)</span>
          <em>{fmtRange(s.runs.best.start, s.runs.best.end)}</em>
        </div>
        <div className="tile-stat">
          <b>{s.runs.current}</b>
          <span>day streak (now)</span>
          <em>{s.runs.current ? "keep it going" : "time for a beer?"}</em>
        </div>
        <div className="tile-stat">
          <b>{s.runs.drought.days}</b>
          <span>longest dry spell (days)</span>
          <em>{fmtRange(s.runs.drought.start, s.runs.drought.end)}</em>
        </div>
        {s.biggest && (
          <div className="tile-stat">
            <b>{s.biggest[1].length}</b>
            <span>most in one day</span>
            <em>{fmtDay(s.biggest[0])}</em>
          </div>
        )}
        <div className="tile-stat">
          <b>{s.days.size.toLocaleString()}</b>
          <span>days with a check-in</span>
        </div>
        <div className="tile-stat">
          <b>{(s.pace * 7).toFixed(1)}</b>
          <span>per week lately</span>
          <em>last 12 months</em>
        </div>
      </div>

      <div className="rv-grid two">
        <section className="rv-card">
          <h2>Milestones</h2>
          <ol className="timeline">
            {s.reached.map(({ m, c }) => (
              <li key={m}>
                <span className="ms">#{m.toLocaleString()}</span>
                <div>
                  <b>{c.beer}</b> <span className="muted">· {c.brewery}</span>
                  <div className="muted small">
                    {fmtDay(local(c).day)}
                    {c.loc && <> · <Link className="link" href={`/?loc=${c.loc}`}>{priv && c.venue ? c.venue : where(c)}</Link></>}
                  </div>
                </div>
              </li>
            ))}
            {s.next && (
              <li className="upcoming">
                <span className="ms">#{s.next.toLocaleString()}</span>
                <div>
                  <b>Up next</b>
                  <div className="muted small">
                    {(s.next - s.sorted.length).toLocaleString()} to go
                    {s.eta && <> · around {s.eta.toLocaleDateString("en-US", { month: "long", year: "numeric" })} at this pace</>}
                  </div>
                </div>
              </li>
            )}
          </ol>
        </section>

        <section className="rv-card">
          <h2>Firsts</h2>
          <ol className="timeline">
            {s.firsts.map(({ label, c }) => (
              <li key={label}>
                <span className="ms small">{fmtDay(local(c).day, { month: "short", year: "numeric" })}</span>
                <div>
                  <span className="muted small">{label}</span>
                  <div>
                    <b>{c.beer}</b> <span className="muted">· {c.brewery}</span>
                  </div>
                  {c.rating != null && <Stars value={c.rating} />}
                </div>
              </li>
            ))}
          </ol>
          <h2 style={{ marginTop: 20 }}>First of each style</h2>
          <ol className="rank">
            {s.firstStyle.map(([f, c]) => (
              <li key={f}>
                <div>
                  <b>{f}</b>
                  <div className="muted small">
                    {c.beer} · {c.brewery}
                  </div>
                </div>
                <span className="muted small">{fmtDay(local(c).day, { month: "short", year: "numeric" })}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
