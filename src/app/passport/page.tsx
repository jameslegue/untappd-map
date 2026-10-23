"use client";

import { useMemo, useState } from "react";
import { useData } from "@/components/DataProvider";
import { Loading, Stars } from "@/components/bits";
import { flag } from "@/lib/normalize";
import { fmtDate } from "@/lib/group";
import type { Checkin } from "@/lib/types";

type Region = { name: string; count: number; cities: Map<string, number> };
type Country = {
  name: string;
  code: string;
  checkins: Checkin[]; // oldest first
  regions: Map<string, Region>;
  top: Checkin | null;
};

// Stamp inks - picked per country so each stamp keeps its colour
const INKS = ["#e0703a", "#3aa0e0", "#5fbf6a", "#c95fd1", "#e0c03a", "#e05a7a", "#4fd1c5", "#9a8cff"];
const ink = (s: string) => INKS[[...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % INKS.length];
const tilt = (s: string) => (([...s].reduce((h, ch) => h + ch.charCodeAt(0), 0) % 11) - 5) * 1.2;

export default function PassportPage() {
  const { checkins, loading } = useData();
  const [open, setOpen] = useState<string | null>(null);

  const { countries, unplaced, breweryCountries } = useMemo(() => {
    const by = new Map<string, Country>();
    let unplaced = 0;
    const bc = new Map<string, number>();
    for (const c of checkins) {
      if (c.breweryCountry) bc.set(c.breweryCountry, (bc.get(c.breweryCountry) ?? 0) + 1);
      if (!c.country) {
        unplaced++;
        continue;
      }
      let k = by.get(c.country);
      if (!k) {
        k = { name: c.country, code: c.countryCode, checkins: [], regions: new Map(), top: null };
        by.set(c.country, k);
      }
      k.checkins.push(c);
      const rn = c.state || "—";
      const r = k.regions.get(rn) ?? { name: rn, count: 0, cities: new Map() };
      r.count++;
      if (c.city) r.cities.set(c.city, (r.cities.get(c.city) ?? 0) + 1);
      k.regions.set(rn, r);
      if (c.rating != null && (!k.top || c.rating > (k.top.rating ?? 0))) k.top = c;
    }
    const countries = [...by.values()].sort((a, b) => a.checkins[0].t.localeCompare(b.checkins[0].t));
    return {
      countries,
      unplaced,
      breweryCountries: [...bc.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [checkins]);

  if (loading && !checkins.length) return <Loading />;
  const sel = countries.find((c) => c.name === open);

  return (
    <div className="scroll">
      <div className="passport">
        <header className="pp-head">
          <div>
            <p className="pp-kicker">Beer passport</p>
            <h1>
              {countries.length} countries · {countries.reduce((n, c) => n + c.regions.size, 0)} regions
            </h1>
            <p className="muted">
              Stamped in order of first check-in.
              {unplaced > 0 && <> {unplaced.toLocaleString()} check-ins had no location and aren&apos;t stamped.</>}
            </p>
          </div>
        </header>

        <div className="stamps">
          {countries.map((c, i) => (
            <button
              key={c.name}
              className={`stamp ${open === c.name ? "on" : ""}`}
              style={{ "--ink": ink(c.name), "--tilt": `${tilt(c.name)}deg` } as React.CSSProperties}
              onClick={() => setOpen(open === c.name ? null : c.name)}
            >
              <span className="stamp-no">No. {String(i + 1).padStart(2, "0")}</span>
              <span className="stamp-flag">{flag(c.code)}</span>
              <span className="stamp-name">{c.name}</span>
              <span className="stamp-date">{fmtDate(c.checkins[0].t, { month: "short", year: "numeric" })}</span>
              <span className="stamp-count">
                {c.checkins.length.toLocaleString()} check-in{c.checkins.length === 1 ? "" : "s"}
              </span>
            </button>
          ))}
        </div>

        {sel && (
          <section className="pp-detail">
            <h2>
              {flag(sel.code)} {sel.name}
            </h2>
            <div className="pp-facts">
              <div>
                <span>First beer</span>
                <b>{sel.checkins[0].beer}</b>
                <em>
                  {sel.checkins[0].brewery} · {fmtDate(sel.checkins[0].t)}
                </em>
              </div>
              {sel.top && (
                <div>
                  <span>Top rated</span>
                  <b>{sel.top.beer}</b>
                  <em>
                    {sel.top.brewery} · <Stars value={sel.top.rating} />
                  </em>
                </div>
              )}
              <div>
                <span>Most recent</span>
                <b>{sel.checkins.at(-1)!.beer}</b>
                <em>{fmtDate(sel.checkins.at(-1)!.t)}</em>
              </div>
            </div>
            <div className="regions">
              {[...sel.regions.values()]
                .sort((a, b) => b.count - a.count)
                .map((r) => (
                  <div key={r.name} className="region">
                    <div className="region-head">
                      <b>{r.name}</b>
                      <span className="muted">{r.count}</span>
                    </div>
                    <div className="cities">
                      {[...r.cities.entries()]
                        .sort((a, b) => b[1] - a[1])
                        .map(([city, n]) => (
                          <span key={city} className="city">
                            {city} <i>{n}</i>
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}

        <section className="pp-brew">
          <h2>Beers from {breweryCountries.length} brewing countries</h2>
          <div className="cities">
            {breweryCountries.map(([name, n]) => (
              <span key={name} className="city">
                {name} <i>{n}</i>
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
