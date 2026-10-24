"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useData } from "@/components/DataProvider";
import { Loading, Photo, Stars } from "@/components/bits";
import { Bars } from "@/components/charts";
import { local, fmtDay, trips, fmtRange, styleFamily } from "@/lib/stats";
import { flag } from "@/lib/normalize";
import type { Checkin } from "@/lib/types";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function top<T>(items: T[], key: (x: T) => string | null | undefined, n = 5) {
  const m = new Map<string, number>();
  for (const x of items) {
    const k = key(x);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

export default function ReviewPage() {
  return (
    <Suspense>
      <Review />
    </Suspense>
  );
}

function Review() {
  const { mode, checkins, loading } = useData();
  const params = useSearchParams();
  const router = useRouter();
  const priv = mode === "private";

  const byYear = useMemo(() => {
    const m = new Map<number, Checkin[]>();
    for (const c of checkins) {
      const y = local(c).year;
      const arr = m.get(y);
      if (arr) arr.push(c);
      else m.set(y, [c]);
    }
    return m;
  }, [checkins]);
  const years = [...byYear.keys()].sort((a, b) => b - a);
  const year = Number(params.get("year")) || years[0];
  const allTrips = useMemo(() => trips(checkins), [checkins]);

  const r = useMemo(() => {
    const cs = byYear.get(year) ?? [];
    if (!cs.length) return null;
    const before = checkins.filter((c) => local(c).year < year);
    const seenCountries = new Set(before.map((c) => c.country).filter(Boolean));
    const seenCities = new Set(before.filter((c) => c.city).map((c) => `${c.country}|${c.state}|${c.city}`));
    const seenBeers = new Set(before.map((c) => `${c.brewery}|${c.beer}`));
    const newCountries = [...new Set(cs.map((c) => c.country).filter((x) => x && !seenCountries.has(x)))];
    const newCities = new Set(
      cs.filter((c) => c.city && !seenCities.has(`${c.country}|${c.state}|${c.city}`)).map((c) => `${c.country}|${c.state}|${c.city}`),
    );
    const days = new Map<string, Checkin[]>();
    const months = Array.from({ length: 12 }, () => 0);
    for (const c of cs) {
      const l = local(c);
      months[l.month]++;
      days.set(l.day, [...(days.get(l.day) ?? []), c]);
    }
    const busiest = [...days.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    const rated = cs.filter((c) => c.rating != null);
    const best = [...rated].sort((a, b) => b.rating! - a.rating! || b.t.localeCompare(a.t)).slice(0, 5);
    const abvs = cs.filter((c) => c.abv).map((c) => c.abv!);
    return {
      cs,
      unique: new Set(cs.map((c) => `${c.brewery}|${c.beer}`)).size,
      newBeers: new Set(cs.map((c) => `${c.brewery}|${c.beer}`).filter((k) => !seenBeers.has(k))).size,
      breweries: new Set(cs.map((c) => c.brewery)).size,
      countries: new Set(cs.map((c) => c.country).filter(Boolean)).size,
      newCountries,
      newCities: newCities.size,
      months,
      busiest,
      activeDays: days.size,
      avgRating: rated.length ? rated.reduce((s, c) => s + c.rating!, 0) / rated.length : null,
      avgAbv: abvs.length ? abvs.reduce((s, x) => s + x, 0) / abvs.length : null,
      best,
      breweriesTop: top(cs, (c) => c.brewery),
      stylesTop: top(cs, (c) => styleFamily(c.style)),
      placesTop: top(cs, (c) => (priv ? c.venue && c.loc ? c.venue : null : c.city || null)),
      serving: top(cs, (c) => c.serving || null, 1)[0],
      prev: byYear.get(year - 1)?.length ?? 0,
      photos: priv ? rated.filter((c) => c.photo).sort((a, b) => b.rating! - a.rating!).slice(0, 8) : [],
      trips: allTrips.filter((t) => t.start.startsWith(String(year)) || t.end.startsWith(String(year))),
    };
  }, [byYear, year, checkins, allTrips, priv]);

  if (loading && !checkins.length) return <Loading />;
  if (!r) return <p className="muted">No check-ins.</p>;
  const delta = r.prev ? Math.round(((r.cs.length - r.prev) / r.prev) * 100) : null;

  return (
    <div className="review">
      <div className="chips">
        {years.map((y) => (
          <button key={y} className={y === year ? "on" : ""} onClick={() => router.replace(`/stats/review?year=${y}`, { scroll: false })}>
            {y}
          </button>
        ))}
      </div>

      <header className="rv-hero">
        <p className="pp-kicker">jimmylegs.beer · year in review</p>
        <h1>{year}</h1>
        <div className="rv-big">
          <b>{r.cs.length.toLocaleString()}</b>
          <span>
            check-ins
            {delta != null && (
              <em className={delta >= 0 ? "up" : "down"}>
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% vs {year - 1}
              </em>
            )}
          </span>
        </div>
      </header>

      <div className="tiles">
        <Tile n={r.unique} label="different beers" sub={`${r.newBeers.toLocaleString()} first tries`} />
        <Tile n={r.breweries} label="breweries" />
        <Tile n={r.countries} label="countries" sub={r.newCountries.length ? `${r.newCountries.length} new` : undefined} />
        <Tile n={r.newCities} label="new cities" />
        <Tile n={r.activeDays} label="drinking days" />
        <Tile n={r.avgRating ? Number(r.avgRating.toFixed(2)) : null} label="avg rating" />
        <Tile n={r.avgAbv ? Number(r.avgAbv.toFixed(1)) : null} label="avg ABV %" />
        {r.serving && <Tile text={r.serving[0]} label="go-to serving" sub={`${r.serving[1]} times`} />}
      </div>

      <section className="rv-card">
        <h2>Check-ins by month</h2>
        <Bars
          data={r.months.map((v, i) => ({ key: String(i), value: v }))}
          label={(k) => MONTHS[Number(k)]}
          valueLabel={(v) => `${v} check-in${v === 1 ? "" : "s"}`}
        />
      </section>

      <div className="rv-grid">
        <section className="rv-card">
          <h2>Top rated</h2>
          <ol className="rank">
            {r.best.map((c) => (
              <li key={c.id}>
                <div>
                  <b>{c.beer}</b>
                  <div className="muted small">{c.brewery} · {fmtDay(local(c).day, { month: "short", day: "numeric" })}</div>
                </div>
                <Stars value={c.rating} />
              </li>
            ))}
          </ol>
        </section>
        <RankCard title="Top breweries" rows={r.breweriesTop} />
        <RankCard title="Top styles" rows={r.stylesTop} />
        <RankCard title={priv ? "Top venues" : "Top cities"} rows={r.placesTop} />
        <section className="rv-card">
          <h2>Biggest day</h2>
          {r.busiest && (
            <>
              <p className="rv-day">
                <b>{fmtDay(r.busiest[0], { weekday: "long", month: "long", day: "numeric" })}</b>
                <span className="muted"> · {r.busiest[1].length} check-ins</span>
              </p>
              <ul className="plain small muted">
                {r.busiest[1].slice(0, 6).map((c) => (
                  <li key={c.id}>{c.beer} — {c.brewery}</li>
                ))}
              </ul>
            </>
          )}
        </section>
        <section className="rv-card">
          <h2>Trips</h2>
          {r.trips.length ? (
            <ul className="plain">
              {r.trips.map((t) => (
                <li key={t.id}>
                  <Link href={`/stats/trips?trip=${t.id}`} className="link">
                    {t.countryCodes.slice(0, 3).map(flag).join(" ")} {t.name}
                  </Link>
                  <span className="muted small"> · {fmtRange(t.start, t.end)} · {t.checkins.length}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Stayed close to home.</p>
          )}
          {r.newCountries.length > 0 && (
            <p className="small">
              <span className="muted">New countries: </span>
              {r.newCountries.join(", ")}
            </p>
          )}
        </section>
      </div>

      {r.photos.length > 0 && (
        <section className="rv-card">
          <h2>Best of {year}</h2>
          <div className="rv-photos">
            {r.photos.map((c) => (
              <Link key={c.id} href={`/?loc=${c.loc}`} title={`${c.beer} · ${c.rating}`}>
                <Photo url={c.photo!} size={200} alt={c.beer} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Tile({ n, text, label, sub }: { n?: number | null; text?: string; label: string; sub?: string }) {
  return (
    <div className="tile-stat">
      <b>{text ?? (n == null ? "—" : n.toLocaleString())}</b>
      <span>{label}</span>
      {sub && <em>{sub}</em>}
    </div>
  );
}

function RankCard({ title, rows }: { title: string; rows: [string, number][] }) {
  const max = rows[0]?.[1] ?? 1;
  return (
    <section className="rv-card">
      <h2>{title}</h2>
      <ol className="rank bars">
        {rows.map(([k, n]) => (
          <li key={k}>
            <div className="rank-bar" style={{ width: `${(n / max) * 100}%` }} />
            <span>{k}</span>
            <b>{n}</b>
          </li>
        ))}
      </ol>
    </section>
  );
}
