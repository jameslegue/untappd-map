import type { Checkin } from "./types.ts";

// Raw row from the Untappd Insider JSON export
export type ExportRow = {
  checkin_id: number;
  created_at: string;
  beer_name: string;
  brewery_name: string;
  brewery_country?: string | null;
  beer_type?: string | null;
  beer_abv?: number | null;
  rating_score?: number | string | null;
  serving_type?: string | null;
  comment?: string | null;
  venue_id?: number | null;
  venue_name?: string | null;
  venue_city?: string | null;
  venue_state?: string | null;
  venue_country?: string | null;
  venue_lat?: number | null;
  venue_lng?: number | null;
  photo_url?: string | null;
  checkin_url?: string | null;
};

// Untappd parks virtual venues ("Untappd at Home", virtual festivals) on its HQ
const UNTAPPD_HQ = { lat: 34.2347, lng: -77.9482 };
const HOME_VENUE = "Untappd at Home";

// "Untappd at Home" check-ins get spread across these, picked by checkin_id
// so re-imports are stable. City centres only - never an actual address.
const HOME_CITIES = [
  { id: -1, city: "Waterloo", lat: 43.4643, lng: -80.5204 },
  { id: -2, city: "London", lat: 42.9849, lng: -81.2453 },
  { id: -3, city: "Bayfield", lat: 43.5617, lng: -81.6967 },
];

// Export uses local-language country names; [English name, ISO-2]
const COUNTRIES: Record<string, [string, string]> = {
  "United States": ["United States", "US"],
  Canada: ["Canada", "CA"],
  México: ["Mexico", "MX"],
  Mexico: ["Mexico", "MX"],
  Portugal: ["Portugal", "PT"],
  France: ["France", "FR"],
  España: ["Spain", "ES"],
  Espanya: ["Spain", "ES"],
  Spain: ["Spain", "ES"],
  "United Kingdom": ["United Kingdom", "GB"],
  België: ["Belgium", "BE"],
  Belgique: ["Belgium", "BE"],
  Deutschland: ["Germany", "DE"],
  Nederland: ["Netherlands", "NL"],
  Argentina: ["Argentina", "AR"],
  Ελλάδα: ["Greece", "GR"],
  Italia: ["Italy", "IT"],
  Chile: ["Chile", "CL"],
  Österreich: ["Austria", "AT"],
  "Česká republika": ["Czechia", "CZ"],
  Ísland: ["Iceland", "IS"],
  Jamaica: ["Jamaica", "JM"],
  Bahamas: ["Bahamas", "BS"],
  Suisse: ["Switzerland", "CH"],
  Schweiz: ["Switzerland", "CH"],
  Hrvatska: ["Croatia", "HR"],
  Polska: ["Poland", "PL"],
  Uruguay: ["Uruguay", "UY"],
  Aruba: ["Aruba", "AW"],
  Sverige: ["Sweden", "SE"],
  Curaçao: ["Curaçao", "CW"],
  "Bonaire, Sint Eustatius en Saba": ["Caribbean Netherlands", "BQ"],
  Magyarország: ["Hungary", "HU"],
  المغرب: ["Morocco", "MA"],
  Ayiti: ["Haiti", "HT"],
  Danmark: ["Denmark", "DK"],
  Gibraltar: ["Gibraltar", "GI"],
  Ireland: ["Ireland", "IE"],
  Norge: ["Norway", "NO"],
  "Principauté de Monaco": ["Monaco", "MC"],
  Suomi: ["Finland", "FI"],
  日本: ["Japan", "JP"],
};

const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
  MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", PR: "Puerto Rico",
};

const CA_PROVINCES: Record<string, string> = {
  AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick",
  NL: "Newfoundland and Labrador", NS: "Nova Scotia", NT: "Northwest Territories",
  NU: "Nunavut", ON: "Ontario", PE: "Prince Edward Island", QC: "Quebec",
  SK: "Saskatchewan", YT: "Yukon",
};

