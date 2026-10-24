"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useData } from "@/components/DataProvider";
import { Loading, Stars } from "@/components/bits";
import { SortTable, type Column } from "@/components/SortTable";
import { fmtDate, places, where } from "@/lib/group";
import { flag } from "@/lib/normalize";
import type { Checkin } from "@/lib/types";

type Tab = "checkins" | "venues" | "cities" | "countries";

// A venue, city or country with everything the tables need
type Agg = {
  key: string;
  name: string;
  sub: string;
  code: string;
  loc: string | null; // where clicking the row lands on the map
  count: number;
  venues: Set<string>;
  cities: Set<string>;
  ratingSum: number;
  rated: number;
  first: string;
  last: string;
};

function aggregate(checkins: Checkin[], keyOf: (c: Checkin) => string | null, label: (c: Checkin) => [string, string]) {
  const m = new Map<string, Agg>();
  for (const c of checkins) {
    const k = keyOf(c);
    if (!k) continue;
    let a = m.get(k);
    if (!a) {
      const [name, sub] = label(c);
      a = {
        key: k, name, sub, code: c.countryCode, loc: c.loc, count: 0, venues: new Set(), cities: new Set(),
        ratingSum: 0, rated: 0, first: c.t, last: c.t,
      };
      m.set(k, a);
    }
    a.count++;
    if (c.loc) a.venues.add(c.loc);
    if (c.city) a.cities.add(`${c.country}|${c.state}|${c.city}`);
    if (c.rating != null) {
      a.ratingSum += c.rating;
      a.rated++;
    }
    if (c.t < a.first) a.first = c.t;
    if (c.t > a.last) {
      a.last = c.t;
      if (c.loc) a.loc = c.loc;
    }
  }
  return [...m.values()];
}

const avg = (a: Agg) => (a.rated ? Math.round((a.ratingSum / a.rated) * 100) / 100 : null);
const day = (iso: string) => fmtDate(iso);

export default function ListsPage() {
  return (
    <Suspense>
      <Lists />
    </Suspense>
  );
}

