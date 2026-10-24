import type { Checkin } from "./types";

// Strip everything private and snap each check-in to a city-level point.
// This is the only shape that ever reaches a locked browser.
export function coarsen(all: Checkin[]): Checkin[] {
  const groups = new Map<string, { lat: number; lng: number; n: number; idx: number }>();
  const keyOf = (c: Checkin) =>
    c.city
      ? `${c.countryCode || c.country}|${c.state}|${c.city}`
      : // No city - bucket to a ~50km cell so the point stays vague
        `${c.countryCode || c.country}|${c.state}|${Math.round(c.lat! * 2) / 2},${Math.round(c.lng! * 2) / 2}`;

  for (const c of all) {
    if (c.lat == null || c.lng == null) continue;
    const k = keyOf(c);
    const g = groups.get(k) ?? { lat: 0, lng: 0, n: 0, idx: groups.size };
    g.lat += c.lat;
    g.lng += c.lng;
    g.n++;
    groups.set(k, g);
  }

  const round = (x: number) => Math.round(x * 10) / 10;
  const sorted = [...all].sort((a, b) => a.t.localeCompare(b.t));

  return sorted.map((c, i) => {
    const g = c.lat != null && c.lng != null ? groups.get(keyOf(c))! : null;
    return {
      id: i,
      t: c.t,
      off: c.off,
      beer: c.beer,
      brewery: c.brewery,
      breweryCountry: c.breweryCountry,
      style: c.style,
      abv: c.abv,
      rating: c.rating,
      globalRating: c.globalRating,
      serving: c.serving,
      loc: g ? `c${g.idx}` : null,
      lat: g ? round(g.lat / g.n) : null,
      lng: g ? round(g.lng / g.n) : null,
      city: g ? c.city : "",
      state: g ? c.state : "",
      country: g ? c.country : "",
      countryCode: g ? c.countryCode : "",
    };
  });
}