const STATE_ALIASES: Record<string, string> = {
  "Mexico City": "Ciudad de México",
};

function country(raw: string | null | undefined): [string, string] {
  const name = (raw ?? "").trim();
  if (!name) return ["", ""];
  return COUNTRIES[name] ?? [name, ""];
}

function state(raw: string | null | undefined, countryCode: string): string {
  const s = (raw ?? "").trim();
  if (countryCode === "US") return US_STATES[s] ?? s;
  if (countryCode === "CA") return CA_PROVINCES[s] ?? s;
  return STATE_ALIASES[s] ?? s;
}

function rating(raw: ExportRow["rating_score"]): number | null {
  if (raw === "" || raw === null || raw === undefined) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isHq(lat: number, lng: number) {
  return Math.abs(lat - UNTAPPD_HQ.lat) < 0.001 && Math.abs(lng - UNTAPPD_HQ.lng) < 0.001;
}

export const isHomeVenue = (name: string | null | undefined) => name === HOME_VENUE;

export function homeLocation(id: number) {
  const h = HOME_CITIES[id % HOME_CITIES.length];
  return {
    loc: `v${h.id}`,
    lat: h.lat,
    lng: h.lng,
    city: h.city,
    state: "Ontario",
    country: "Canada",
    countryCode: "CA",
    venue: "Home",
    home: true,
  };
}

export function normalize(r: ExportRow): Checkin {
  const base: Checkin = {
    id: Number(r.checkin_id),
    t: new Date(r.created_at).toISOString(),
    beer: r.beer_name ?? "",
    brewery: r.brewery_name ?? "",
    breweryCountry: country(r.brewery_country)[0],
    style: r.beer_type ?? "",
    abv: r.beer_abv ?? null,
    rating: rating(r.rating_score),
    serving: r.serving_type ?? "",
    loc: null,
    lat: null,
    lng: null,
    city: "",
    state: "",
    country: "",
    countryCode: "",
    comment: r.comment ?? "",
    photo: r.photo_url || null,
    url: r.checkin_url ?? undefined,
  };

  const lat = r.venue_lat, lng = r.venue_lng;
  if (lat == null || lng == null) return base;

  if (r.venue_name === HOME_VENUE) return { ...base, ...homeLocation(base.id) };

  // Other virtual venues have no real location
  if (isHq(lat, lng)) return { ...base, venue: r.venue_name ?? undefined };

  const [countryName, code] = country(r.venue_country);
  const st = state(r.venue_state, code);
  let city = (r.venue_city ?? "").trim();
  // City-level venues ("Forest, Ontario") come through with no city set
  const m = !city && r.venue_name?.match(/^([^,]+),\s*(.+)$/);
  if (m && (m[2] === st || m[2] === r.venue_state)) city = m[1].trim();
  return {
    ...base,
    loc: `v${r.venue_id}`,
    lat,
    lng,
    city,
    state: st,
    country: countryName,
    countryCode: code,
    venue: r.venue_name ?? undefined,
  };
}

// Candidate URLs for a photo at a given size, best first. Older uploads usually
// have sized variants next to the raw file (_raw.jpg -> _640x640.jpg) but not
// always; newer ones (`_c_<id>_raw.jpg`) never do. The Next image optimizer
// (resized + cached on Vercel) is the fallback.
export function photoSources(url: string, size: 200 | 640): string[] {
  // Anything that isn't an S3 upload (e.g. a CDN URL from the RSS feed) is used as-is
  if (!url.startsWith("https://untappd.s3.amazonaws.com/")) return [url];
  const optimized = `/_next/image?url=${encodeURIComponent(url)}&w=${size === 200 ? 256 : 640}&q=75`;
  if (/_c_\d+_raw\.\w+$/.test(url)) return [optimized];
  const variant = url.replace(/_raw\.(jpe?g|png)$/i, `_${size}x${size}.$1`);
  return variant === url ? [optimized] : [variant, optimized];
}

export function flag(code: string): string {
  if (code.length !== 2) return "🏳️";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}