function Lists() {
  const { mode, checkins, loading } = useData();
  const params = useSearchParams();
  const router = useRouter();
  const tab = (params.get("tab") as Tab) || "checkins";
  const [q, setQ] = useState("");
  const priv = mode === "private";
  const go = (loc: string | null) => loc && router.push(`/?loc=${loc}`);

  const venues = useMemo(
    () =>
      places(checkins, mode).map((p) => ({
        ...aggregate(p.checkins, () => p.loc, () => [p.name, p.where])[0],
        loc: p.loc,
      })),
    [checkins, mode],
  );
  const cities = useMemo(
    () =>
      aggregate(
        checkins,
        (c) => (c.city ? `${c.country}|${c.state}|${c.city}` : null),
        (c) => [c.city, [c.state, c.country].filter(Boolean).join(", ")],
      ),
    [checkins],
  );
  const countries = useMemo(
    () => aggregate(checkins, (c) => c.country || null, (c) => [c.country, ""]),
    [checkins],
  );
  const found = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return checkins;
    return checkins.filter((c) =>
      [c.beer, c.brewery, c.style, c.venue, c.city, c.state, c.country].some((v) => v?.toLowerCase().includes(s)),
    );
  }, [checkins, q]);

  if (loading && !checkins.length) return <Loading />;

  const tabs: { id: Tab; label: string; n: number }[] = [
    { id: "checkins", label: "Check-ins", n: checkins.length },
    { id: "venues", label: priv ? "Venues" : "Places", n: venues.length },
    { id: "cities", label: "Cities", n: cities.length },
    { id: "countries", label: "Countries", n: countries.length },
  ];

  const countCol: Column<Agg> = { key: "count", label: "Check-ins", num: true, value: (a) => a.count };
  const ratingCol: Column<Agg> = {
    key: "rating", label: "Avg rating", num: true, hideMobile: true, value: avg,
    render: (a) => (avg(a) == null ? <span className="muted">—</span> : avg(a)!.toFixed(2)),
  };
  const firstCol: Column<Agg> = { key: "first", label: "First", hideMobile: true, value: (a) => a.first, render: (a) => day(a.first) };
  const lastCol: Column<Agg> = { key: "last", label: "Last", hideMobile: true, value: (a) => a.last, render: (a) => day(a.last) };
  const byCount = { key: "count", desc: true };

  return (
    <div className="scroll">
      <div className="lists">
        <nav className="tabs">
          {tabs.map((t) => (
            <Link key={t.id} href={`/lists?tab=${t.id}`} className={t.id === tab ? "on" : ""} replace>
              <b>{t.n.toLocaleString()}</b> {t.label}
            </Link>
          ))}
        </nav>

        {tab === "checkins" && (
          <>
            <input
              className="input search"
              placeholder="Search beer, brewery, style, venue, place…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && <p className="muted small">{found.length.toLocaleString()} matches</p>}
            <SortTable<Checkin>
              key={`c-${mode}`}
              rows={found}
              rowKey={(c) => c.id}
              initial={{ key: "t", desc: true }}
              onRow={(c) => go(c.loc)}
              columns={[
                { key: "t", label: "Date", value: (c) => c.t, render: (c) => day(c.t) },
                {
                  key: "beer", label: "Beer", value: (c) => c.beer,
                  render: (c) => (
                    <>
                      <b>{c.beer}</b>
                      <div className="muted small">{c.brewery}</div>
                    </>
                  ),
                },
                { key: "style", label: "Style", hideMobile: true, value: (c) => c.style },
                {
                  key: "rating", label: "Rating", num: true, value: (c) => c.rating,
                  render: (c) => (c.rating == null ? <span className="muted">—</span> : <Stars value={c.rating} />),
                },
                {
                  key: "where", label: priv ? "Venue" : "Place", hideMobile: true,
                  value: (c) => (priv ? (c.venue ?? "") : c.city) || where(c),
                  render: (c) =>
                    c.loc ? (
                      <>
                        {priv && c.venue && <div>{c.venue}</div>}
                        <div className={priv && c.venue ? "muted small" : ""}>{where(c)}</div>
                      </>
                    ) : (
                      <span className="muted">{(priv && c.venue) || "No location"}</span>
                    ),
                },
              ]}
            />
          </>
        )}

        {tab === "venues" && (
          <SortTable<Agg>
            key={`v-${mode}`}
            rows={venues}
            rowKey={(a) => a.key}
            initial={byCount}
            onRow={(a) => go(a.loc)}
            columns={[
              {
                key: "name", label: priv ? "Venue" : "Place", value: (a) => a.name,
                render: (a) => (
                  <>
                    <b>{a.name}</b>
                    {priv && <div className="muted small">{a.sub}</div>}
                  </>
                ),
              },
              ...(priv ? [] : [{ key: "sub", label: "Where", hideMobile: true, value: (a: Agg) => a.sub }]),
              countCol, ratingCol, firstCol, lastCol,
            ]}
          />
        )}

        {tab === "cities" && (
          <SortTable<Agg>
            key={`ci-${mode}`}
            rows={cities}
            rowKey={(a) => a.key}
            initial={byCount}
            onRow={(a) => go(a.loc)}
            columns={[
              {
                key: "name", label: "City", value: (a) => a.name,
                render: (a) => (
                  <>
                    <b>{a.name}</b>
                    <div className="muted small">{a.sub}</div>
                  </>
                ),
              },
              countCol,
              ...(priv ? [{ key: "venues", label: "Venues", num: true, hideMobile: true, value: (a: Agg) => a.venues.size }] : []),
              ratingCol, firstCol, lastCol,
            ]}
          />
        )}

        {tab === "countries" && (
          <SortTable<Agg>
            key={`co-${mode}`}
            rows={countries}
            rowKey={(a) => a.key}
            initial={byCount}
            onRow={(a) => go(a.loc)}
            columns={[
              {
                key: "name", label: "Country", value: (a) => a.name,
                render: (a) => (
                  <b>
                    {flag(a.code)} {a.name}
                  </b>
                ),
              },
              countCol,
              { key: "cities", label: "Cities", num: true, value: (a) => a.cities.size },
              ...(priv ? [{ key: "venues", label: "Venues", num: true, hideMobile: true, value: (a: Agg) => a.venues.size }] : []),
              ratingCol,
              { ...firstCol, label: "First visit" },
              lastCol,
            ]}
          />
        )}
      </div>
    </div>
  );
}
