import type { Checkin } from "./types";
import { HOME_CITIES } from "./normalize";

const DAY_MS = 86_400_000;

// ---------- Local time ----------

export type Local = { day: string; year: number; month: number; dow: number; hour: number };

// Wall-clock time where the check-in happened (falls back to the viewer's zone)
export function local(c: Checkin): Local {
  const ms = Date.parse(c.t);
  const off = c.off ?? -new Date(ms).getTimezoneOffset();
  const d = new Date(ms + off * 60_000);
  return {
    day: d.toISOString().slice(0, 10),
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    dow: d.getUTCDay(), // 0 = Sunday
    hour: d.getUTCHours(),
  };
}

export const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);

export function fmtDay(day: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

// ---------- Geography ----------

export function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 12_742 * Math.asin(Math.sqrt(h));
}

// ---------- Trips ----------

const HOME_RADIUS_KM = 150; // SW Ontario incl. Toronto/Niagara/Sarnia counts as home
const TRIP_GAP_DAYS = 4; // a longer quiet stretch away splits trips

export type TripStop = { key: string; name: string; lat: number; lng: number; count: number };

export type Trip = {
  id: string;
  name: string;
  countries: string[]; // most check-ins first
  countryCodes: string[];
  start: string; // local day
  end: string;
  days: number;
  checkins: Checkin[]; // oldest first
  stops: TripStop[]; // visit order
  top: Checkin | null;
};

const awayFromHome = (c: Checkin) =>
  c.lat != null && Math.min(...HOME_CITIES.map((h) => km(h, { lat: c.lat!, lng: c.lng! }))) > HOME_RADIUS_KM;

export function trips(checkins: Checkin[]): Trip[] {
  const sorted = [...checkins].filter((c) => c.lat != null).sort((a, b) => a.t.localeCompare(b.t));
  const groups: Checkin[][] = [];
  let cur: Checkin[] | null = null;
  for (const c of sorted) {
    if (!awayFromHome(c)) {
      cur = null;
      continue;
    }
    const last = cur?.at(-1);
    if (cur && last && Date.parse(c.t) - Date.parse(last.t) <= TRIP_GAP_DAYS * DAY_MS) cur.push(c);
    else groups.push((cur = [c]));
  }
  return groups.map(buildTrip).reverse();
}

function buildTrip(cs: Checkin[]): Trip {
  const byCountry = new Map<string, { n: number; code: string }>();
  const stops: TripStop[] = [];
  const stopIdx = new Map<string, TripStop>();
  const cityCount = new Map<string, number>();
  for (const c of cs) {
    const b = byCountry.get(c.country) ?? { n: 0, code: c.countryCode };
    b.n++;
    byCountry.set(c.country, b);
    const key = `${c.country}|${c.state}|${c.city || c.loc}`;
    cityCount.set(key, (cityCount.get(key) ?? 0) + 1);
    let s = stopIdx.get(key);
    if (!s) {
      s = { key, name: c.city || c.venue || c.state || c.country, lat: c.lat!, lng: c.lng!, count: 0 };
      stopIdx.set(key, s);
      stops.push(s);
    }
    s.count++;
  }
  const all = [...byCountry.entries()].sort((a, b) => b[1].n - a[1].n);
  const countries = all.filter(([name, v], i) => name && (i === 0 || v.n / cs.length >= 0.1));
  if (!countries.length) countries.push(all[0]);
  const topStop = [...stops].sort((a, b) => b.count - a.count)[0];
  const first = cs[0], last = cs.at(-1)!;

  let name: string;
  if (countries.length > 1) {
    const names = countries.map(([n]) => n);
    name = names.length > 3 ? `${names.slice(0, 3).join(", ")} +${names.length - 3}` : names.join(" & ").replace(/ & (?=.* & )/g, ", ");
  } else if (topStop.count / cs.length >= 0.6 || stops.length === 1) {
    name = topStop.name;
  } else {
    name = ["US", "CA", "MX"].includes(first.countryCode) && first.state ? first.state : countries[0][0];
  }

  const start = local(first).day, end = local(last).day;
  const rated = cs.filter((c) => c.rating != null);
  return {
    id: `${start}-${first.id}`,
    name,
    countries: countries.map(([n]) => n),
    countryCodes: countries.map(([, v]) => v.code),
    start,
    end,
    days: dayDiff(start, end) + 1,
    checkins: cs,
    stops,
    top: rated.length ? rated.reduce((a, b) => ((b.rating ?? 0) > (a.rating ?? 0) ? b : a)) : null,
  };
}

export function fmtRange(start: string, end: string) {
  if (start === end) return fmtDay(start);
  const [sy, sm] = start.split("-"), [ey, em] = end.split("-");
  const md = (d: string) => fmtDay(d, { month: "short", day: "numeric" });
  if (sy === ey && sm === em) return `${md(start)} – ${Number(end.slice(8))}, ${ey}`;
  if (sy === ey) return `${md(start)} – ${md(end)}, ${ey}`;
  return `${fmtDay(start)} – ${fmtDay(end)}`;
}

// ---------- Streaks ----------

export function dailyCounts(checkins: Checkin[]) {
  const m = new Map<string, Checkin[]>();
  for (const c of checkins) {
    const d = local(c).day;
    const arr = m.get(d);
    if (arr) arr.push(c);
    else m.set(d, [c]);
  }
  return m;
}

export type Run = { start: string; end: string; days: number };

export function streaks(days: string[]) {
  const sorted = [...days].sort();
  let best: Run = { start: sorted[0], end: sorted[0], days: sorted.length ? 1 : 0 };
  let drought: Run = { start: sorted[0], end: sorted[0], days: 0 };
  let runStart = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const gap = dayDiff(sorted[i - 1], sorted[i]);
    if (gap === 1) {
      const len = dayDiff(runStart, sorted[i]) + 1;
      if (len > best.days) best = { start: runStart, end: sorted[i], days: len };
    } else {
      runStart = sorted[i];
      if (gap - 1 > drought.days) drought = { start: sorted[i - 1], end: sorted[i], days: gap - 1 };
    }
  }
  // Current streak: run ending today or yesterday
  const today = new Date().toISOString().slice(0, 10);
  let current = 0;
  const last = sorted.at(-1);
  if (last && dayDiff(last, today) <= 1) {
    current = 1;
    for (let i = sorted.length - 1; i > 0 && dayDiff(sorted[i - 1], sorted[i]) === 1; i--) current++;
  }
  return { best, drought, current };
}

// "IPA - New England / Hazy" -> "IPA"
export const styleFamily = (s: string) => (s.split(" - ")[0] || "Unknown").trim();
