import type { Checkin, Mode } from "./types";

export type Place = {
  loc: string;
  lat: number;
  lng: number;
  name: string; // venue privately, city publicly
  where: string; // "City, State, Country"
  countryCode: string;
  checkins: Checkin[]; // newest first
  photos: Checkin[];
};

export function where(c: Pick<Checkin, "city" | "state" | "country">): string {
  return [c.city, c.state, c.country].filter(Boolean).join(", ");
}

export function places(checkins: Checkin[], mode: Mode): Place[] {
  const by = new Map<string, Place>();
  for (const c of checkins) {
    if (!c.loc || c.lat == null || c.lng == null) continue;
    let p = by.get(c.loc);
    if (!p) {
      const w = where(c);
      p = {
        loc: c.loc,
        lat: c.lat,
        lng: c.lng,
        name: mode === "private" ? (c.venue ?? w) : c.city || c.state || c.country,
        where: w,
        countryCode: c.countryCode,
        checkins: [],
        photos: [],
      };
      by.set(c.loc, p);
    }
    p.checkins.push(c);
    if (c.photo) p.photos.push(c);
  }
  for (const p of by.values()) {
    p.checkins.sort((a, b) => b.t.localeCompare(a.t));
    p.photos.sort((a, b) => b.t.localeCompare(a.t));
  }
  return [...by.values()];
}

export function stats(checkins: Checkin[]) {
  const countries = new Set<string>();
  const cities = new Set<string>();
  const beers = new Set<string>();
  for (const c of checkins) {
    beers.add(`${c.brewery}|${c.beer}`);
    if (c.country) countries.add(c.country);
    if (c.city) cities.add(`${c.country}|${c.state}|${c.city}`);
  }
  return { checkins: checkins.length, beers: beers.size, countries: countries.size, cities: cities.size };
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) {
  return new Date(iso).toLocaleDateString("en-US", opts);
}
